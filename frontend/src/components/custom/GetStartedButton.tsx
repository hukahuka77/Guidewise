"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function GetStartedButton() {
  const [href, setHref] = useState<string>("/signup");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) {
        if (mounted) setHref("/signup");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setHref(data.session ? "/create" : "/signup");
      }
    })();
    const subscription = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          setHref(session ? "/create" : "/signup");
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
        Get Started for Free
      </Button>
    </Link>
  );
}
