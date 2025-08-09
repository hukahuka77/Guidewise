"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
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
      if (mounted) setAccessToken(token);
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
      } catch (e: any) {
        setError(e.message || "Failed to load guidebooks");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Your Guidebooks</h1>
        <div className="flex gap-2">
          <Link href="/create" className="px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold">Create new</Link>
          <button
            onClick={async () => {
              try {
                await supabase?.auth.signOut();
              } finally {
                router.push("/");
              }
            }}
            className="px-4 py-2 rounded border font-semibold"
          >
            Logout
          </button>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {!loading && error && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-gray-600">No guidebooks yet. Create your first one!</div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((gb) => (
            <li key={gb.id} className="border rounded p-4 flex gap-4">
              {gb.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gb.cover_image_url} alt="Cover" className="w-20 h-20 object-cover rounded" />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded" />)
              }
              <div className="flex-1">
                <div className="font-semibold">{gb.property_name || "Untitled Property"}</div>
                <div className="text-sm text-gray-600">Template: {gb.template_key || "template_1"}</div>
                <div className="text-xs text-gray-500">
                  {gb.last_modified_time ? `Updated ${new Date(gb.last_modified_time).toLocaleString()}` :
                   gb.created_time ? `Created ${new Date(gb.created_time).toLocaleString()}` : ''}
                </div>
                <div className="mt-2 text-sm flex gap-4">
                  <a
                    href={`${API_BASE}/guidebook/${gb.id}`}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                  </a>
                  <Link href={`/edit/${gb.id}`} className="text-green-700 underline">
                    Edit
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
