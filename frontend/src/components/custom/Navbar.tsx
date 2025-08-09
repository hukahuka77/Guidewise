"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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
        <Image src="/Guidewise_logo.png" alt="GuideWise Logo" width={32} height={32} className="mr-2 rounded-full" />
        <span className="text-xl font-bold text-primary">GuideWise</span>
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6">
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#features">
          Features
        </Link>
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#pricing">
          Pricing
        </Link>
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#about">
          About
        </Link>
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#contact">
          Contact
        </Link>
        <span className="mx-1 text-gray-300">|</span>
        {isAuthed ? (
          <>
            <Link className="text-sm font-medium hover:underline underline-offset-4" href="/dashboard">
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
              className="text-sm font-medium hover:underline underline-offset-4"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
              Login
            </Link>
            <Link className="text-sm font-medium hover:underline underline-offset-4" href="/signup">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
