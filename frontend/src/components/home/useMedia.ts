"use client";

import { useEffect, useState } from "react";

/** Whether a media query matches. False on the server and the first render, so layouts start mobile-first. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const useIsDesktop = () => useMedia("(min-width: 1024px)");
