"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type GuidebookItem = {
  id: string;
  property_name?: string | null;
  template_key?: string | null;
  created_time?: string | null;
  last_modified_time?: string | null;
  cover_image_url?: string | null;
};

export default function DashboardPage() {
  const [items, setItems] = useState<GuidebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // UI state
  const [qrModalFor, setQrModalFor] = useState<string | null>(null); // guidebook id

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setError("Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (!token) {
        // Not logged in, send to login
        router.push("/login");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/guidebooks`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401) {
          // Session invalid/expired -> login
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load guidebooks (${res.status})`);
        const json = await res.json();
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load guidebooks";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      // no-op cleanup
    };
  }, [router]);

  const getQrTargetUrl = (id: string) => `${API_BASE}/guidebook/${id}`;
  const getQrImageUrl = (url: string, size = 300) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  // No direct PDF building here; navigate to per-guidebook PDF page

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <div className="max-w-6xl mx-auto p-6 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Guidebooks</h1>
            <p className="text-gray-600 mt-1">Manage, share, and download your property guidebooks</p>
          </div>
          <div className="flex gap-2">
            <Link href="/create">
              <Button className="bg-[oklch(0.6923_0.22_21.05)] hover:opacity-90">Create New</Button>
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                try { await supabase?.auth.signOut(); } finally { router.push("/"); }
              }}
            >Logout</Button>
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
              const liveUrl = `${API_BASE}/guidebook/${gb.id}`;
              return (
                <li key={gb.id} className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition">
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-gray-100">
                    {gb.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={gb.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No cover</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-800 truncate">{gb.property_name || "Untitled Property"}</h3>
                        <div className="text-xs text-gray-500">
                          {gb.last_modified_time ? `Updated ${new Date(gb.last_modified_time).toLocaleString()}` :
                           gb.created_time ? `Created ${new Date(gb.created_time).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 bg-gray-100 rounded border text-gray-600">{gb.template_key || "template_original"}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link href={liveUrl} target="_blank">
                        <Button variant="outline" className="w-full">View Live</Button>
                      </Link>
                      <Link href={`/edit/${gb.id}`}>
                        <Button className="w-full">Edit</Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setQrModalFor(gb.id)}
                      >QR Code</Button>
                      <Link href={`/dashboard/pdf/${gb.id}`}>
                        <Button variant="outline" className="w-full">PDF Templates</Button>
                      </Link>
                      <Link href={`/dashboard/url/${gb.id}`}>
                        <Button variant="outline" className="w-full">Guidebook Templates</Button>
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
