"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import PhonePreview from "@/components/custom/PhonePreview";
import { addClaimTicket } from "@/lib/guest";
import { authLink, authPrimary } from "@/components/custom/AuthShell";

const PERKS = ["Free forever, no credit card", "Edit anything, add your own tips", "Share one link or print the QR poster"];

/** A guidebook built for a host from their listing (outreach). Signing up claims it. */
export default function GiftPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = use(params);
  const router = useRouter();
  const [gift, setGift] = useState<{ property_name: string | null; host_name: string | null } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // An admin's own look from the Admin tab (?preview=1) isn't counted as the host opening it
    const preview = new URLSearchParams(window.location.search).get("preview") === "1" ? "?preview=1" : "";
    fetch(`/api/gift/${encodeURIComponent(ticket)}${preview}`)
      .then(async (res) => (res.ok ? setGift(await res.json()) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [ticket]);

  const claim = (path: string) => {
    addClaimTicket(ticket);
    router.push(path);
  };

  if (missing) {
    return (
      <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center bg-[#F8F5F1] px-4">
        <div className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-[0_30px_60px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#1f1a17]">This link has expired or was already used</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5b524c]">You can still build your own guidebook from your listing in about two minutes.</p>
          <Link href="/onboarding" className={`${authPrimary} mt-6 no-underline hover:no-underline`}>Build my guidebook</Link>
        </div>
      </main>
    );
  }

  const first = gift?.host_name?.split(" ")[0];
  return (
    <main className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-[#F8F5F1]">
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#db2777]">{first ? `For ${first}` : "Made for you"}</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-[#1f1a17] sm:text-5xl">
            {gift?.property_name ? `Your guidebook for ${gift.property_name} is ready.` : "Your guidebook is ready."}
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[#5b524c]">
            We built it from your listing: check-in, Wi-Fi, house rules, and places to eat and things to do nearby. Try it on the phone, then make it yours.
          </p>
          <ul className="mt-6 space-y-2.5">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-[15px] text-[#1f1a17]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#db2777]/10 text-[#db2777]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
          <div className="mt-8 max-w-sm">
            <button type="button" disabled={!gift} onClick={() => claim("/signup?save=1")} className={authPrimary}>
              Make it mine, free
            </button>
            <p className="mt-4 text-center text-sm text-[#5b524c]">
              Already have an account?{" "}
              <button type="button" disabled={!gift} onClick={() => claim("/login?save=1")} className={authLink}>
                Log in to save it
              </button>
            </p>
          </div>
        </div>
        <PhonePreview htmlUrl={gift ? `/api/gift/${encodeURIComponent(ticket)}/html` : null} message={gift ? null : "Loading your guidebook…"} />
      </div>
    </main>
  );
}
