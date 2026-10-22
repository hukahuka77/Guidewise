"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/ui/spinner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface Props {
  /** The guidebook to show; without one a placeholder screen is shown. */
  guidebookId?: string | null;
  accessToken?: string | null;
  /** Change this to re-render the guidebook (after an edit was saved). */
  refreshKey?: number;
  /** Shown over the placeholder while something is being prepared ("Reading your listing…"). */
  message?: string | null;
  className?: string;
}

/**
 * The guidebook in a phone, exactly as guests see it and fully interactive. It renders the owner's copy
 * (`/api/guidebooks/<id>/html`), so previewing never counts as a guest view.
 */
export default function PhonePreview({ guidebookId, accessToken, refreshKey = 0, message, className = "" }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!guidebookId || !accessToken) return;
    let cancelled = false;
    setRefreshing(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/guidebooks/${guidebookId}/html`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        if (!cancelled) {
          setHtml(text);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guidebookId, accessToken, refreshKey]);

  return (
    <div className={`relative mx-auto aspect-[9/19] w-full max-w-[340px] rounded-[2.6rem] bg-neutral-900 p-[10px] shadow-2xl ring-1 ring-black/10 ${className}`}>
      <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-neutral-950">
        {html ? (
          <iframe
            title="Your guidebook"
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <Placeholder message={message} failed={failed} />
        )}
        {refreshing && html && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden bg-black/10">
            <div className="h-full w-1/3 animate-pulse rounded bg-[oklch(0.6923_0.22_21.05)]" />
          </div>
        )}
      </div>
    </div>
  );
}

function Placeholder({ message, failed }: { message?: string | null; failed: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center bg-gradient-to-b from-neutral-800 via-neutral-900 to-black px-6 pt-[34%] text-center text-white">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-900/80 ring-4 ring-teal-400/20">
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-teal-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          <path d="M9 21v-7h6v7" />
        </svg>
      </div>
      <div className="mt-4 h-3 w-40 rounded-full bg-white/20" />
      <div className="mt-10 text-2xl font-semibold">Hello!</div>
      {message ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-white/80">
          <Spinner size={16} colorClass="text-teal-300" />
          <span>{message}</span>
        </div>
      ) : (
        <div className="mt-6 h-10 w-36 rounded-xl bg-teal-900/70" />
      )}
      {failed && <div className="mt-4 text-xs text-red-300">Preview unavailable. It will appear once saved.</div>}
    </div>
  );
}
