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
        if (mounted) {
          setHref("/signup");
          setLabel("Get Started for Free");
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setHref(data.session ? "/onboarding" : "/signup");
        setLabel(data.session ? "Create new guidebook" : "Get Started for Free");
      }
    })();
    const subscription = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          setHref(session ? "/onboarding" : "/signup");
          setLabel(session ? "Create new guidebook" : "Get Started for Free");
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
