"use client";

import { useEffect, useRef, useState } from "react";

// The phone frame shows the page like a phone does: no desktop scrollbar down the side. Guests on a
// computer still get their normal scrollbar, because this is only added to the preview.
const HIDE_SCROLLBAR_CSS = "html{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}";

const SCROLL_MESSAGE = "guidewise-preview-scroll";

/**
 * The sandboxed frame is another origin, so the parent cannot read its scroll position. This reports it
 * (throttled) and, when the frame is replaced after a save, puts the reader back where they were, unless they
 * already started scrolling. "instant" because the guidebook's own CSS asks for smooth scrolling.
 */
function scrollKeeper(top: number): string {
  return `<script data-preview>(function(){var t=${Math.max(0, Math.round(top))},m=0,p=0;` +
    `function go(){if(t&&!m&&Math.abs(scrollY-t)>2)scrollTo({top:t,behavior:"instant"})}` +
    `["wheel","touchstart","keydown","pointerdown"].forEach(function(e){addEventListener(e,function(){m=1},{once:true,passive:true})});` +
    `addEventListener("DOMContentLoaded",go);addEventListener("load",go);` +
    `addEventListener("scroll",function(){if(p)return;p=setTimeout(function(){p=0;parent.postMessage({type:"${SCROLL_MESSAGE}",top:scrollY},"*")},150)},{passive:true})})()</script>`;
}

function withoutScrollbar(html: string, scrollTop = 0): string {
  const tag = `<style data-preview>${HIDE_SCROLLBAR_CSS}</style>${scrollKeeper(scrollTop)}`;
  return html.includes("</head>") ? html.replace("</head>", `${tag}</head>`) : tag + html;
}

/** For the same-origin sample page, which is loaded by URL rather than as srcDoc. */
function hideScrollbar(frame: HTMLIFrameElement) {
  try {
    const doc = frame.contentDocument;
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
  /** Render this URL's HTML instead of the owner's copy (no token needed, e.g. a gift link). */
  htmlUrl?: string | null;
  /** Scroll the sample down a little and back once it is on screen, to show that it scrolls. */
  peek?: boolean;
  className?: string;
}

/**
 * Once the sample is on screen, glide it down and back up so visitors can see it is a real page they can
 * scroll. Stops at once if the visitor touches it, and never runs for people who prefer reduced motion.
 */
function peekOnce(frame: HTMLIFrameElement) {
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let stopped = false;
  const timers: number[] = [];
  const stop = () => {
    stopped = true;
    timers.forEach((t) => window.clearTimeout(t));
  };
  for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) doc.addEventListener(type, stop, { once: true, passive: true });
  const glide = () => {
    if (stopped) return;
    win.scrollTo({ top: Math.min(420, doc.documentElement.scrollHeight / 3), behavior: "smooth" });
    timers.push(window.setTimeout(() => !stopped && win.scrollTo({ top: 0, behavior: "smooth" }), 1500));
  };
  const seen = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      timers.push(window.setTimeout(glide, 1200));
    },
    { threshold: 0.6 },
  );
  seen.observe(frame);
}

/**
 * The guidebook in a phone, exactly as guests see it and fully interactive. It renders the owner's copy
 * (`/api/guidebooks/<id>/html`), so previewing never counts as a guest view.
 */
export default function PhonePreview({ guidebookId, accessToken, refreshKey = 0, message, sampleTemplate, htmlUrl, peek = false, className = "" }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const peeked = useRef(false);
  const sampleRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Where the reader was, per guidebook, so a refresh after a save keeps their place (a different guidebook starts at the top)
  const shown = useRef<string | null>(null);
  const scroll = useRef<{ key: string | null; top: number }>({ key: null, top: 0 });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only this preview's own frame can move it
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const data = e.data as { type?: unknown; top?: unknown } | null;
      if (data?.type === SCROLL_MESSAGE && typeof data.top === "number" && Number.isFinite(data.top)) scroll.current = { key: shown.current, top: data.top };
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const sampleReady = (frame: HTMLIFrameElement) => {
    hideScrollbar(frame);
    if (!peek || peeked.current) return;
    peeked.current = true;
    try {
      peekOnce(frame);
    } catch {
      // Not same-origin: no peek
    }
  };

  // On a server-rendered page the sample can finish loading before React attaches onLoad
  useEffect(() => {
    const frame = sampleRef.current;
    if (frame?.contentDocument?.readyState === "complete" && frame.contentWindow?.location.href !== "about:blank") sampleReady(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!htmlUrl && (!guidebookId || !accessToken)) return;
    let cancelled = false;
    setRefreshing(true);
    (async () => {
      try {
        const res = htmlUrl
          ? await fetch(htmlUrl)
          : await fetch(`/api/guidebooks/${guidebookId}/html`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        if (!cancelled) {
          // Built once per fetch rather than on every render, so the frame only reloads with a new copy
          const key = htmlUrl || guidebookId || null;
          shown.current = key;
          setHtml(withoutScrollbar(text, scroll.current.key === key ? scroll.current.top : 0));
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
  }, [guidebookId, accessToken, refreshKey, htmlUrl]);

  return (
    <div className={`relative mx-auto aspect-[9/19] w-full max-w-[340px] rounded-[2.6rem] bg-neutral-900 p-[10px] shadow-2xl ring-1 ring-black/10 ${className}`}>
      <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-neutral-950">
        {html ? (
          <iframe
            // Its own element (key) with the sandbox set before srcDoc: sandbox flags only apply on navigation, and
            // without allow-same-origin srcDoc would run the guidebook's scripts as this site, with the host's session
            key="guidebook"
            ref={frameRef}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            title="Your guidebook"
            srcDoc={html}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <iframe
            key="sample"
            title="Sample guidebook"
            src={`/sample-guidebook${sampleTemplate ? `?template=${encodeURIComponent(sampleTemplate)}` : ""}`}
            ref={sampleRef}
            onLoad={(e) => sampleReady(e.currentTarget)}
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
