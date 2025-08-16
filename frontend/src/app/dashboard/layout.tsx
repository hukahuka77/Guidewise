"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-[oklch(0.6923_0.22_21.05)] text-white"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="h-max md:sticky md:top-6">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Dashboard</div>
              <nav className="space-y-1">
                <NavLink href="/dashboard" label="Guidebooks" />
                <NavLink href="/dashboard/profile" label="Profile" />
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
