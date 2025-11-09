"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { cacheGet, cacheSet } from "@/lib/cache";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

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

export default function DashboardPage() {
  const [items, setItems] = useState<GuidebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [plan, setPlan] = useState<'starter'|'growth'|'pro'|'enterprise'|'trial'|''>('');
  const [guidebookLimit, setGuidebookLimit] = useState<number | null>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [toggling, setToggling] = useState<string | null>(null); // guidebook id being toggled

  // UI state
  const [qrModalFor, setQrModalFor] = useState<string | null>(null); // guidebook id

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

  const getQrTargetUrl = (id: string) => `${API_BASE}/guidebook/${id}`;
  const getQrImageUrl = (url: string, size = 300) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

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
        alert(error.error || 'Failed to toggle guidebook');
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
      <div className="max-w-6xl mx-auto p-6 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Guidebooks</h1>
            <p className="text-gray-600 mt-1">Manage, share, and download your property guidebooks</p>
            {plan && guidebookLimit !== null && (
              <p className="text-sm text-gray-500 mt-1">
                {plan === 'trial' ? (
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
            <Link href="/create">
              <Button className="bg-[oklch(0.6923_0.22_21.05)] hover:opacity-90">Create New</Button>
            </Link>
            {plan && !['pro', 'enterprise'].includes(plan) && (
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
            {items.map((gb) => {
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
                      <img src={gb.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
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
                      <span className="text-[10px] px-2 py-1 bg-gray-100 rounded border text-gray-600">{gb.template_key || "template_original"}</span>
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

                      <Link href={viewUrl} target="_blank">
                        <Button variant="outline" className="w-full whitespace-nowrap text-sm">
                          {isActive ? 'View Live' : 'Preview'}
                        </Button>
                      </Link>
                      <Link href={`/edit/${gb.id}`}>
                        <Button className="w-full whitespace-nowrap text-sm">Edit</Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="w-full whitespace-nowrap text-sm"
                        onClick={() => setQrModalFor(gb.id)}
                      >QR Code</Button>
                      <Link href={`/dashboard/pdf/${gb.id}`}>
                        <Button variant="outline" className="w-full whitespace-nowrap text-sm">PDF Templates</Button>
                      </Link>
                      <Link href={`/dashboard/url/${gb.id}`} className="col-span-2">
                        <Button variant="outline" className="w-full whitespace-nowrap text-sm">Guidebook Templates</Button>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
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
                      <Button onClick={() => {
                        const link = document.createElement('a');
                        link.href = getQrImageUrl(getQrTargetUrl(qrModalFor), 600);
                        link.download = 'guidebook-qr.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}>Download QR</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
