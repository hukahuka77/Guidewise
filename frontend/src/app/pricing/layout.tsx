import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free forever, with paid plans when you want more styles, views and analytics.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
