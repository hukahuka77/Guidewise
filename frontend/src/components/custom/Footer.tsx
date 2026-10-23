import Link from "next/link";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} Guidewise</p>
        <nav className="flex gap-5" aria-label="Footer">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-gray-500 no-underline hover:text-gray-900 hover:no-underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
