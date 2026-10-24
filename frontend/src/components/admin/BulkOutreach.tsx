"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { authInput, authLabel, authPrimary, AuthAlert } from "@/components/custom/AuthShell";
import { parseCsv, stripTracking, toCsvLine } from "@/lib/csv";

type Status = "waiting" | "building" | "done" | "failed" | "skipped";

interface Row {
  cells: string[];
  listing: string;
  email: string;
  name: string;
  status: Status;
  giftUrl?: string;
  host?: string | null;
  property?: string | null;
  error?: string;
}

const LISTING = /airbnb\.|vrbo\.|homeaway\./i;

/** Which columns hold the listing link, the contact email and the property name, judged by header and content. */
function findColumns(header: string[], body: string[][]) {
  const lower = header.map((h) => h.trim().toLowerCase());
  const byContent = (test: (v: string) => boolean) =>
    header.findIndex((_, i) => body.some((r) => test((r[i] || "").trim())));
  let listing = lower.findIndex((h) => /airbnb|vrbo|listing/.test(h));
  if (listing === -1) listing = byContent((v) => LISTING.test(v));
  let email = lower.findIndex((h) => h.includes("email"));
  if (email === -1) email = byContent((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  const name = lower.findIndex((h) => /property|company|business|name/.test(h));
  return { listing, email, name };
}


/**
 * Bulk outreach: a CSV of prospects in, one gift guidebook per listing (built one at a time, about a
 * minute each), and a CSV out with each row's gift link. Admins only (the gifts API checks).
 */
export default function BulkOutreach({ token }: { token: string }) {
  const [text, setText] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [onlyWithEmail, setOnlyWithEmail] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  const load = (csv: string) => {
    setText(csv);
    setError(null);
    const parsed = parseCsv(csv);
    if (parsed.length < 2) {
      setHeader([]);
      setRows([]);
      return;
    }
    const [head, ...body] = parsed;
    const cols = findColumns(head, body);
    if (cols.listing === -1) {
      setError("Couldn't find a column of Airbnb or VRBO links.");
      setRows([]);
      return;
    }
    setHeader(head);
    setRows(
      body.map((cells) => ({
        cells,
        listing: stripTracking(cells[cols.listing] || ""),
        email: cols.email >= 0 ? (cells[cols.email] || "").trim() : "",
        name: cols.name >= 0 ? (cells[cols.name] || "").trim() : "",
        status: "waiting",
      })),
    );
  };

  /** Wait up to ms, ending early when Stop is pressed. */
  const pause = async (ms: number) => {
    for (let t = 0; t < ms && !stop.current; t += 500) await new Promise((r) => setTimeout(r, 500));
  };

  const update = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const run = async (only?: Status) => {
    stop.current = false;
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      if (stop.current) break;
      const row = rows[i];
      if (only ? row.status !== only : row.status !== "waiting") continue;
      if (!LISTING.test(row.listing)) {
        update(i, { status: "skipped", error: "No Airbnb or VRBO link" });
        continue;
      }
      if (onlyWithEmail && !row.email) {
        update(i, { status: "skipped", error: "No email" });
        continue;
      }
      update(i, { status: "building", error: undefined });
      // The gifts API allows 10 a minute; a 429 waits a minute and tries again. Other failures are left
      // for "Retry failed", since a timed-out build may have made the gift anyway.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch("/api/admin/gifts", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: row.listing, email: row.email }),
          });
          if (res.status === 429 && attempt < 2) {
            await pause(60_000);
            if (stop.current) {
              update(i, { status: "waiting" });
              break;
            }
            continue;
          }
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
          update(i, { status: "done", giftUrl: json.gift_url, host: json.host_name, property: json.property_name });
        } catch (err) {
          update(i, { status: "failed", error: err instanceof Error ? err.message : "Failed" });
        }
        break;
      }
    }
    setRunning(false);
  };

  const download = () => {
    const lines = [toCsvLine([...header, "gift_url", "host_name_from_listing", "property_name_from_listing", "status", "error"])];
    for (const r of rows) {
      lines.push(toCsvLine([...header.map((_, i) => r.cells[i] || ""), r.giftUrl || "", r.host || "", r.property || "", r.status, r.error || ""]));
    }
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `guidewise-gifts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const toBuild = rows.filter((r) => r.status === "waiting" && LISTING.test(r.listing) && (!onlyWithEmail || r.email)).length;

  return (
    <section id="bulk-outreach" className="max-w-4xl">
      <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1f1a17]">Bulk outreach</h2>
      <p className="mt-2 text-[15px] text-[#5b524c]">
        Upload a CSV of prospects with an Airbnb or VRBO link column (and an email column). Each listing becomes a gift guidebook, about a minute each. Keep this tab open, then download the CSV of gift links.
      </p>

      <div className="mt-6 space-y-5 rounded-[2rem] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5 sm:p-8">
        <label className="block">
          <span className={authLabel}>CSV file</span>
          <input type="file" accept=".csv,text/csv" disabled={running} className="mt-2 block text-sm"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text()); }} />
        </label>
        <label className="block">
          <span className={authLabel}>Or paste it</span>
          <textarea className={`${authInput} min-h-[120px] font-mono text-xs`} value={text} disabled={running}
            onChange={(e) => load(e.target.value)} placeholder="name,airbnb url,email" />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#3d3530]">
          <input type="checkbox" checked={onlyWithEmail} disabled={running} onChange={(e) => setOnlyWithEmail(e.target.checked)} />
          Only build rows that have an email
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {running ? (
            <button type="button" onClick={() => { stop.current = true; }} className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold ring-1 ring-[#1f1a17]/15">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Stop after this one
            </button>
          ) : (
            <button type="button" disabled={toBuild === 0} onClick={() => run()} className={`${authPrimary} sm:w-auto sm:px-6`}>
              Build {toBuild} gift guidebook{toBuild === 1 ? "" : "s"}
            </button>
          )}
          {!running && count("failed") > 0 && (
            <button type="button" onClick={() => run("failed")} className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold ring-1 ring-[#1f1a17]/15">
              Retry {count("failed")} failed
            </button>
          )}
          {rows.length > 0 && (
            <button type="button" onClick={download} className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 ring-[#1f1a17]/15">
              <Download className="h-4 w-4" /> Download results CSV
            </button>
          )}
        </div>
        {rows.length > 0 && (
          <p className="text-sm text-[#5b524c]">
            {count("done")} built · {count("failed")} failed · {count("skipped")} skipped · {rows.length} rows
          </p>
        )}
      </div>
      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-[2rem] bg-white p-4 ring-1 ring-black/5 sm:p-6">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[#8a7f77]">
              <tr><th className="pb-2 font-medium">Property</th><th className="pb-2 font-medium">Email</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Gift</th></tr>
            </thead>
            <tbody className="text-[#3d3530]">
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-[#1f1a17]/5 align-top">
                  <td className="max-w-[220px] truncate py-2 pr-3" title={r.listing}>{r.property || r.name || r.listing || "—"}</td>
                  <td className="max-w-[200px] truncate py-2 pr-3">{r.email || "—"}</td>
                  <td className="py-2 pr-3">
                    {r.status === "building" ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building</span>
                      : r.status === "done" ? <span className="text-emerald-700">Built</span>
                      : r.status === "failed" ? <span className="text-red-700" title={r.error}>Failed: {r.error}</span>
                      : r.status === "skipped" ? <span className="text-[#8a7f77]">Skipped: {r.error}</span>
                      : <span className="text-[#8a7f77]">Waiting</span>}
                  </td>
                  <td className="py-2">{r.giftUrl ? <a href={`${r.giftUrl}&preview=1`} target="_blank" rel="noreferrer" className="font-medium text-[#be185d]">Open</a> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
