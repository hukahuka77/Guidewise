import { adminStats } from "./adminStats";
import type { Sql } from "./db";
import { escapeHtml } from "./email";

const SITE = "https://www.guidewiseapp.com";
const PLAN_NAMES: Record<string, string> = { starter: "Starter", power: "Power", pro: "Pro", enterprise: "Enterprise" };

/** Who gets the weekly summary: SUMMARY_EMAILS if set, otherwise the admins. */
export function summaryRecipients(): string[] {
  const raw = process.env.SUMMARY_EMAILS || process.env.ADMIN_EMAILS || "";
  return raw.split(",").map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

/** The Monday summary: signups, guidebooks, money, guest views and outreach, from the admin stats. */
export async function buildWeeklySummary(sql: Sql, now = new Date()): Promise<{ subject: string; html: string; text: string }> {
  const s = await adminStats(sql);
  const weekAgo = now.getTime() - 7 * 86400_000;
  const recent = s.outreach.filter((g) => g.created_at && Date.parse(g.created_at) > weekAgo).length;
  const opened = s.outreach.filter((g) => g.opens > 0).length;
  const replied = s.outreach.filter((g) => g.reply_status).length;
  const declined = s.outreach.filter((g) => g.reply_status === "declined").length;
  const interested = s.outreach.filter((g) => g.reply_status === "interested").length;
  const claimed = s.outreach.filter((g) => g.claimed_at).length;
  const repliedThisWeek = s.outreach.filter((g) => g.replied_at && Date.parse(g.replied_at) > weekAgo);
  const paying = Object.values(s.plans).reduce((a, b) => a + b, 0);
  const planList = Object.entries(s.plans).map(([k, n]) => `${n} ${PLAN_NAMES[k] ?? k}`).join(", ") || "none yet";
  const newSignups = s.recent_signups.filter((u) => u.created_at && Date.parse(u.created_at) > weekAgo);

  const rows: [string, string][] = [
    ["New accounts this week", `${s.users.new_7d} (${s.users.members} total)`],
    ["New guidebooks this week", `${s.guidebooks.new_7d} (${s.guidebooks.total} total)`],
    ["Paying hosts", `${paying} · $${s.mrr_usd.toLocaleString("en-US")}/month (${planList})`],
    ["Guest views this month", s.views_month.toLocaleString("en-US")],
    ["AI runs this month", String(s.ai_runs_month)],
  ];
  const outreachRows: [string, string][] = s.outreach.length
    ? [
        ["Gifts sent", `${s.outreach.length}${recent ? ` (${recent} this week)` : ""}`],
        ["Opened", String(opened)],
        ["Replied", `${replied} (${interested} interested, ${declined} declined)`],
        ["Claimed", String(claimed)],
      ]
    : [];

  const table = (list: [string, string][]) =>
    `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px">${list
      .map(([k, v]) => `<tr><td style="padding:8px 0;color:#5b524c;border-bottom:1px solid #f0eae4">${escapeHtml(k)}</td><td style="padding:8px 0;text-align:right;color:#1f1a17;font-weight:600;border-bottom:1px solid #f0eae4">${escapeHtml(v)}</td></tr>`)
      .join("")}</table>`;
  const heading = (t: string) => `<h2 style="margin:28px 0 8px;font-size:16px;color:#1f1a17">${escapeHtml(t)}</h2>`;

  const signupList = newSignups.length
    ? `<ul style="margin:0;padding-left:18px;color:#3d3530;font-size:14px;line-height:1.6">${newSignups
        .slice(0, 10)
        .map((u) => `<li>${escapeHtml(u.email || "unknown")} · ${escapeHtml(u.source)}${u.plan !== "free" ? ` · ${escapeHtml(PLAN_NAMES[u.plan] ?? u.plan)}` : ""}</li>`)
        .join("")}</ul>`
    : `<p style="margin:0;color:#8a7f77;font-size:14px">No new accounts this week.</p>`;
  const replyList = repliedThisWeek.length
    ? `<ul style="margin:8px 0 0;padding-left:18px;color:#3d3530;font-size:14px;line-height:1.6">${repliedThisWeek
        .map((g) => `<li>${escapeHtml(g.property_name || "Gift")}: ${escapeHtml(g.reply_status)}${g.reply_note ? ` (${escapeHtml(g.reply_note)})` : ""}</li>`)
        .join("")}</ul>`
    : "";

  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const subject = `Guidewise this week: ${s.users.new_7d} new account${s.users.new_7d === 1 ? "" : "s"}, $${s.mrr_usd}/mo`;
  const html = `<!doctype html><html><body style="margin:0;background:#f8f5f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border-radius:24px;padding:28px">
<p style="margin:0;font-size:13px;color:#8a7f77">Weekly summary · ${escapeHtml(date)}</p>
<h1 style="margin:6px 0 4px;font-size:22px;color:#1f1a17">How Guidewise did this week</h1>
${heading("Numbers")}${table(rows)}
${heading("New accounts")}${signupList}
${outreachRows.length ? heading("Outreach") + table(outreachRows) + replyList : ""}
<p style="margin:28px 0 0"><a href="${SITE}/dashboard/admin" style="display:inline-block;background:#1f1a17;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600">Open the Admin tab</a></p>
</div>
<p style="margin:16px 0 0;text-align:center;font-size:12px;color:#8a7f77">Sent every Monday to Guidewise admins.</p>
</div></body></html>`;
  const text = [
    `How Guidewise did this week (${date})`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "New accounts:",
    ...(newSignups.length ? newSignups.slice(0, 10).map((u) => `- ${u.email || "unknown"} (${u.source})`) : ["- none"]),
    ...(outreachRows.length ? ["", "Outreach:", ...outreachRows.map(([k, v]) => `${k}: ${v}`)] : []),
    "",
    `${SITE}/dashboard/admin`,
  ].join("\n");
  return { subject, html, text };
}
