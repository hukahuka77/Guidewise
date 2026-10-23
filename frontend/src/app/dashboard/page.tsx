"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import QRDownloadButton from "@/components/custom/QRDownloadButton";
import { absoluteUrl } from "@/lib/publicUrl";
import { offerUpgrade, throwApiError } from "@/lib/upgrade";
import { notify } from "@/lib/dialog";
import { cacheGet, cacheSet } from "@/lib/cache";
import { claimGuestGuidebooks, isGuestSession } from "@/lib/guest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

type GuidebookItem = {
  id: string;
  property_name?: string | null;
  template_key?: string | null;
  created_time?: string | null;
  last_modified_time?: string | null;
  cover_image_url?: string | null;
  public_slug?: string | null;
};

// Map internal template keys to human-friendly display names
const TEMPLATE_DISPLAY_NAMES: Record<string, string> = {
  template_signature: "Signature",
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

type ViewMode = "table" | "cards";
const VIEW_KEY = "guidewise-dashboard-view";

const styleName = (key?: string | null) => TEMPLATE_DISPLAY_NAMES[key || "template_signature"] || "Signature";
const updatedLabel = (gb: GuidebookItem) => {
  const when = gb.last_modified_time || gb.created_time;
  return when ? new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
};

/** The less common actions for a guidebook, behind a "…" button. */
function RowMenu({ items }: { items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`block w-full px-4 py-2 text-left text-sm disabled:opacity-50 ${item.danger ? "text-red-700 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [items, setItems] = useState<GuidebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<'free'|'starter'|'power'|'pro'|''>('');
  const [usage, setUsage] = useState<{ viewsUsed: number; viewsLimit: number | null }>({ viewsUsed: 0, viewsLimit: null });
  // Table by default; the card view is a choice we remember
  const [view, setView] = useState<ViewMode>("table");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "cards") setView("cards");
    } catch { }
  }, []);
  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch { }
  };

  // UI state
  const [qrModalFor, setQrModalFor] = useState<string | null>(null); // guidebook id
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null); // guidebook id being downloaded

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
      if (isGuestSession(data.session)) {
        router.push("/signup?save=1");
        return;
      }
      // Guidebooks built as a guest before signing up join the account first
      await claimGuestGuidebooks();
      try {
        // Fetch plan and limits from billing summary
        try {
          const token2 = (await supabase.auth.getSession()).data.session?.access_token || null;
          if (token2) {
            const r = await fetch(`/api/billing/summary`, { headers: { Authorization: `Bearer ${token2}` } });
            if (r.ok) {
              const j = await r.json();
              const userPlan = j?.plan || 'free';
              if (!cancelled) {
                setPlan(userPlan);
                setUsage({ viewsUsed: j?.views_used ?? 0, viewsLimit: j?.views_limit ?? null });
              }
            }
          }
        } catch {}

        const res = await fetch(`/api/guidebooks`, {
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

  const getQrTargetUrl = (id: string) => absoluteUrl(`/guidebook/${id}`);
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

      const res = await fetch(`/api/guidebook/${id}/print-pdf?download=1`, {
        headers,
      });

      if (!res.ok) await throwApiError(res, 'Failed to generate PDF');

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
      if (!offerUpgrade(e)) notify("Couldn't create the PDF", e instanceof Error && e.message ? e.message : 'Please try again.');
    } finally {
      setDownloadingPdf(null);
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

      <div className="max-w-6xl mx-auto py-2 sm:p-6 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Guidebooks</h1>
            <p className="text-gray-600 mt-1">Manage, share, and download your property guidebooks</p>
            {plan && (
              <p className="text-sm text-gray-500 mt-1">
                {usage.viewsLimit !== null ? (
                  <span>
                    <span className={usage.viewsUsed >= usage.viewsLimit ? "font-semibold text-red-600" : usage.viewsUsed >= usage.viewsLimit * 0.8 ? "font-semibold text-amber-700" : "font-semibold"}>
                      {usage.viewsUsed} / {usage.viewsLimit}
                    </span>{" "}
                    guest views used this month (Free plan)
                    <Link href="/pricing" className="underline text-[#CC7A52] ml-1">Upgrade for unlimited views</Link>
                    {usage.viewsUsed >= usage.viewsLimit && (
                      <span className="block text-red-600 mt-1">Your guidebooks are paused for guests until next month or until you upgrade.</span>
                    )}
                  </span>
                ) : (
                  <span className="font-semibold text-green-700">Unlimited guest views ({plan.charAt(0).toUpperCase() + plan.slice(1)} plan)</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/onboarding">
              <Button>Create New</Button>
            </Link>
            {plan !== 'pro' && plan !== '' && (
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? "guidebook" : "guidebooks"}</p>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="radiogroup" aria-label="Display as">
              {([["table", "Table", List], ["cards", "Cards", LayoutGrid]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={view === key}
                  onClick={() => changeView(key)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${view === key ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && items.length > 0 && view === "table" && (
          <div className="rounded-2xl border bg-white shadow-sm">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="rounded-tl-2xl px-4 py-3 font-medium">Property</th>
                  <th scope="col" className="hidden w-32 px-4 py-3 font-medium md:table-cell">Style</th>
                  <th scope="col" className="hidden w-36 px-4 py-3 font-medium sm:table-cell">Updated</th>
                  <th scope="col" className="w-[120px] rounded-tr-2xl px-3 py-3 text-right font-medium sm:w-[190px] sm:px-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((gb) => {
                  const viewUrl = gb.public_slug ? `/g/${gb.public_slug}` : null;
                  const name = gb.property_name || "Untitled Property";
                  return (
                    <tr key={gb.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/edit/${gb.id}`} className="flex min-w-0 items-center gap-3">
                          <span className="hidden h-10 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100 sm:block">
                            {gb.cover_image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getCoverThumbUrl(gb.cover_image_url) || gb.cover_image_url} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-900" title={name}>{name}</span>
                            <span className="block truncate text-xs text-gray-500 sm:hidden">{updatedLabel(gb)}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 text-gray-600 md:table-cell">{styleName(gb.template_key)}</td>
                      <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">{updatedLabel(gb)}</td>
                      <td className="px-3 py-3 sm:px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/edit/${gb.id}`}>
                            <Button size="sm" className="h-9 px-4">Edit</Button>
                          </Link>
                          {viewUrl && (
                            <Link
                              href={viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View ${name}`}
                              title="View guidebook"
                              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 sm:flex"
                            >
                              <ExternalLink className="size-4" />
                            </Link>
                          )}
                          <RowMenu
                            items={[
                              ...(viewUrl ? [{ label: "View guidebook", onSelect: () => window.open(viewUrl, "_blank", "noopener") }] : []),
                              { label: "QR code", onSelect: () => setQrModalFor(gb.id) },
                              { label: downloadingPdf === gb.id ? "Generating print version…" : "Download print version", onSelect: () => downloadPrintPdf(gb.id, name), disabled: downloadingPdf === gb.id },
                              { label: "Delete", onSelect: () => setDeleteId(gb.id), danger: true },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && items.length > 0 && view === "cards" && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.slice(0, visibleCount).map((gb) => {
              const viewUrl = gb.public_slug ? `/g/${gb.public_slug}` : null;

              return (
                <li key={gb.id} className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition min-h-[360px] relative">
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
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-800 truncate" title={gb.property_name || undefined}>{gb.property_name || "Untitled Property"}</h3>
                        <div className="text-xs text-gray-500">
                          {updatedLabel(gb) && `Updated ${updatedLabel(gb)}`}
                        </div>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[10px] px-2 py-1 bg-gray-100 rounded border text-gray-600">
                        {styleName(gb.template_key)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {/* Delete in small outline slot */}
                      <Button
                        variant="outline"
                        className="w-full whitespace-nowrap text-sm border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteId(gb.id)}
                      >
                        Delete
                      </Button>
                      <Link href={`/edit/${gb.id}`}>
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

                      {/* View the guidebook */}
                      <Link href={viewUrl || '#'} target="_blank" rel="noopener noreferrer" className="col-span-2" aria-disabled={!viewUrl}>
                        <Button
                          className="w-full whitespace-nowrap text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                          variant="outline"
                        >
                          View Guidebook
                        </Button>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && view === "cards" && items.length > visibleCount && (
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
                      <Link href={getQrTargetUrl(qrModalFor)} target="_blank" rel="noopener noreferrer"><Button variant="outline">Open Live URL</Button></Link>
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

              const res = await fetch(`/api/guidebooks/${deleteId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (!res.ok) {
                console.error('Delete failed', await res.text());
                setDeleteLoading(false);
                return;
              }

              setItems(prev => prev.filter(item => item.id !== deleteId));
              cacheSet("dashboard:guidebooks", null, 0);
              setDeleteId(null);
            } catch (e) {
              console.error('Delete guidebook error:', e);
            } finally {
              setDeleteLoading(false);
            }
          }}
        />
      </div>
    </div>
  );
}
