"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isGuestSession } from "@/lib/guest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GetStartedButtonProps {
  labelWhenLoggedOut?: string;
  labelWhenLoggedIn?: string;
  buttonClassName?: string;
}

export default function GetStartedButton({
  labelWhenLoggedOut = "Get Started for Free",
  labelWhenLoggedIn = "Create new guidebook",
  buttonClassName,
}: GetStartedButtonProps) {
  // Anyone can build a guidebook straight away; an account is only needed to save it
  const href = "/onboarding";
  const [label, setLabel] = useState<string>(labelWhenLoggedOut);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) {
        if (mounted) setLabel(labelWhenLoggedOut);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        const authed = !!data.session && !isGuestSession(data.session);
        setLabel(authed ? labelWhenLoggedIn : labelWhenLoggedOut);
      }
    })();
    const subscription = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          const authed = !!session && !isGuestSession(session);
          setLabel(authed ? labelWhenLoggedIn : labelWhenLoggedOut);
        }).data.subscription
      : { unsubscribe: () => {} };
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [labelWhenLoggedIn, labelWhenLoggedOut]);

  return (
    <Link href={href} className="z-10">
      <Button className={cn("text-xl md:text-2xl px-10 md:px-14 py-6 md:py-8 rounded-2xl font-semibold shadow-lg", buttonClassName)}>
        {label}
      </Button>
    </Link>
  );
}
