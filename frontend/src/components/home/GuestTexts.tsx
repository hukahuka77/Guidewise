"use client";

import { useRef } from "react";
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Car, Check, Clock, Coffee, Thermometer, Wifi } from "lucide-react";
import { useIsDesktop } from "./useMedia";

const TEXTS = [
  { q: "Hi! What's the Wi-Fi password?", at: "9:42 PM" },
  { q: "Where should we park?", at: "9:58 PM" },
  { q: "How do we turn the heat up? It's freezing in here", at: "11:07 PM" },
  { q: "Any good breakfast nearby?", at: "7:15 AM" },
  { q: "So sorry, what time is checkout again?", at: "8:30 AM" },
];

const ANSWERS = [
  { icon: Wifi, label: "Wi-Fi", value: "Password welcome2024" },
  { icon: Car, label: "Parking", value: "Two spots in the driveway" },
  { icon: Thermometer, label: "Heating", value: "Thermostat in the hallway" },
  { icon: Coffee, label: "Breakfast", value: "Corner Bakery, 4 min away" },
  { icon: Clock, label: "Checkout", value: "By 11:00 AM" },
];

// Scroll timeline (0..1 across the section): the texts pile up, a beat of quiet, then each one is
// pulled into the guidebook and its answer lights up.
const arrive = (i: number) => [0.04 + i * 0.085, 0.1 + i * 0.085];
const resolve = (i: number) => [0.56 + i * 0.055, 0.64 + i * 0.055];

/**
 * The signature moment: the late-night guest texts every host knows, arriving one by one as you scroll,
 * then folding into a single guidebook link that answers all of them.
 */
export default function GuestTexts() {
  const reduce = useReducedMotion();
  return reduce ? <StillVersion /> : <ScrollVersion />;
}

