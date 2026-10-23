"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/ui/spinner";

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
        const res = await fetch(`/api/analytics/views`, { headers: { Authorization: `Bearer ${token}` } });
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
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-4xl">Guest views</h1>
          <p className="mt-1.5 text-[#5b524c]">How often guests open your guidebooks</p>
        </div>
      </div>

      {error && <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 text-red-700">{error}</div>}
      {!error && !stats && (
        <div className="flex items-center gap-3 rounded-3xl bg-white p-6 ring-1 ring-black/5 text-[#5b524c]"><Spinner size={20} /> Loading…</div>
      )}

      {stats && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
            <div className="text-sm text-gray-600">This month</div>
            <div className="mt-1 text-4xl font-semibold tracking-[-0.03em] text-[#1f1a17]">{stats.views_used}</div>
            <div className="text-sm text-gray-500 mt-1">
              {stats.views_limit === null ? "guest views across all guidebooks (unlimited)" : `of ${stats.views_limit} guest views on the Free plan`}
            </div>
          </div>

          {!stats.analytics && (
            <div className="rounded-3xl bg-amber-50 p-6 text-amber-900 ring-1 ring-amber-100">
              Daily charts for each guidebook are included with the Power and Pro plans.{" "}
              <Link href="/pricing" className="underline font-semibold">See plans</Link>
            </div>
          )}

          {stats.guidebooks.length === 0 && <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 text-[#5b524c]">No guidebooks yet.</div>}

          {stats.guidebooks.map((gb) => {
            const days = stats.analytics ? series(gb.daily) : [];
            const max = Math.max(1, ...days.map((d) => d.views));
            const total30 = days.reduce((n, d) => n + d.views, 0);
            return (
              <div key={gb.id} className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
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
                        className="flex-1 rounded-t bg-gradient-to-t from-[#db2777] to-[#f97316]"
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
