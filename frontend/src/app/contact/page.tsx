import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ContactForm from "@/components/custom/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about Guidewise, ideas, or help setting up your guidebook. Send us a note.",
};

const SHORTCUTS = [
  { href: "/onboarding", title: "Just getting started?", body: "Paste your Airbnb or VRBO link and see your guidebook in minutes." },
  { href: "/pricing", title: "Plans and billing", body: "Free forever, with paid plans when you need more." },
];

export default function ContactPage() {
  return (
    <main className="relative overflow-hidden bg-[#F8F5F1]">
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-48 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.16),rgba(219,39,119,0.07)_45%,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1a17] sm:text-6xl">Let&apos;s talk.</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[#5b524c]">
            A question about Guidewise, an idea for a feature, or a hand setting up your guidebook. Send a note and a real person will write back.
          </p>
          <ul className="mt-10 space-y-3">
            {SHORTCUTS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="group flex items-center gap-4 rounded-2xl bg-white/70 p-4 no-underline ring-1 ring-black/5 transition hover:bg-white hover:no-underline"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#1f1a17]">{s.title}</span>
                    <span className="block text-sm text-[#6f655e]">{s.body}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#db2777] transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[2rem] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5 sm:p-10">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
