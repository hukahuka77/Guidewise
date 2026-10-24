"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { authInput, authLabel, authPrimary, AuthAlert } from "@/components/custom/AuthShell";

interface Made {
  url: string;
  property: string | null;
  host: string | null;
  missing: string[];
}

const SENDER_KEY = "guidewise-outreach-sender";

function message(made: Made, sender: string): string {
  const first = made.host?.split(" ")[0];
  return [
    `Hi${first ? ` ${first}` : ""}! I came across ${made.property || "your place"} and built you a free digital guidebook from your listing: check-in, Wi-Fi, house rules and local spots, all in one link for your guests.`,
    ``,
    `Take a look: ${made.url}`,
    ``,
    `If you like it, it's yours to keep and edit, free forever.${sender ? ` ${sender}, Guidewise` : ""}`,
  ].join("\n");
}

/** Outreach: build a guidebook from a host's listing and copy a message with its gift link. Admins only. */
export default function OutreachPanel({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Made[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    try { setSender(localStorage.getItem(SENDER_KEY) || ""); } catch { }
  }, []);

  const build = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      setMade((list) => [{ url: json.gift_url, property: json.property_name, host: json.host_name, missing: json.missing || [] }, ...list]);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the guidebook");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, i: number) => {
    try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1500); } catch { }
  };

  return (
    <section id="outreach">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1f1a17]">Outreach</h2>
        <p className="mt-2 text-[15px] text-[#5b524c]">Paste a host&apos;s Airbnb or VRBO link. You get a gift link and a message to send them. The guidebook stays private until they claim it.</p>

        <form onSubmit={build} className="mt-6 space-y-5 rounded-[2rem] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5 sm:p-8">
          <label className="block">
            <span className={authLabel}>Listing link</span>
            <input className={authInput} required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.airbnb.com/rooms/…" />
          </label>
          <label className="block">
            <span className={authLabel}>Sign the message as</span>
            <input className={authInput} value={sender} placeholder="Your first name"
              onChange={(e) => { setSender(e.target.value); try { localStorage.setItem(SENDER_KEY, e.target.value); } catch { } }} />
          </label>
          <button type="submit" disabled={busy} className={authPrimary}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building, about a minute…</> : "Build gift guidebook"}
          </button>
        </form>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <div className="mt-8 space-y-4">
          {made.map((m, i) => {
            const text = message(m, sender);
            return (
              <div key={m.url} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#1f1a17]">{m.property || "Guidebook"}{m.host ? ` · ${m.host}` : ""}</p>
                  <a href={m.url} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-medium text-[#be185d]">Open gift</a>
                </div>
                {m.missing.length > 0 && <p className="mt-1 text-xs text-[#8a7f77]">Not found in the listing: {m.missing.join(", ")}</p>}
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#f6f2ee] p-4 font-sans text-sm text-[#1f1a17]">{text}</pre>
                <button type="button" onClick={() => copy(text, i)} className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[#1f1a17] ring-1 ring-[#1f1a17]/15 hover:bg-[#faf7f4]">
                  <Copy className="h-4 w-4" /> {copied === i ? "Copied" : "Copy message"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
