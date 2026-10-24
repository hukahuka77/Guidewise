"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Coffee, Mountain, Play, Utensils, Wifi } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const ROWS = [
  {
    title: "Show them how. Once.",
    body: "Add photos and short videos for the hot tub, the coffee machine, the tricky lock. Guests watch the clip instead of texting you.",
    Visual: VideoVisual,
  },
  {
    title: "Local picks, done for you.",
    body: "Guidewise suggests restaurants and things to do near your place, with photos, descriptions and drive times. Keep the ones you love.",
    Visual: PlacesVisual,
  },
  {
    title: "Change it once. Every guest sees it.",
    body: "New Wi-Fi password? Different parking spot? Edit your guidebook and the link updates instantly. No reprinting, no resending.",
    Visual: LiveVisual,
  },
  {
    title: "On the fridge, too.",
    body: "Download a QR code that opens the live guidebook, and on Starter and up, download the whole guide as a polished PDF to print. Guests find it the moment they walk in.",
    Visual: PrintVisual,
  },
];

/** What hosts get, as an alternating story: each picture wipes open as it arrives. */
export default function Features() {
  const reduce = useReducedMotion();
  return (
    <section id="features" className="scroll-mt-14 overflow-hidden bg-white px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-[#1f1a17] sm:text-5xl">
          Everything a guest asks about, already handled.
        </h2>
        <div className="mt-20 space-y-24 md:space-y-32">
          {ROWS.map(({ title, body, Visual }, i) => (
            <div key={title} className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, ease: EASE }}
                className={i % 2 ? "md:order-2" : ""}
              >
                <h3 className="text-balance text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-4xl">{title}</h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-[#5b524c]">{body}</p>
              </motion.div>
              <motion.div
                initial={reduce ? false : { clipPath: "inset(12% 12% 12% 12% round 32px)", opacity: 0.4 }}
                whileInView={{ clipPath: "inset(0% 0% 0% 0% round 32px)", opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.9, ease: EASE }}
                className={`rounded-[2rem] bg-[#F8F5F1] p-6 sm:p-10 ${i % 2 ? "md:order-1" : ""}`}
              >
                <Visual />
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoVisual() {
  return (
    <div className="mx-auto max-w-[420px]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-[0_24px_50px_-25px_rgba(60,40,30,0.55)]">
        <Image src="/images/home/living-room.webp" alt="A living room shown in a guidebook video" fill sizes="420px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
        <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#db2777] shadow-lg">
          <Play className="ml-1 h-7 w-7" fill="currentColor" />
        </span>
        <div className="absolute inset-x-4 bottom-4 text-white">
          <p className="text-sm font-semibold">Heating and cooling</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/30">
            <motion.div initial={{ width: "0%" }} whileInView={{ width: "62%" }} transition={{ duration: 2.4, ease: "linear" }} className="h-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

const PLACES = [
  { icon: Coffee, name: "The Corner Bakery", note: "Pastries and strong coffee", min: 4, tint: "from-amber-200 to-orange-300" },
  { icon: Mountain, name: "Riverside Trail", note: "Shaded walk along the river", min: 6, tint: "from-emerald-200 to-teal-300" },
  { icon: Utensils, name: "Lantern Kitchen", note: "Dinner with a great patio", min: 8, tint: "from-rose-200 to-pink-300" },
];

function PlacesVisual() {
  return (
    <ul className="mx-auto max-w-[420px] space-y-3">
      {PLACES.map(({ icon: Icon, name, note, min, tint }, i) => (
        <motion.li
          key={name}
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 + i * 0.15, ease: EASE }}
          className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-[0_16px_30px_-20px_rgba(60,40,30,0.45)] ring-1 ring-black/5"
        >
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tint} text-[#1f1a17]/70`}>
            <Icon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-semibold text-[#1f1a17]">{name}</span>
            <span className="block text-sm text-[#6f655e]">{note}</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#fdf0f5] px-2.5 py-1 text-xs font-semibold text-[#be185d]">{min} min</span>
        </motion.li>
      ))}
    </ul>
  );
}

const PASSWORDS = ["welcome2024", "willow-spring"];

function LiveVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setK((v) => v + 1), 2600);
    return () => clearInterval(id);
  }, [inView]);
  const pw = PASSWORDS[k % 2];
  return (
    <div ref={ref} className="mx-auto flex max-w-[280px] flex-col items-stretch gap-2">
      <div className="rounded-2xl bg-white p-4 shadow-[0_16px_30px_-20px_rgba(60,40,30,0.45)] ring-1 ring-black/5">
        <p className="text-xs font-medium text-[#8a7f77]">You edit</p>
        <p className="mt-2 text-[13px] text-[#6f655e]">Wi-Fi password</p>
        <div className="mt-1 rounded-lg bg-[#f6f2ee] px-2.5 py-2 font-mono text-[13px] text-[#1f1a17]">{pw}</div>
      </div>
      <motion.span key={k} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="self-center text-[#db2777]">
        ↓
      </motion.span>
      <div className="rounded-2xl bg-white p-4 shadow-[0_16px_30px_-20px_rgba(60,40,30,0.45)] ring-1 ring-black/5">
        <p className="text-xs font-medium text-[#8a7f77]">Guests see</p>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-[#6f655e]">
          <Wifi className="h-3.5 w-3.5 text-[#db2777]" /> WillowCottage
        </div>
        <motion.div
          key={pw}
          initial={{ backgroundColor: "rgba(16,185,129,0.25)" }}
          animate={{ backgroundColor: "rgba(246,242,238,1)" }}
          transition={{ duration: 1.4, delay: 0.3 }}
          className="mt-1 rounded-lg px-2.5 py-2 font-mono text-[13px] text-[#1f1a17]"
        >
          {pw}
        </motion.div>
      </div>
    </div>
  );
}

function PrintVisual() {
  return (
    <div className="relative mx-auto h-[320px] max-w-[420px] sm:h-[360px]">
      <motion.div
        initial={{ rotate: 0, x: 30 }}
        whileInView={{ rotate: -7, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
        className="absolute left-0 top-4 w-[52%] rounded-sm bg-white p-3 shadow-[0_24px_40px_-22px_rgba(60,40,30,0.55)] ring-1 ring-black/5"
      >
        <div className="relative aspect-[8.5/11] overflow-hidden">
          <Image src="/images/home/style-signature.webp" alt="A printed page of a guidebook" fill sizes="220px" className="object-cover object-top" />
        </div>
      </motion.div>
      <motion.div
        initial={{ rotate: 0, x: -30 }}
        whileInView={{ rotate: 6, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
        className="absolute right-0 top-0 w-[48%] overflow-hidden rounded-xl bg-white shadow-[0_24px_40px_-22px_rgba(60,40,30,0.55)] ring-1 ring-black/5"
      >
        <Image src="/images/home/qr-poster.webp" alt="A QR code poster that opens the guidebook" width={700} height={907} className="h-auto w-full" />
      </motion.div>
    </div>
  );
}
