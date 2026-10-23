"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check } from "lucide-react";

const INCLUDED = [
  "Unlimited guidebooks",
  "Airbnb and VRBO import",
  "Signature guidebook style",
  "AI local recommendations",
  "30 guest views every month",
  "QR code for your door or fridge",
];

/**
 * The peak: the page turns dark and "Free forever." grows to fill it, then what the free plan includes
 * settles in underneath. The close follows on the same ground.
 */
export default function FreeForever() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const still = !!reduce;

  const bg = useTransform(p, [0.1, 0.32], still ? ["#1a1412", "#1a1412"] : ["#F8F5F1", "#1a1412"]);
  const scale = useTransform(p, [0.18, 0.55], still ? [1, 1] : [0.55, 1]);
  const tracking = useTransform(p, [0.18, 0.55], still ? ["-0.045em", "-0.045em"] : ["0.06em", "-0.045em"]);
  const wordOpacity = useTransform(p, [0.16, 0.3], still ? [1, 1] : [0, 1]);

  return (
    <motion.div style={{ backgroundColor: bg }} className="text-[#f5ede6]">
      <section ref={ref} aria-label="Free forever" className={still ? "py-28" : "h-[230vh]"}>
        <div className={still ? "" : "sticky top-14 flex h-[calc(100svh-3.5rem)] items-center overflow-hidden"}>
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <motion.h2
              style={{ scale, letterSpacing: tracking, opacity: wordOpacity }}
              className="origin-left text-[3.75rem] font-semibold leading-[0.92] min-[400px]:text-[4.5rem] sm:text-[7rem] lg:text-[10rem]"
            >
              Free
              <br />
              <span className="text-[#ff7a59]">forever.</span>
            </motion.h2>
            <div className="mt-10 grid grid-cols-1 gap-10 lg:mt-14 lg:grid-cols-[1fr_1.2fr] lg:items-end">
              <Reveal p={p} at={0.55} still={still}>
                <p className="max-w-md text-lg leading-relaxed text-[#cfc3b9]">
                  Not a trial. No credit card. Build your guidebook, share it with guests and keep it as long as you host. Upgrade only if you want more.
                </p>
              </Reveal>
              <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {INCLUDED.map((item, i) => (
                  <Reveal key={item} p={p} at={0.58 + i * 0.035} still={still} as="li">
                    <span className="flex items-center gap-3 text-[15px] text-[#f5ede6]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ff7a59] text-[#1a1412]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {item}
                    </span>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Get started" className="px-4 pb-28 pt-10 sm:px-6 lg:pb-36">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 border-t border-white/10 pt-16 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.03em] sm:text-5xl">Your next guest is already packing.</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding"
              className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-7 text-base font-semibold text-white no-underline shadow-[0_12px_28px_-12px_rgba(249,115,22,0.8)] transition-transform hover:-translate-y-0.5 hover:no-underline"
            >
              Build my guidebook
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium text-[#f5ede6] no-underline ring-1 ring-white/25 transition-colors hover:bg-white/10 hover:no-underline"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

function Reveal({ p, at, still, as = "div", children }: { p: MotionValue<number>; at: number; still: boolean; as?: "div" | "li"; children: React.ReactNode }) {
  const opacity = useTransform(p, [at, at + 0.06], still ? [1, 1] : [0, 1]);
  const y = useTransform(p, [at, at + 0.06], still ? [0, 0] : [16, 0]);
  const Tag = as === "li" ? motion.li : motion.div;
  return <Tag style={{ opacity, y }}>{children}</Tag>;
}
