"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BulkOutreach from "@/components/admin/BulkOutreach";
import OutreachPanel from "@/components/admin/OutreachPanel";

interface Stats {
  users: { members: number; new_7d: number; new_30d: number; guests: number };
  guidebooks: { total: number; new_7d: number; unclaimed: number };
  plans: Record<string, number>;
  mrr_usd: number;
  views_month: number;
  ai_runs_month: number;
  top_guidebooks: { id: string; property_name: string | null; views: number }[];
  sources: { source: string; signups: number }[];
  heard_about: { answer: string; signups: number }[];
  recent_signups: { email: string | null; created_at: string | null; source: string; heard_about: string | null; plan: string; guidebooks: number }[];
  outreach?: OutreachGift[];
}

type ReplyStatus = "replied" | "interested" | "declined";

interface OutreachGift {
  guest_id: string;
  property_name: string | null;
  prospect_email: string | null;
  created_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  opens: number;
  claimed_at: string | null;
  claimed_by_email: string | null;
  reply_status: ReplyStatus | null;
  replied_at: string | null;
  reply_note: string | null;
}

const REPLY_LABELS: Record<ReplyStatus, string> = { replied: "Replied", interested: "Interested", declined: "Declined" };
const REPLY_STYLES: Record<ReplyStatus, string> = {
  replied: "bg-sky-50 text-sky-800 ring-sky-100",
  interested: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  declined: "bg-[#f3eee9] text-[#5b524c] ring-[#e7dfd4]",
};

