import Image from "next/image";
import { Check } from "lucide-react";

const PERKS = ["Free forever, no credit card", "Built from your Airbnb or VRBO link", "One link for every guest question"];

/** Shared frame for login and signup: the home photo and what Guidewise gives you, beside the form card. */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-[#F8F5F1]">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.16),rgba(219,39,119,0.07)_45%,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <aside className="hidden lg:block">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-t-[999px] rounded-b-[2rem] shadow-[0_30px_60px_-30px_rgba(60,40,30,0.45)]">
            <Image src="/images/home/living-room.webp" alt="" fill priority sizes="420px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1f1a17]/70 via-[#1f1a17]/10 to-transparent" />
            <ul className="absolute inset-x-6 bottom-7 space-y-2.5">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-3 text-[15px] font-medium text-white">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#db2777]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[2rem] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5 sm:p-10">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#1f1a17] sm:text-4xl">{title}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#5b524c]">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

// Shared form pieces so login and signup look the same
export const authInput =
  "mt-1.5 w-full rounded-xl border-0 bg-[#f6f2ee] px-4 py-3 text-[15px] text-[#1f1a17] placeholder:text-[#a0958d] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#db2777]/50";
export const authLabel = "block text-sm font-medium text-[#1f1a17]";
export const authPrimary =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgba(219,39,119,0.7)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60";
export const authSecondary =
  "inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-[15px] font-semibold text-[#1f1a17] ring-1 ring-[#1f1a17]/15 transition-colors hover:bg-[#faf7f4] disabled:opacity-60";
export const authLink = "font-medium text-[#be185d] underline-offset-2 hover:underline";

export function AuthAlert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-6 rounded-2xl px-4 py-3 text-sm leading-relaxed ${tone === "error" ? "bg-red-50 text-red-800 ring-1 ring-red-100" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"}`}
    >
      {children}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-6">
      <div className="h-px flex-1 bg-[#ece5de]" />
      <span className="text-xs text-[#8a7f77]">or</span>
      <div className="h-px flex-1 bg-[#ece5de]" />
    </div>
  );
}
