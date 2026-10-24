"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isGuestSession } from "@/lib/guest";
import { BarChart3, BookOpen, CreditCard, UserRound } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Guidebooks", icon: BookOpen },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

function NavLink({ href, label, icon: Icon }: (typeof NAV)[number]) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-full px-3 py-2 md:px-3.5 text-sm font-medium no-underline transition-colors hover:no-underline ${
        isActive ? "bg-[#fdf0f5] text-[#be185d]" : "text-[#5b524c] hover:bg-[#f6f2ee] hover:text-[#1f1a17]"
      }`}
    >
      <Icon className="hidden h-4 w-4 md:block" />
      {label}
    </Link>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  // The dashboard is for accounts: a guest (built a guidebook without signing up) is asked to save it first
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (isGuestSession(data.session)) router.replace("/signup?save=1");
    });
  }, [router]);
  return (
    <div className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-[#F8F5F1]">
      <div aria-hidden className="pointer-events-none absolute -right-48 -top-48 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.12),rgba(219,39,119,0.05)_45%,transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[210px_1fr] md:gap-8">
          {/* Sidebar: a row of pills on phones, a column on larger screens */}
          <aside className="h-max md:sticky md:top-20">
            <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto rounded-full bg-white p-1.5 shadow-[0_10px_30px_-20px_rgba(60,40,30,0.35)] ring-1 ring-black/5 md:flex-col md:rounded-3xl md:p-3">
              {NAV.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </nav>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
