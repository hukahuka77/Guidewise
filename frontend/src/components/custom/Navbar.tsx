"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Marcellus } from "next/font/google";

const marcellus = Marcellus({ subsets: ["latin"], weight: ["400"] });

export default function Navbar() {
  const [isAuthed, setIsAuthed] = useState(false);
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
      <Link className="flex items-center justify-center" href="/">
        <span className={`${marcellus.className} text-2xl sm:text-3xl text-gray-900 tracking-[0.15em] uppercase leading-none`}>Guidewise</span>
      </Link>
      <nav className="ml-auto flex gap-2 sm:gap-3">
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
    </header>
  );
}