function ScrollVersion() {
  const ref = useRef<HTMLElement>(null);
  const desktop = useIsDesktop();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <section ref={ref} aria-label="Fewer guest texts" className="relative h-[360vh] bg-white">
      <div className="sticky top-14 flex h-[calc(100svh-3.5rem)] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <Headline p={p} />
          <div className="relative grid min-h-[420px] place-items-center lg:grid-cols-2 lg:gap-6">
            <Thread p={p} desktop={desktop} />
            <GuideCard p={p} desktop={desktop} className="col-start-1 row-start-1 lg:col-start-2" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Headline({ p }: { p: MotionValue<number> }) {
  const a = useTransform(p, [0.5, 0.56], [1, 0]);
  const ay = useTransform(p, [0.5, 0.56], [0, -16]);
  const b = useTransform(p, [0.58, 0.64], [0, 1]);
  const by = useTransform(p, [0.58, 0.64], [16, 0]);
  return (
    <div className="relative grid text-center lg:text-left">
      <motion.div style={{ opacity: a, y: ay }} className="col-start-1 row-start-1">
        <h2 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-[#1f1a17] sm:text-5xl">
          It&apos;s 11:07 pm. Your phone buzzes again.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-[#5b524c] lg:mx-0">Same questions, every stay, at every hour.</p>
      </motion.div>
      <motion.div style={{ opacity: b, y: by }} className="col-start-1 row-start-1">
        <h2 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-[#1f1a17] sm:text-5xl">
          Now they just open the guide.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-[#5b524c] lg:mx-0">Every answer, in one link, before they think to ask.</p>
      </motion.div>
    </div>
  );
}

function Bubble({ p, i, q, at, desktop }: { p: MotionValue<number>; i: number; q: string; at: string; desktop: boolean }) {
  const [a0, a1] = arrive(i);
  const [r0, r1] = resolve(i);
  const opacity = useTransform(p, [a0, a1, r0, r1], [0, 1, 1, 0]);
  const y = useTransform(p, [a0, a1, r0, r1], [18, 0, 0, desktop ? 0 : 70]);
  const x = useTransform(p, [r0, r1], [0, desktop ? 220 : 0]);
  const scale = useTransform(p, [a0, a1, r0, r1], [0.92, 1, 1, 0.55]);
  return (
    <motion.div style={{ opacity, y, x, scale }} className="flex items-end gap-2 origin-right">
      <div className="min-w-0 max-w-[80%] rounded-2xl rounded-bl-md bg-[#efeae6] px-4 py-2.5 text-[15px] leading-snug text-[#1f1a17]">{q}</div>
      <span className="shrink-0 whitespace-nowrap pb-1 text-[11px] text-[#a0958d]">{at}</span>
    </motion.div>
  );
}

// On phones the card takes the thread's place, so the thread clears out before the card arrives;
// on a computer the texts fly across into the card beside them.
function Thread({ p, desktop }: { p: MotionValue<number>; desktop: boolean }) {
  const opacity = useTransform(p, [0.5, 0.55], [1, desktop ? 1 : 0]);
  return (
    <motion.div style={{ opacity }} className="col-start-1 row-start-1 flex w-full max-w-[340px] flex-col gap-2.5 lg:max-w-none">
      <ThreadLabel p={p} />
      {TEXTS.map((t, i) => (
        <Bubble key={t.q} p={p} i={i} desktop={desktop} {...t} />
      ))}
    </motion.div>
  );
}

function ThreadLabel({ p }: { p: MotionValue<number> }) {
  const opacity = useTransform(p, [0.02, 0.06, 0.56, 0.62], [0, 1, 1, 0]);
  return (
    <motion.p style={{ opacity }} className="mb-1 text-center text-xs font-medium text-[#8a7f77]">
      Guest · Willow Cottage
    </motion.p>
  );
}

function GuideCard({ p, desktop, className = "" }: { p: MotionValue<number>; desktop: boolean; className?: string }) {
  const opacity = useTransform(p, desktop ? [0.5, 0.58] : [0.54, 0.6], [0, 1]);
  const scale = useTransform(p, [0.5, 0.58, 0.86, 0.94], [0.94, 1, 1, desktop ? 1.06 : 1]);
  // Once every text is answered, the guide takes the middle of the stage on its own
  const x = useTransform(p, [0.86, 0.94], ["0%", desktop ? "-54%" : "0%"]);
  return (
    <motion.div style={{ opacity, scale, x }} className={`w-full max-w-[340px] lg:max-w-none rounded-[1.75rem] bg-white p-5 shadow-[0_30px_60px_-28px_rgba(60,40,30,0.4)] ring-1 ring-black/5 ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#db2777] to-[#f97316] text-sm font-bold text-white">W</span>
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-semibold text-[#1f1a17]">Willow Cottage</p>
          <p className="text-xs text-[#8a7f77]">One link for the whole stay</p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {ANSWERS.map((a, i) => (
          <AnswerRow key={a.label} p={p} i={i} {...a} />
        ))}
      </ul>
    </motion.div>
  );
}

function AnswerRow({ p, i, icon: Icon, label, value }: { p: MotionValue<number>; i: number; icon: typeof Wifi; label: string; value: string }) {
  const [r0, r1] = resolve(i);
  const opacity = useTransform(p, [r0 + 0.02, r1], [0.3, 1]);
  const tick = useTransform(p, [r1 - 0.02, r1], [0, 1]);
  const bg = useTransform(p, [r0 + 0.02, r1, r1 + 0.06], ["rgba(253,240,245,0)", "rgba(253,240,245,1)", "rgba(253,240,245,0)"]);
  return (
    <motion.li style={{ opacity, backgroundColor: bg }} className="flex items-center gap-3 rounded-xl px-2 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f6f2ee] text-[#db2777]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[13px] font-semibold text-[#1f1a17]">{label}</span>
        <span className="block text-xs text-[#6f655e]">{value}</span>
      </span>
      <motion.span style={{ opacity: tick, scale: tick }} className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </motion.span>
    </motion.li>
  );
}

function StillVersion() {
  return (
    <section aria-label="Fewer guest texts" className="bg-white py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-5xl">Every answer, in one link.</h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-[#5b524c] lg:mx-0">
            Wi-Fi, parking, the thermostat, breakfast, checkout. The questions guests text you at 11 pm, answered before they ask.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[340px] rounded-[1.75rem] bg-white p-5 shadow-xl ring-1 ring-black/5">
          <ul className="space-y-2">
            {ANSWERS.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f6f2ee] text-[#db2777]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold text-[#1f1a17]">{label}</span>
                  <span className="block text-xs text-[#6f655e]">{value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
