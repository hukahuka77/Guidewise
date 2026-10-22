"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type Point = { day: string; views: number };
type Stats = {
  plan: string;
  month_start: string;
  views_used: number;
  views_limit: number | null;
  analytics: boolean;
  guidebooks: { id: string; property_name: string | null; views_month: number; daily?: Point[] }[];
};

/** Last 30 days as a continuous series (missing days are zero). */
function series(points: Point[] = []): Point[] {
  const byDay = new Map(points.map((p) => [p.day, p.views]));
  const out: Point[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const day = d.toISOString().slice(0, 10);
    out.push({ day, views: byDay.get(day) ?? 0 });
  }
  return out;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/analytics/views`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`);
        setStats(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      }
    })();
  }, [router]);

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Guest views</h1>
          <p className="text-gray-600 mt-1">How often guests open your guidebooks</p>
        </div>
        <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
      </div>

      {error && <div className="bg-white rounded-xl border p-6 text-red-600">{error}</div>}
      {!error && !stats && (
        <div className="bg-white rounded-xl border p-6 flex items-center gap-3"><Spinner size={20} /> Loading…</div>
      )}

      {stats && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <div className="text-sm text-gray-600">This month</div>
            <div className="text-4xl font-extrabold text-gray-900 mt-1">{stats.views_used}</div>
            <div className="text-sm text-gray-500 mt-1">
              {stats.views_limit === null ? "guest views across all guidebooks (unlimited)" : `of ${stats.views_limit} guest views on the Free plan`}
            </div>
          </div>

          {!stats.analytics && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900">
              Daily charts for each guidebook are included with the Power and Pro plans.{" "}
              <Link href="/pricing" className="underline font-semibold">See plans</Link>
            </div>
          )}

          {stats.guidebooks.length === 0 && <div className="bg-white rounded-xl border p-6 text-gray-600">No guidebooks yet.</div>}

          {stats.guidebooks.map((gb) => {
            const days = stats.analytics ? series(gb.daily) : [];
            const max = Math.max(1, ...days.map((d) => d.views));
            const total30 = days.reduce((n, d) => n + d.views, 0);
            return (
              <div key={gb.id} className="bg-white rounded-xl border p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-semibold text-gray-800 truncate">{gb.property_name || "Untitled Property"}</h2>
                  <div className="text-sm text-gray-600 whitespace-nowrap">
                    <span className="font-semibold">{gb.views_month}</span> this month
                    {stats.analytics && <span className="ml-3"><span className="font-semibold">{total30}</span> last 30 days</span>}
                  </div>
                </div>
                {stats.analytics && (
                  <div className="mt-4 flex items-end gap-[3px] h-24" role="img" aria-label={`Daily views for the last 30 days, ${total30} in total`}>
                    {days.map((d) => (
                      <div
                        key={d.day}
                        title={`${d.day}: ${d.views} view${d.views === 1 ? "" : "s"}`}
                        className="flex-1 rounded-t bg-[#CC7A52]/80"
                        style={{ height: `${Math.max(d.views === 0 ? 2 : 6, (d.views / max) * 100)}%`, opacity: d.views === 0 ? 0.25 : 1 }}
                      />
                    ))}
                  </div>
                )}
                {stats.analytics && (
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>{days[0]?.day}</span>
                    <span>{days[days.length - 1]?.day}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
