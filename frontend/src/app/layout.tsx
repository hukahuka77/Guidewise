import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";
import DialogHost from "@/components/ui/DialogHost";
import Attribution from "@/components/custom/Attribution";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "Turn your Airbnb or VRBO listing into a beautiful digital guidebook in minutes. Free forever.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.guidewiseapp.com"),
  title: {
    default: "Guidewise · Digital guidebooks for vacation rentals",
    template: "%s · Guidewise",
  },
  description: DESCRIPTION,
  applicationName: "Guidewise",
  openGraph: {
    type: "website",
    siteName: "Guidewise",
    title: "Guidewise · Digital guidebooks for vacation rentals",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/images/og-image.jpg", width: 1200, height: 630, alt: "A cozy vacation rental living room" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guidewise · Digital guidebooks for vacation rentals",
    description: DESCRIPTION,
    images: ["/images/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-YZSMPMF5BR"
          strategy="afterInteractive"
        />
        <Script id="ga4-config" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YZSMPMF5BR');
          `}
        </Script>
        <Navbar />
        {children}
        <Footer />
        <DialogHost />
        <Attribution />
      </body>
    </html>
  );
}
