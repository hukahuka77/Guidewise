"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function GetStartedButton() {
  const [href, setHref] = useState<string>("/signup");
  const [label, setLabel] = useState<string>("Get Started for Free");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) {
        if (mounted) setHref("/signup");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        const isLoggedIn = Boolean(data.session);
        setHref(isLoggedIn ? "/create" : "/signup");
        setLabel(isLoggedIn ? "Create New Guidebook" : "Get Started for Free");
      }
    })();
    const subscription = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          const isLoggedIn = Boolean(session);
          setHref(isLoggedIn ? "/create" : "/signup");
          setLabel(isLoggedIn ? "Create New Guidebook" : "Get Started for Free");
        }).data.subscription
      : { unsubscribe: () => {} };
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Link href={href} className="z-10">
      <Button className="text-xl md:text-2xl px-10 md:px-14 py-6 md:py-8 rounded-2xl font-semibold shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground">
        {label}
      </Button>
    </Link>
  );
}
