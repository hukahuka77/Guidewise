"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useIsDesktop } from "./useMedia";

const STYLES = [
  { name: "Lifestyle", tag: "Power and Pro", src: "/images/home/style-lifestyle.webp", side: -1 },
  { name: "Signature", tag: "Every plan, including Free", src: "/images/home/style-signature.webp", side: 0 },
  { name: "Welcoming", tag: "Power and Pro", src: "/images/home/style-welcoming.webp", side: 1 },
];

/** The guidebook styles, stacked like a hand of cards that fans open as you scroll. */
export default function StyleFan() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const still = !!reduce;

  return (
    <section ref={ref} aria-label="Guidebook styles" className={`relative bg-[#F8F5F1] ${still ? "py-24" : "h-[220vh]"}`}>
      <div className={still ? "" : "sticky top-14 flex h-[calc(100svh-3.5rem)] flex-col justify-center overflow-hidden"}>
        <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-5xl">Pick a look that feels like your place.</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-[#5b524c]">Switch styles anytime. Your content moves with you.</p>
        </div>
        <div className="relative mx-auto mt-10 h-[400px] w-full max-w-5xl sm:h-[470px] lg:h-[520px]">
          {STYLES.map((s) => (
            <Card key={s.name} p={p} still={still} desktop={desktop} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({ p, still, desktop, name, tag, src, side }: { p: MotionValue<number>; still: boolean; desktop: boolean; name: string; tag: string; src: string; side: number }) {
  const spread = desktop ? 300 : 112;
  const open = still ? [1, 1] : [0, 1];
  const t = useTransform(p, [0.12, 0.6], open);
  const x = useTransform(t, [0, 1], [side * 18, side * spread]);
  const rotate = useTransform(t, [0, 1], [side * 4, side * (desktop ? 7 : 9)]);
  const y = useTransform(t, [0, 1], [0, side === 0 ? -10 : 24]);
  const label = useTransform(p, [0.5, 0.66], still ? [1, 1] : [0, 1]);
  return (
    <motion.figure style={{ x, rotate, y, zIndex: side === 0 ? 3 : 1 }} className="absolute left-1/2 top-0 -ml-[86px] w-[172px] sm:-ml-[105px] sm:w-[210px] lg:-ml-[117px] lg:w-[234px]">
      <div className="rounded-[2.2rem] bg-neutral-900 p-[7px] shadow-[0_40px_60px_-30px_rgba(40,25,20,0.6)]">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[1.8rem] bg-white">
          <Image src={src} alt={`The ${name} guidebook style`} fill sizes="240px" className="object-cover object-top" />
        </div>
      </div>
      <motion.figcaption style={{ opacity: label }} className="mt-4 text-center">
        <span className="block text-sm font-semibold text-[#1f1a17]">{name}</span>
        <span className="block text-xs text-[#6f655e]">{tag}</span>
      </motion.figcaption>
    </motion.figure>
  );
}
