"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import QRDownloadButton from "@/components/custom/QRDownloadButton";
import { cacheGet, cacheSet } from "@/lib/cache";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

type GuidebookItem = {
  id: string;
  property_name?: string | null;
  template_key?: string | null;
  created_time?: string | null;
  last_modified_time?: string | null;
  cover_image_url?: string | null;
  active?: boolean;
  public_slug?: string | null;
};

// Map internal template keys to human-friendly display names
const TEMPLATE_DISPLAY_NAMES: Record<string, string> = {
  template_original: "Guidewise Classic",
  template_generic: "Lifestyle",
  template_lifestyle: "Lifestyle",
  template_welcomebook: "Welcoming",
};

// Derive a resized cover thumbnail URL using Supabase's image transformation endpoint
function getCoverThumbUrl(coverUrl: string | null | undefined): string | null {
  if (!coverUrl || !SUPABASE_URL) return coverUrl || null;

  const marker = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/`;
  const idx = coverUrl.indexOf(marker);
  if (idx === -1) return coverUrl; // not a Supabase public URL; return as-is

  const rest = coverUrl.substring(idx + marker.length); // "bucket/path/to/file.jpg"
  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) return coverUrl;

  const bucket = rest.substring(0, firstSlash);
  const path = rest.substring(firstSlash + 1);
  if (!bucket || !path) return coverUrl;

  // Encode each path segment but preserve slashes so Supabase can resolve the object
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/render/image/public/${bucket}/${encodedPath}`;
  // Reasonable thumbnail size + compression for dashboard cards
  return `${base}?width=600&height=300&quality=75`;
}

