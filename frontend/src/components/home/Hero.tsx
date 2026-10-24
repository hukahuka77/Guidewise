"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Check, Hand, Sparkles } from "lucide-react";
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
          <p className="mb-5 text-sm font-medium text-[#be185d]">Digital guidebooks for short-term rental hosts</p>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1a17] sm:text-6xl lg:text-[4.25rem]">
            The guidebook your guests <em className="font-semibold italic text-[#db2777]">actually</em> open.
          </h1>
          <p className="mx-auto mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-[#5b524c] lg:mx-0">
            Paste your listing link and Guidewise builds a beautiful guide with Wi-Fi, check-in, house rules and the best spots nearby. Share one link and answer fewer texts.
          </p>
          <div className="mt-10 flex justify-center lg:justify-start">
            <Link
              href="/onboarding"
              className="group relative inline-flex h-16 w-full max-w-sm items-center justify-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-10 text-lg font-semibold text-white no-underline shadow-[0_18px_40px_-14px_rgba(219,39,119,0.8)] ring-4 ring-[#db2777]/10 transition-all duration-200 hover:-translate-y-0.5 hover:no-underline hover:shadow-[0_24px_48px_-14px_rgba(219,39,119,0.9)] sm:w-auto sm:text-xl"
            >
              {/* A slow sheen across the button */}
              {!still && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  animate={{ x: ["0%", "450%"] }}
                  transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.2, delay: 1.2 }}
                />
              )}
              <Sparkles className="relative size-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
              <span className="relative">Build my free guidebook</span>
            </Link>
          </div>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
            {["Free forever", "No credit card", "Ready in minutes"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-base font-semibold text-[#1f1a17]">
                <span className="grid size-6 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="relative mx-auto mt-4 h-[640px] w-full max-w-[420px] sm:h-[690px] lg:mt-0 lg:h-[700px]">
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
            <div className="relative w-[272px] sm:w-[292px]">
              {/* A soft glow that pulses a few times to draw the eye to the live phone */}
              {!still && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-[2.9rem]"
                  initial={{ boxShadow: "0 0 0 0 rgba(219,39,119,0)" }}
                  animate={{ boxShadow: ["0 0 0 0 rgba(219,39,119,0.45)", "0 0 0 18px rgba(219,39,119,0)"] }}
                  transition={{ duration: 1.8, ease: "easeOut", repeat: 4, delay: 1.4 }}
                />
              )}
              {/* Sits on the top bezel, like a notch, so it never covers the guidebook */}
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
                <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#1f1a17] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white shadow-lg ring-2 ring-white">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  Live demo
                </span>
              </div>
              <PhonePreview sampleTemplate="template_signature" peek className="!max-w-none" />
              <p className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1f1a17] shadow-[0_10px_24px_-14px_rgba(60,40,30,0.5)] ring-1 ring-black/5">
                <Hand className="size-4 text-[#db2777]" />
                Try it: scroll and tap around
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

