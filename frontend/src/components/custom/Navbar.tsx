"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Marcellus } from "next/font/google";

const marcellus = Marcellus({ subsets: ["latin"], weight: ["400"] });

export default function Navbar() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return; // auth disabled; keep defaults (no dashboard link)
      const { data } = await supabase.auth.getSession();
      if (mounted) setIsAuthed(!!data.session);
    })();
    const sub = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      mounted = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full px-4 lg:px-6 h-14 flex items-center bg-white shadow-sm">
      <Link className="flex items-center justify-center" href="/" onClick={() => setMobileOpen(false)}>
        <span className={`${marcellus.className} text-2xl sm:text-3xl text-gray-900 tracking-[0.15em] uppercase leading-none`}>Guidewise</span>
      </Link>

      {/* Desktop nav */}
      <nav className="ml-auto hidden md:flex gap-2 sm:gap-3">
        <Link className="text-sm font-medium no-underline hover:no-underline px-3 py-1 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors" href="/#digital">
          Features
        </Link>
        <Link className="text-sm font-medium no-underline hover:no-underline px-3 py-1 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors" href="/#contact">
          Contact
        </Link>
        <span className="mx-1 text-gray-300">|</span>
        {isAuthed ? (
          <>
            <Link className="text-sm font-medium no-underline hover:no-underline px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors" href="/dashboard">
              Dashboard
            </Link>
            <button
              onClick={async () => {
                try {
                  await supabase?.auth.signOut();
                } finally {
                  router.push("/");
                }
              }}
              className="text-sm font-medium no-underline hover:no-underline px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className="text-sm font-medium no-underline hover:no-underline px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors" href="/login">
              Login
            </Link>
            <Link className="text-sm font-medium no-underline hover:no-underline px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors" href="/signup">
              Sign up
            </Link>
          </>
        )}
      </nav>

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
            <Link href="/#digital" className="px-3 py-2 rounded hover:bg-pink-50 hover:text-pink-700" onClick={() => setMobileOpen(false)}>
              Features
            </Link>
            <Link href="/#contact" className="px-3 py-2 rounded hover:bg-pink-50 hover:text-pink-700" onClick={() => setMobileOpen(false)}>
              Contact
            </Link>
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
                <Link href="/signup" className="px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMobileOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
