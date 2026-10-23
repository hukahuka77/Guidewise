"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import PhonePreview from "@/components/custom/PhonePreview";

/**
 * Opening scene: the copy on one side, and on the other a real, tappable guidebook in a phone, set in
 * front of a photo of the home. The photo and the phone drift at different rates as the page scrolls (and with the pointer on a computer), so the scene has depth.
 */
export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });

  // Pointer depth: -0.5..0.5 across the scene
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 90, damping: 20 });
  const sy = useSpring(py, { stiffness: 90, damping: 20 });

  const still = !!reduce;
  const photoY = useTransform(p, [0, 1], still ? [0, 0] : [0, 90]);
  const photoScale = useTransform(p, [0, 1], still ? [1, 1] : [1, 1.08]);
  const phoneY = useTransform(p, [0, 1], still ? [0, 0] : [0, -40]);
  const phoneRotate = useTransform(p, [0, 1], still ? [0, 0] : [0, -4]);
  const copyY = useTransform(p, [0, 1], still ? [0, 0] : [0, -70]);
  const copyOpacity = useTransform(p, [0, 0.7], still ? [1, 1] : [1, 0.2]);
  const farX = useTransform(sx, [-0.5, 0.5], still ? [0, 0] : [8, -8]);
  const farY = useTransform(sy, [-0.5, 0.5], still ? [0, 0] : [6, -6]);

  return (
    <section
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
      className="relative overflow-hidden bg-[#F8F5F1]"
    >
      {/* Soft light behind everything */}
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.18),rgba(219,39,119,0.08)_45%,transparent_70%)]" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-20 pt-12 sm:px-6 md:pt-16 lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-2 lg:gap-6 lg:pb-16 lg:pt-10">
        <motion.div style={{ y: copyY, opacity: copyOpacity }} className="relative z-10 text-center lg:text-left">
          <p className="mb-5 text-sm font-medium text-[#be185d]">Digital guidebooks for Airbnb and VRBO hosts</p>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1a17] sm:text-6xl lg:text-[4.25rem]">
            The guidebook your guests <em className="font-semibold italic text-[#db2777]">actually</em> open.
          </h1>
          <p className="mx-auto mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-[#5b524c] lg:mx-0">
            Paste your listing link and Guidewise builds a beautiful guide with Wi-Fi, check-in, house rules and the best spots nearby. Share one link and answer fewer texts.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/onboarding"
              className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-7 text-base font-semibold text-white no-underline shadow-[0_10px_24px_-10px_rgba(219,39,119,0.7)] transition-transform hover:-translate-y-0.5 hover:no-underline"
            >
              Build my guidebook
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium text-[#1f1a17] no-underline ring-1 ring-[#1f1a17]/15 transition-colors hover:bg-white hover:no-underline"
            >
              See pricing
            </Link>
          </div>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-[#5b524c] lg:justify-start">
            <li className="font-semibold text-[#1f1a17]">Free forever</li>
            <li aria-hidden className="text-[#c9bfb6]">·</li>
            <li>No credit card</li>
            <li aria-hidden className="text-[#c9bfb6]">·</li>
            <li>Ready in minutes</li>
          </ul>
        </motion.div>

        <div className="relative mx-auto h-[600px] w-full max-w-[420px] sm:h-[640px] lg:h-[660px]">
          {/* Back plane: the home itself, cut to an arch */}
          <motion.div
            aria-hidden
            style={{ y: photoY, scale: photoScale, x: farX }}
            className="absolute inset-x-6 bottom-10 top-6 overflow-hidden rounded-t-[999px] rounded-b-[2rem] shadow-[0_30px_60px_-30px_rgba(60,40,30,0.45)]"
          >
            <motion.div style={{ y: farY }} className="absolute -inset-6">
              <Image src="/images/home/living-room.webp" alt="" fill priority sizes="420px" className="object-cover" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#1f1a17]/35 via-transparent to-transparent" />
          </motion.div>

          {/* Subject: the live guidebook */}
          <motion.div
            style={{ y: phoneY, rotate: phoneRotate }}
            initial={still ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-0 z-10 flex justify-center"
          >
            <div className="w-[272px] sm:w-[292px]">
              <PhonePreview sampleTemplate="template_signature" className="!max-w-none" />
              <p className="mt-3 text-center text-xs font-medium text-[#5b524c]">A real guidebook. Scroll it, tap it.</p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

