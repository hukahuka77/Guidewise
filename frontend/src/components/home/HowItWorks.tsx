"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check, Link2, Loader2, Sparkles } from "lucide-react";
import { useIsDesktop } from "./useMedia";

const STEPS = [
  {
    title: "Paste your listing link.",
    body: "Airbnb or VRBO. Guidewise reads your listing's details, photos and location, so you never start from a blank page.",
    Visual: PasteVisual,
  },
  {
    title: "Watch it fill itself in.",
    body: "Check-in, Wi-Fi, house rules and checkout, plus restaurants and things to do nearby with photos and drive times. Change anything you like.",
    Visual: FillVisual,
  },
  {
    title: "Share one link.",
    body: "Drop it in your welcome message or print the QR poster for the fridge. Edit anytime and every guest sees the latest version.",
    Visual: ShareVisual,
  },
];

/** How it works, as a sideways journey on a computer (the page scrolls, the steps travel) and a simple stack on phones. */
export default function HowItWorks() {
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  return desktop && !reduce ? <Panorama /> : <Stack />;
}

function Intro() {
  return (
    <h2 className="text-balance text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-4xl">
      From listing to guidebook in three moves.
    </h2>
  );
}

function Panorama() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.08, 0.92], ["0vw", "-200vw"]);
  const bar = useTransform(scrollYProgress, [0.08, 0.92], [0, 1]);
  return (
    <section id="how" ref={ref} className="relative h-[320vh] scroll-mt-14 bg-[#F8F5F1]">
      <div className="sticky top-14 flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-6 pt-12">
          <Intro />
          <div className="mt-5 h-[3px] w-48 overflow-hidden rounded-full bg-[#1f1a17]/10">
            <motion.div style={{ scaleX: bar }} className="h-full origin-left bg-[#db2777]" />
          </div>
        </div>
        <motion.div style={{ x }} className="flex flex-1 items-center">
          {STEPS.map(({ title, body, Visual }) => (
            <div key={title} className="w-screen shrink-0">
              <div className="mx-auto grid max-w-6xl grid-cols-[1fr_1.1fr] items-center gap-16 px-6">
                <div>
                  <h3 className="text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1a17]">{title}</h3>
                  <p className="mt-5 max-w-md text-lg leading-relaxed text-[#5b524c]">{body}</p>
                </div>
                <Visual />
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section id="how" className="scroll-mt-14 bg-[#F8F5F1] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-xl">
        <Intro />
        <div className="mt-12 space-y-20">
          {STEPS.map(({ title, body, Visual }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17]">{title}</h3>
              <p className="mt-3 text-base leading-relaxed text-[#5b524c]">{body}</p>
              <div className="mt-8">
                <Visual />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto w-full max-w-[460px] rounded-[1.75rem] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(60,40,30,0.45)] ring-1 ring-black/5">
    {children}
  </div>
);

const LINK = "airbnb.com/rooms/48213907";

function PasteVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setN(0);
    const id = setInterval(() => setN((v) => (v >= LINK.length ? v : v + 1)), 55);
    return () => clearInterval(id);
  }, [inView]);
  const done = n >= LINK.length;
  return (
    <div ref={ref}>
      <Panel>
        <p className="text-sm font-medium text-[#1f1a17]">Your Airbnb or VRBO link</p>
        <div className="mt-3 flex h-12 items-center gap-2 rounded-xl bg-[#f6f2ee] px-4 text-[15px] text-[#1f1a17]">
          <Link2 className="h-4 w-4 shrink-0 text-[#8a7f77]" />
          <span className="truncate">https://{LINK.slice(0, n)}</span>
          {!done && <span className="h-5 w-[2px] animate-pulse bg-[#db2777]" />}
        </div>
        <div
          className={`mt-4 flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] text-sm font-semibold text-white transition-transform duration-300 ${done ? "scale-100" : "scale-95 opacity-60"}`}
        >
          Build my guidebook
        </div>
      </Panel>
    </div>
  );
}

const FILLS = [
  { label: "Check-in and access", value: "3:00 PM · door code by message" },
  { label: "Wi-Fi", value: "WillowCottage" },
  { label: "House rules", value: "Quiet hours, no smoking" },
  { label: "Places to eat", value: "The Corner Bakery, Lantern Kitchen" },
  { label: "Things to do", value: "Riverside Trail, farmers market" },
];

function FillVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setN(0);
    const id = setInterval(() => setN((v) => (v > FILLS.length ? v : v + 1)), 520);
    return () => clearInterval(id);
  }, [inView]);
  return (
    <div ref={ref}>
      <Panel>
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[#1f1a17]">
          <Sparkles className="h-4 w-4 text-[#db2777]" />
          {n > FILLS.length ? "Your guidebook is ready" : "Building Willow Cottage…"}
        </div>
        <ul className="space-y-2">
          {FILLS.map((f, i) => {
            const state = n > i + 1 ? "done" : n === i + 1 ? "busy" : "wait";
            return (
              <li key={f.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-500 ${state === "wait" ? "bg-[#f6f2ee]/60" : "bg-[#f6f2ee]"}`}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {state === "done" ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : state === "busy" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#db2777]" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[#d6cdc5]" />
                  )}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[13px] font-semibold text-[#1f1a17]">{f.label}</span>
                  <span className={`block text-xs text-[#6f655e] transition-opacity duration-500 ${state === "done" ? "opacity-100" : "opacity-0"}`}>{f.value}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function ShareVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  return (
    <div ref={ref} className="relative mx-auto h-[360px] w-full max-w-[460px]">
      <motion.div
        animate={inView ? { rotate: -6, x: 0, opacity: 1 } : { rotate: 0, x: 40, opacity: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-2 top-0 w-[220px] overflow-hidden rounded-2xl bg-white shadow-[0_30px_50px_-25px_rgba(60,40,30,0.5)] ring-1 ring-black/5"
      >
        <Image src="/images/home/qr-poster.webp" alt="A printable QR code poster for a guidebook" width={700} height={907} className="h-auto w-full" />
      </motion.div>
      <motion.div
        animate={inView ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-6 right-0 w-[280px] rounded-2xl bg-white p-4 shadow-[0_30px_50px_-25px_rgba(60,40,30,0.5)] ring-1 ring-black/5"
      >
        <p className="text-xs font-medium text-[#8a7f77]">Welcome message</p>
        <p className="mt-1.5 text-sm leading-snug text-[#1f1a17]">
          Hi Sam! Everything for your stay is here: <span className="break-all font-medium text-[#db2777]">guidewiseapp.com/g/willow-cottage</span>
        </p>
        <motion.span
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
        >
          <Check className="h-3 w-3" strokeWidth={3} /> Link copied
        </motion.span>
      </motion.div>
    </div>
  );
}
