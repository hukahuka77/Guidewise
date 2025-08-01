import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full px-4 lg:px-6 h-14 flex items-center bg-white shadow-sm">
      <Link className="flex items-center justify-center" href="/">
        <Image src="/Guidewise_logo.png" alt="GuideWise Logo" width={32} height={32} className="mr-2 rounded-full" />
        <span className="text-xl font-bold text-primary">GuideWise</span>
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6">
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#features">
          Features
        </Link>
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#pricing">
          Pricing
        </Link>
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#about">
          About
        </Link>
        <Link className="text-sm font-medium hover:underline underline-offset-4" href="/#contact">
          Contact
        </Link>
      </nav>
    </header>
  );
}
