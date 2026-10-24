import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your free account",
  description: "Start your Guidewise guidebook. Free forever, no credit card.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