export default function DashboardPage() {
  const [items, setItems] = useState<GuidebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<'free'|'trial'|'starter'|'growth'|'pro'|'enterprise'|''>('');
  const [guidebookLimit, setGuidebookLimit] = useState<number | null>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [toggling, setToggling] = useState<string | null>(null); // guidebook id being toggled

  // UI state
  const [qrModalFor, setQrModalFor] = useState<string | null>(null); // guidebook id
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null); // guidebook id being downloaded
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Check for update success message
  useEffect(() => {
    if (searchParams.get('updated') === 'true') {
      setUpdateSuccess(true);
      // Clear the URL parameter
      router.replace('/dashboard');
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setUpdateSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Serve from cache immediately if available
      const cached = cacheGet<GuidebookItem[]>("dashboard:guidebooks");
      if (cached && !cancelled) {
        setItems(cached);
        setLoading(false);
      }

      if (!supabase) {
        if (!cached) setError("Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        // Fetch plan and limits from billing summary
        try {
          const token2 = (await supabase.auth.getSession()).data.session?.access_token || null;
          if (API_BASE && token2) {
            const r = await fetch(`${API_BASE}/api/billing/summary`, { headers: { Authorization: `Bearer ${token2}` } });
            if (r.ok) {
              const j = await r.json();
              const userPlan = j?.plan || 'trial';
              const limit = j?.guidebook_limit;
              const active = j?.active_guidebooks || 0;
              if (!cancelled) {
                setPlan(userPlan);
                setGuidebookLimit(limit);
                setActiveCount(active);
              }
            }
          }
        } catch {}

        const res = await fetch(`${API_BASE}/api/guidebooks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load guidebooks (${res.status})`);
        const json = await res.json();
        const newItems = Array.isArray(json.items) ? json.items : [];
        if (!cancelled) {
          setItems(newItems);
          cacheSet("dashboard:guidebooks", newItems, 5 * 60_000);
          if (!cached) setLoading(false);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load guidebooks";
        if (!cancelled) {
          if (!cached) setError(msg);
        }
      } finally {
        if (!cancelled && !cached) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Show success banner after Stripe payment redirect
  useEffect(() => {
    const upgraded = searchParams?.get('upgraded');
    if (upgraded !== '1') return;

    // Show success message
    setSyncSuccess(true);

    // Clear profile cache to force refresh on next visit
    cacheSet("profile:user", null, 0);

    // Remove the ?upgraded=1 param from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('upgraded');
      window.history.replaceState({}, '', url.toString());
    }

    // Hide success message after 8 seconds
    const timer = setTimeout(() => {
      setSyncSuccess(false);
    }, 8000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const getQrTargetUrl = (id: string) => `${API_BASE}/guidebook/${id}`;
  const getQrImageUrl = (url: string, size = 300) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  // Download print PDF with loading state
  const downloadPrintPdf = async (id: string, propertyName: string) => {
    setDownloadingPdf(id);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token || null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/guidebook/${id}/print-pdf?download=1`, {
        headers,
      });

      if (!res.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Create blob and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${propertyName.replace(/[^a-z0-9]/gi, '_')}_print.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF download error:', e);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Toggle guidebook active state
  const toggleGuidebook = async (id: string) => {
    setToggling(id);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token || null;
      if (!token) {
        alert('Please log in to continue');
        return;
      }

      const res = await fetch(`${API_BASE}/api/guidebooks/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json();
        // Check if it's an upgrade-related error
        if (error.error && (error.error.toLowerCase().includes('upgrade') || error.error.toLowerCase().includes('limit') || error.error.toLowerCase().includes('plan'))) {
          setShowUpgradeModal(true);
        } else {
          alert(error.error || 'Failed to toggle guidebook');
        }
        return;
      }

      const result = await res.json();

      // Update local state
      setItems(prev => prev.map(item =>
        item.id === id
          ? { ...item, active: result.active, public_slug: result.public_slug }
          : item
      ));

      // Update active count
      if (result.active) {
        setActiveCount(prev => prev + 1);
      } else {
        setActiveCount(prev => Math.max(0, prev - 1));
      }

      // Clear cache
      cacheSet("dashboard:guidebooks", null, 0);
    } catch (e) {
      alert('Failed to toggle guidebook. Please try again.');
      console.error(e);
    } finally {
      setToggling(null);
    }
  };

  // No direct PDF building here; navigate to per-guidebook PDF page

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      {/* Success banner after payment */}
      {syncSuccess && (
        <div className="w-full bg-emerald-100 border-b border-emerald-300 text-emerald-800" role="alert">
          <div className="px-4 py-3 text-center">
            <strong className="font-bold">Payment successful!</strong>
            <span className="block sm:inline"> Your subscription is being activated. Please refresh the page in a moment to see your new plan.</span>
          </div>
        </div>
      )}

      {updateSuccess && (
        <div className="w-full bg-emerald-100 border-b border-emerald-300 text-emerald-800" role="alert">
          <div className="px-4 py-3 text-center flex items-center justify-center gap-2">
            <strong className="font-bold">Guidebook updated successfully!</strong>
            <button
              onClick={() => setUpdateSuccess(false)}
              className="ml-2 text-emerald-600 hover:text-emerald-900"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Guidebooks</h1>
            <p className="text-gray-600 mt-1">Manage, share, and download your property guidebooks</p>
            {plan && (
              <p className="text-sm text-gray-500 mt-1">
                {(plan === 'free' || plan === 'trial') ? (
                  <span>Free preview mode - <Link href="/pricing" className="underline text-[#CC7A52]">Upgrade to publish</Link></span>
                ) : guidebookLimit === null ? (
                  <span className="font-semibold text-green-700">Unlimited guidebooks ({plan})</span>
                ) : (
                  <span>
                    <span className="font-semibold">{activeCount} / {guidebookLimit}</span> guidebooks active ({plan})
                    {activeCount >= guidebookLimit && <span className="text-[#CC7A52] ml-1">- <Link href="/pricing" className="underline">Upgrade for more</Link></span>}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/onboarding">
              <Button className="bg-[oklch(0.6923_0.22_21.05)] hover:opacity-90">Create New</Button>
            </Link>
            {(plan === 'free' || plan === 'trial') && (
              <Link href="/pricing">
                <Button variant="secondary">Upgrade</Button>
              </Link>
            )}
          </div>
        </div>

        {/* removed global PDF options per new UX */}

        {loading && (
          <div className="bg-white rounded-xl border p-6 text-gray-700 flex items-center gap-3">
            <Spinner size={20} colorClass="text-[oklch(0.6923_0.22_21.05)]" />
            <span>Loading…</span>
          </div>
        )}
        {!loading && error && (
          <div className="bg-white rounded-xl border p-6 text-red-600">{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bg-white rounded-2xl border p-8 text-center text-gray-600">No guidebooks yet. Create your first one!</div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.slice(0, visibleCount).map((gb) => {
              const isActive = gb.active || false;
              const viewUrl = isActive && gb.public_slug
                ? `${API_BASE}/g/${gb.public_slug}`
                : `${API_BASE}/preview/${gb.id}`;
              const canActivate = guidebookLimit === null || (activeCount < (guidebookLimit || 0));
              const isToggling = toggling === gb.id;

              return (
                <li key={gb.id} className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition min-h-[360px] relative">
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    {isActive ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                        ● Live
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full border border-gray-200">
                        Preview
                      </span>
                    )}
                  </div>

                  <div className="aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-gray-100">
                    {gb.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getCoverThumbUrl(gb.cover_image_url) || gb.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No cover</div>
                    )}
                  </div>
                  <div className="p-5 pb-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 truncate">{gb.property_name || "Untitled Property"}</h3>
                        <div className="text-xs text-gray-500">
                          {gb.last_modified_time ? `Updated ${new Date(gb.last_modified_time).toLocaleString()}` :
                           gb.created_time ? `Created ${new Date(gb.created_time).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 bg-gray-100 rounded border text-gray-600">
                        {TEMPLATE_DISPLAY_NAMES[gb.template_key || "template_original"] || "Original"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {/* Toggle Button */}
                      <Button
                        className={`col-span-2 ${isActive ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'}`}
                        onClick={() => toggleGuidebook(gb.id)}
                        disabled={isToggling || (!isActive && !canActivate)}
                      >
                        {isToggling ? (
                          <span className="flex items-center gap-2">
                            <Spinner size={14} colorClass="text-white" /> Updating...
                          </span>
                        ) : isActive ? (
                          '🔓 Deactivate (Make Preview)'
                        ) : !canActivate ? (
                          '🔒 Upgrade to Activate'
                        ) : (
                          '✓ Activate (Publish)'
                        )}
                      </Button>

                      {/* Delete in small outline slot */}
                      <Button
                        variant="outline"
                        className="w-full whitespace-nowrap text-sm border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteId(gb.id)}
                      >
                        Delete
                      </Button>
                      <Link href={`/dashboard/url/${gb.id}`}>
                        <Button className="w-full whitespace-nowrap text-sm">Edit</Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="col-span-2 w-full whitespace-nowrap text-sm border-black text-gray-900 hover:bg-gray-50"
                        onClick={() => setQrModalFor(gb.id)}
                      >
                        🔲 View QR Code
                      </Button>
                      <Button
                        variant="outline"
                        className="col-span-2 w-full whitespace-nowrap text-sm border-[#CC7A52] text-[#CC7A52] hover:bg-[#CC7A52]/10"
                        onClick={() => downloadPrintPdf(gb.id, gb.property_name || 'guidebook')}
                        disabled={downloadingPdf === gb.id}
                      >
                        {downloadingPdf === gb.id ? (
                          <span className="flex items-center gap-2">
                            <Spinner size={14} colorClass="text-[#CC7A52]" />
                            Generating PDF...
                          </span>
                        ) : (
                          '📄 Download Print Version'
                        )}
                      </Button>

                      {/* View Live/Preview as full-width light green button */}
                      <Link href={viewUrl} target="_blank" className="col-span-2">
                        <Button
                          className="w-full whitespace-nowrap text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                          variant="outline"
                        >
                          {isActive ? 'View Live' : 'Preview'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && items.length > visibleCount && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              className="px-6 py-2 text-sm"
              onClick={() => setVisibleCount((prev) => Math.min(items.length, prev + 6))}
            >
              Load more
            </Button>
          </div>
        )}

        {/* removed inline PDF modal; handled in dedicated PDF page */}

        {/* QR Modal */}
        {qrModalFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setQrModalFor(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Guidebook QR Code</h3>
                <Button size="sm" variant="outline" onClick={() => setQrModalFor(null)}>Close</Button>
              </div>
              <div className="p-6 flex flex-col items-center gap-4">
                {qrModalFor && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getQrImageUrl(getQrTargetUrl(qrModalFor), 400)}
                      alt="Guidebook QR"
                      className="w-[260px] h-[260px] border rounded-xl p-3 bg-white"
                    />
                    <div className="flex gap-2">
                      <Link href={getQrTargetUrl(qrModalFor)} target="_blank"><Button variant="outline">Open Live URL</Button></Link>
                      <QRDownloadButton
                        targetUrl={getQrTargetUrl(qrModalFor)}
                        propertyName={items.find(gb => gb.id === qrModalFor)?.property_name || 'guidebook'}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Guidebook Confirmation */}
        <ConfirmModal
          open={!!deleteId}
          title="Delete guidebook?"
          description={"This will permanently delete this guidebook and its data. This action cannot be undone."}
          confirmLabel={deleteLoading ? "Deleting…" : "Delete"}
          cancelLabel="Cancel"
          destructive
          onCancel={() => {
            if (deleteLoading) return;
            setDeleteId(null);
          }}
          onConfirm={async () => {
            if (!deleteId || deleteLoading) return;
            setDeleteLoading(true);
            try {
              const token = (await supabase?.auth.getSession())?.data.session?.access_token || null;
              if (!token) {
                console.error('Missing auth token for delete');
                setDeleteLoading(false);
                return;
              }

              const res = await fetch(`${API_BASE}/api/guidebooks/${deleteId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (!res.ok) {
                console.error('Delete failed', await res.text());
                setDeleteLoading(false);
                return;
              }

              setItems(prev => prev.filter(item => item.id !== deleteId));
              // If a deleted guidebook was active, adjust activeCount
              const deleted = items.find(i => i.id === deleteId);
              if (deleted?.active) {
                setActiveCount(prev => Math.max(0, prev - 1));
              }
              cacheSet("dashboard:guidebooks", null, 0);
              setDeleteId(null);
            } catch (e) {
              console.error('Delete guidebook error:', e);
            } finally {
              setDeleteLoading(false);
            }
          }}
        />

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowUpgradeModal(false)}>
            <div
              className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-pink-50 to-orange-50">
                <h3 className="font-bold text-xl text-gray-800">
                  Upgrade Required
                </h3>
                <Button size="sm" variant="outline" onClick={() => setShowUpgradeModal(false)}>
                  ✕
                </Button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  You&apos;ve reached your guidebook limit. Upgrade your plan to activate more guidebooks and unlock additional features.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium">
                    ✨ Upgrade benefits:
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                    <li>Activate more guidebooks</li>
                    <li>Premium templates</li>
                    <li>Priority support</li>
                  </ul>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1"
                  >
                    Maybe Later
                  </Button>
                  <Link href="/pricing" className="flex-1">
                    <Button
                      className="w-full bg-[oklch(0.6923_0.22_21.05)] hover:opacity-90 text-white"
                    >
                      View Plans
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
