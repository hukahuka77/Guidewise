/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import QRDownloadButton from "@/components/custom/QRDownloadButton";
import PhonePreview from "@/components/custom/PhonePreview";
import { absoluteUrl } from "@/lib/publicUrl";
import { useQrCode } from "@/hooks/useQrCode";

const card = "rounded-[2rem] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5 sm:p-8";
const pillDark =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1f1a17] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#3a312b]";
const pillLight =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-[#1f1a17] ring-1 ring-[#1f1a17]/15 transition-colors hover:bg-[#faf7f4]";

// Shown after a new guidebook is created and its template chosen. The guidebook is already live.
export default function SuccessPage() {
  const [guidebookId, setGuidebookId] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setGuidebookId(sessionStorage.getItem("guidebookId") || localStorage.getItem("guidebookId"));
    } catch { }
  }, []);

  useEffect(() => {
    if (!guidebookId) return;
    (async () => {
      try {
        const token = (await supabase?.auth.getSession())?.data.session?.access_token || null;
        setAccessToken(token);
        const res = await fetch(`/api/guidebooks/${guidebookId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.public_slug) setLiveUrl(absoluteUrl(`/g/${data.public_slug}`));
        if (typeof data?.property?.name === "string") setPropertyName(data.property.name);
      } catch { }
    })();
  }, [guidebookId]);

  const qrSrc = useQrCode(liveUrl);

  const copy = async () => {
    if (!liveUrl) return;
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  };

  if (!guidebookId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F8F5F1] to-white p-4">
        <div className={`${card} max-w-md text-center`}>
          <p className="text-[15px] text-[#5b524c]">No guidebook found in this session.</p>
          <Link href="/onboarding" className={`${pillDark} mt-5`}>Create a guidebook</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white px-4 py-10 sm:px-6 md:py-14">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 text-center lg:mb-10 lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
            <Check className="size-4" /> Live
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-4xl">
            {propertyName ? <>{propertyName} is ready for guests</> : <>Your guidebook is ready for guests</>}
          </h1>
          <p className="mt-2 text-[15px] text-[#5b524c] sm:text-base">Share the link or print the QR code. Changes you make later show up straight away.</p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
          {/* Share: on wide screens it sits beside the guidebook, so the QR code is visible without scrolling */}
          <section className={`${card} lg:sticky lg:top-8`} aria-labelledby="share-title">
            <h2 id="share-title" className="text-xl font-semibold tracking-[-0.02em] text-[#1f1a17]">Share it with guests</h2>
            <p className="mt-1 text-[15px] text-[#5b524c]">Put the QR code by the door or on the fridge. Guests scan it with their phone camera, no app needed.</p>

            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <div className="shrink-0 rounded-3xl bg-[#FBF8F4] p-4 ring-1 ring-[#ECE5DB]">
                {qrSrc ? (
                  <img src={qrSrc} alt="QR code for your guidebook" className="size-44 rounded-xl bg-white p-2" />
                ) : (
                  <div aria-hidden className="size-44 animate-pulse rounded-xl bg-white" />
                )}
              </div>
              <div className="w-full min-w-0 space-y-3">
                <span className="block text-sm font-medium text-[#3d3530]">Guidebook link</span>
                <div className="flex items-center gap-1 rounded-2xl bg-[#F6F2EE] p-1.5 pl-4">
                  {liveUrl ? (
                    <a href={liveUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-[#1f1a17] hover:underline" title={liveUrl}>
                      {liveUrl.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="h-4 flex-1 animate-pulse rounded bg-white/70" aria-hidden />
                  )}
                  <button type="button" onClick={copy} disabled={!liveUrl} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-[#1f1a17] shadow-sm ring-1 ring-black/5 hover:bg-[#faf7f4] disabled:opacity-50">
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {liveUrl && <QRDownloadButton targetUrl={liveUrl} propertyName={propertyName || "guidebook"} className={`${pillDark} h-10`} />}
                  {liveUrl && (
                    <a href={liveUrl} target="_blank" rel="noreferrer" className={`${pillLight} h-10`}>
                      <ExternalLink className="size-4" /> Open
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 border-t border-[#1f1a17]/5 pt-6">
              <Link href={`/edit/${guidebookId}`} className={pillLight}>
                <Pencil className="size-4" /> Keep editing
              </Link>
              <Link href="/dashboard" className={pillDark}>Go to dashboard</Link>
            </div>
          </section>

          <section aria-label="Your guidebook" className="text-center">
            {/* The owner's copy, so looking at it here never uses up a guest view */}
            <PhonePreview guidebookId={guidebookId} accessToken={accessToken} />
            <p className="mt-4 text-sm text-[#8a7f77]">This is what guests see. Tap around.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
