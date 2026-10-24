"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { claimInBackground, isGuestSession } from "@/lib/guest";
import { cacheClear } from "@/lib/cache";
import { useRouter } from "next/navigation";
import { Marcellus } from "next/font/google";

const marcellus = Marcellus({ subsets: ["latin"], weight: ["400"] });

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return; // auth disabled; keep defaults (no dashboard link)
      const { data } = await supabase.auth.getSession();
      if (mounted) setIsAuthed(!!data.session && !isGuestSession(data.session));
    })();
    const sub = supabase?.auth.onAuthStateChange((event, session) => {
      // Guests (trying Guidewise before signing up) see the signed-out menu
      setIsAuthed(!!session && !isGuestSession(session));
      // Signed in after building a guidebook as a guest: move it into the account, wherever they landed
      if (event === "SIGNED_IN" && session && !isGuestSession(session)) claimInBackground();
      // The account's guidebooks and profile are cached in memory: never show them to whoever signs in next
      if (event === "SIGNED_OUT") cacheClear();
    });
    return () => {
      mounted = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  const navLink = "text-sm font-medium text-gray-700 no-underline hover:no-underline px-3 py-1.5 rounded-full hover:bg-pink-50 hover:text-pink-700 transition-colors";

  return (
    <header className="sticky top-0 z-50 w-full px-4 lg:px-6 h-14 flex items-center md:grid md:grid-cols-[1fr_auto_1fr] bg-white/90 backdrop-blur border-b border-black/5">
      <Link className="flex items-center justify-self-start" href="/" onClick={() => setMobileOpen(false)}>
        <span className={`${marcellus.className} text-2xl sm:text-3xl text-gray-900 tracking-[0.15em] uppercase leading-none`}>Guidewise</span>
      </Link>

      {/* Desktop nav, centred on the page */}
      <nav className="hidden md:flex items-center gap-1" aria-label="Main">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} className={navLink} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="hidden md:flex items-center justify-self-end gap-1">
        {isAuthed ? (
          <>
            <Link className={navLink} href="/dashboard">
              Dashboard
            </Link>
            <button
              onClick={async () => {
                try {
                  await supabase?.auth.signOut();
                } finally {
                  cacheClear();
                  router.push("/");
                }
              }}
              className={navLink}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className={navLink} href="/login">
              Login
            </Link>
            <Link
              className="rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-4 py-1.5 text-sm font-semibold text-white no-underline shadow-[0_8px_20px_-10px_rgba(219,39,119,0.8)] transition-all hover:-translate-y-px hover:no-underline hover:shadow-[0_10px_24px_-10px_rgba(219,39,119,0.9)]"
              href="/onboarding"
            >
              Build guidebook
            </Link>
          </>
        )}
      </div>

      {/* Mobile hamburger */}
      <button
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        className="ml-auto md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100"
        onClick={() => setMobileOpen((v) => !v)}
     >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          {mobileOpen ? (
            <path fillRule="evenodd" d="M6.225 4.811a1 1 0 011.414 0L12 9.172l4.361-4.361a1 1 0 111.414 1.414L13.414 10.586l4.361 4.361a1 1 0 01-1.414 1.414L12 12l-4.361 4.361a1 1 0 01-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 010-1.414z" clipRule="evenodd" />
          ) : (
            <path fillRule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75z" clipRule="evenodd" />
          )}
        </svg>
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="absolute top-14 inset-x-0 bg-white border-b shadow-md md:hidden">
          <div className="px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="px-3 py-2 rounded hover:bg-pink-50 hover:text-pink-700" onClick={() => setMobileOpen(false)}>
                {l.label}
              </Link>
            ))}
            <div className="my-1 border-t" />
            {isAuthed ? (
              <>
                <Link href="/dashboard" className="px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <button
                  onClick={async () => {
                    try {
                      await supabase?.auth.signOut();
                    } finally {
                      cacheClear();
                      setMobileOpen(false);
                      router.push("/");
                    }
                  }}
                  className="text-left px-3 py-2 rounded hover:bg-gray-100"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMobileOpen(false)}>
                  Login
                </Link>
                <Link href="/onboarding" className="mt-1 rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-4 py-2.5 text-center font-semibold text-white no-underline hover:no-underline" onClick={() => setMobileOpen(false)}>
                  Build guidebook
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
