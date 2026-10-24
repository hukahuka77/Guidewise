import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your guidebook is ready",
  description: "A digital guidebook built from your listing. Make it yours, free forever.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