/** How the prospect answered, saved as soon as it's picked. */
function ReplyPicker({ gift, token, onSaved }: { gift: OutreachGift; token: string | null; onSaved: (g: OutreachGift) => void }) {
  const [saving, setSaving] = useState(false);
  const status = gift.reply_status;
  return (
    <select
      aria-label={`Reply from ${gift.property_name || "this host"}`}
      value={status ?? ""}
      disabled={!token || saving}
      title={gift.reply_note || undefined}
      onChange={async (e) => {
        const next = (e.target.value || null) as ReplyStatus | null;
        setSaving(true);
        try {
          const res = await fetch(`/api/admin/outreach/${gift.guest_id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ reply_status: next, reply_note: gift.reply_note }),
          });
          if (res.ok) onSaved({ ...gift, reply_status: next, replied_at: next ? gift.replied_at ?? new Date().toISOString() : null });
        } finally {
          setSaving(false);
        }
      }}
      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium ring-1 disabled:opacity-60 ${status ? REPLY_STYLES[status] : "bg-white text-[#8a7f77] ring-[#1f1a17]/10"}`}
    >
      <option value="">No reply</option>
      {(Object.keys(REPLY_LABELS) as ReplyStatus[]).map((k) => <option key={k} value={k}>{REPLY_LABELS[k]}</option>)}
    </select>
  );
}

/** Each gift sent: did the host open it, and did they claim it. */
function OutreachResults({ gifts: initial, token }: { gifts: OutreachGift[]; token: string | null }) {
  const [gifts, setGifts] = useState(initial);
  const opened = gifts.filter((g) => g.opens > 0).length;
  const replied = gifts.filter((g) => g.reply_status).length;
  const declined = gifts.filter((g) => g.reply_status === "declined").length;
  const interested = gifts.filter((g) => g.reply_status === "interested").length;
  const claimed = gifts.filter((g) => g.claimed_at).length;
  const pct = (n: number) => (gifts.length ? `${Math.round((n / gifts.length) * 100)}%` : undefined);
  return (
    <section id="outreach-results" className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1f1a17]">Outreach results</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gifts sent" value={gifts.length} />
        <Stat label="Opened" value={opened} note={pct(opened)} />
        <Stat label="Replied" value={replied} note={replied ? `${interested} interested · ${declined} declined` : pct(replied)} />
        <Stat label="Claimed" value={claimed} note={pct(claimed)} />
      </div>
      <div className={`${card} overflow-x-auto`}>
        {gifts.length === 0 ? (
          <p className="text-sm text-[#8a7f77]">No gifts yet. Gifts built below show up here.</p>
        ) : (
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="text-[#8a7f77]">
              <tr><th className="pb-2 font-medium">Property</th><th className="pb-2 font-medium">Email</th><th className="pb-2 font-medium">Sent</th><th className="pb-2 font-medium">Opens</th><th className="pb-2 font-medium">Last opened</th><th className="pb-2 font-medium">Reply</th><th className="pb-2 font-medium">Claimed</th></tr>
            </thead>
            <tbody className="text-[#3d3530]">
              {gifts.map((g) => (
                <tr key={g.guest_id} className="border-t border-[#1f1a17]/5">
                  <td className="max-w-[220px] truncate py-2 pr-3">{g.property_name || "Untitled"}</td>
                  <td className="max-w-[200px] truncate py-2 pr-3">{g.prospect_email || "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{day(g.created_at)}</td>
                  <td className="py-2 pr-3">{g.opens || <span className="text-[#8a7f77]">Not yet</span>}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{day(g.last_opened_at)}</td>
                  <td className="whitespace-nowrap py-2 pr-3">
                    <ReplyPicker gift={g} token={token} onSaved={(saved) => setGifts((list) => list.map((x) => (x.guest_id === saved.guest_id ? saved : x)))} />
                    {g.replied_at && <span className="ml-2 text-xs text-[#8a7f77]">{day(g.replied_at)}</span>}
                  </td>
                  <td className="max-w-[220px] truncate py-2">
                    {g.claimed_at ? <span className="text-emerald-700" title={g.claimed_by_email || undefined}>{day(g.claimed_at)}{g.claimed_by_email ? ` · ${g.claimed_by_email}` : ""}</span> : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const card = "rounded-[2rem] bg-white p-6 shadow-[0_20px_50px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5";
const PLAN_NAMES: Record<string, string> = { starter: "Starter", power: "Power", pro: "Pro" };

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className={card}>
      <p className="text-sm font-medium text-[#8a7f77]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1f1a17]">{value}</p>
      {note && <p className="mt-1 text-sm text-[#5b524c]">{note}</p>}
    </div>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={card}>
      <h3 className="font-semibold text-[#1f1a17]">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#8a7f77]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate text-[#3d3530]">{r.label}</span>
                <span className="font-semibold text-[#1f1a17]">{r.value}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-[#f6f2ee]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316]" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

/** Admin tab: how Guidewise is doing, plus the outreach gift builder. Only admins (ADMIN_EMAILS) see it. */
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  useEffect(() => {
    (async () => {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session || session.user.is_anonymous) return setState("denied");
      setToken(session.access_token);
      const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.status === 404 || res.status === 401) return setState("denied");
      if (!res.ok) return setState("error");
      setStats(await res.json());
      setState("ok");
    })().catch(() => setState("error"));
  }, []);

  if (state === "loading") return <p className="text-[#8a7f77]">Loading…</p>;
  if (state === "denied") return <p className="text-[#5b524c]">This page isn&apos;t available.</p>;

  const paying = stats ? Object.values(stats.plans).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17]">Admin</h1>
        <p className="mt-1 text-[15px] text-[#5b524c]">How Guidewise is doing, and gift guidebooks for outreach. Only admins see this tab.</p>
      </div>

      {state === "error" && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">Couldn&apos;t load the stats. The outreach tool below still works.</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Accounts" value={stats.users.members} note={`+${stats.users.new_7d} this week · +${stats.users.new_30d} in 30 days`} />
            <Stat label="Guidebooks" value={stats.guidebooks.total} note={`+${stats.guidebooks.new_7d} this week · ${stats.guidebooks.unclaimed} not yet claimed`} />
            <Stat label="Paying hosts" value={paying} note={`$${stats.mrr_usd.toLocaleString()} / month`} />
            <Stat label="Guest views this month" value={stats.views_month.toLocaleString()} note={`${stats.ai_runs_month} AI runs this month`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Breakdown title="Where signups came from (30 days)" rows={stats.sources.map((s) => ({ label: s.source, value: s.signups }))} empty="No signups in the last 30 days." />
            <Breakdown title="How did you hear about us? (30 days)" rows={stats.heard_about.map((h) => ({ label: h.answer, value: h.signups }))} empty="No answers yet." />
            <Breakdown title="Paid plans" rows={Object.entries(stats.plans).map(([k, n]) => ({ label: PLAN_NAMES[k] ?? k, value: n }))} empty="No paid plans yet." />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
            <Breakdown title="Most viewed guidebooks this month" rows={stats.top_guidebooks.map((g) => ({ label: g.property_name || "Untitled", value: g.views }))} empty="No guest views yet this month." />
            <div className={`${card} overflow-x-auto`}>
              <h3 className="font-semibold text-[#1f1a17]">Recent signups</h3>
              {stats.recent_signups.length === 0 ? (
                <p className="mt-3 text-sm text-[#8a7f77]">No accounts yet.</p>
              ) : (
                <table className="mt-4 w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[#8a7f77]">
                    <tr><th className="pb-2 font-medium">Email</th><th className="pb-2 font-medium">Joined</th><th className="pb-2 font-medium">Source</th><th className="pb-2 font-medium">Plan</th><th className="pb-2 text-right font-medium">Guidebooks</th></tr>
                  </thead>
                  <tbody className="text-[#3d3530]">
                    {stats.recent_signups.map((u, i) => (
                      <tr key={`${u.email}-${i}`} className="border-t border-[#1f1a17]/5">
                        <td className="max-w-[220px] truncate py-2 pr-3">{u.email || "—"}</td>
                        <td className="whitespace-nowrap py-2 pr-3">{day(u.created_at)}</td>
                        <td className="max-w-[180px] truncate py-2 pr-3" title={u.heard_about ? `Heard: ${u.heard_about}` : undefined}>{u.source}</td>
                        <td className="py-2 pr-3 capitalize">{u.plan}</td>
                        <td className="py-2 text-right">{u.guidebooks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {stats?.outreach && <OutreachResults gifts={stats.outreach} token={token} />}
      {token && <OutreachPanel token={token} />}
      {token && <BulkOutreach token={token} />}
    </div>
  );
}
