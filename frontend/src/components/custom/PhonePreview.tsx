"use client";

import { useEffect, useState } from "react";

// The phone frame shows the page like a phone does: no desktop scrollbar down the side. Guests on a
// computer still get their normal scrollbar, because this is only added to the preview.
const HIDE_SCROLLBAR_CSS = "html{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}";

function withoutScrollbar(html: string): string {
  const tag = `<style data-preview>${HIDE_SCROLLBAR_CSS}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${tag}</head>`) : tag + html;
}

/** For the same-origin sample page, which is loaded by URL rather than as srcDoc. */
function hideScrollbarOnLoad(e: React.SyntheticEvent<HTMLIFrameElement>) {
  try {
    const doc = e.currentTarget.contentDocument;
    if (!doc || doc.querySelector("style[data-preview]")) return;
    const style = doc.createElement("style");
    style.setAttribute("data-preview", "");
    style.textContent = HIDE_SCROLLBAR_CSS;
    doc.head.appendChild(style);
  } catch {
    // Not same-origin: leave it as is
  }
}
import Spinner from "@/components/ui/spinner";

interface Props {
  /** The guidebook to show; without one a placeholder screen is shown. */
  guidebookId?: string | null;
  accessToken?: string | null;
  /** Change this to re-render the guidebook (after an edit was saved). */
  refreshKey?: number;
  /** Shown over the sample while something is being prepared ("Reading your listing…"). */
  message?: string | null;
  /** Style of the sample guidebook shown before the host has one. */
  sampleTemplate?: string;
  className?: string;
}

/**
 * The guidebook in a phone, exactly as guests see it and fully interactive. It renders the owner's copy
 * (`/api/guidebooks/<id>/html`), so previewing never counts as a guest view.
 */
export default function PhonePreview({ guidebookId, accessToken, refreshKey = 0, message, sampleTemplate, className = "" }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!guidebookId || !accessToken) return;
    let cancelled = false;
    setRefreshing(true);
    (async () => {
      try {
        const res = await fetch(`/api/guidebooks/${guidebookId}/html`, {
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
            // Its own element (key) with the sandbox set before srcDoc: sandbox flags only apply on navigation, and
            // without allow-same-origin srcDoc would run the guidebook's scripts as this site, with the host's session
            key="guidebook"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            title="Your guidebook"
            srcDoc={withoutScrollbar(html)}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <iframe
            key="sample"
            title="Sample guidebook"
            src={`/sample-guidebook${sampleTemplate ? `?template=${encodeURIComponent(sampleTemplate)}` : ""}`}
            onLoad={hideScrollbarOnLoad}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="h-full w-full border-0 bg-white"
          />
        )}
        {!html && (message || (guidebookId && refreshing && !failed)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-8 text-center text-white backdrop-blur-[2px]">
            <Spinner size={28} colorClass="text-white" />
            <span className="text-base font-medium">{message || "Loading your guidebook…"}</span>
          </div>
        )}
        {!html && !message && failed && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-xs text-white">
            Preview unavailable. It will appear once saved.
          </div>
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
