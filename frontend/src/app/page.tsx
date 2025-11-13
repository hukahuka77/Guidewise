import Link from "next/link";
import GetStartedButton from "@/components/custom/GetStartedButton";
import Contact from "@/components/custom/Contact";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white">

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-transparent">
          <div className="px-4 md:px-6 max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center gap-8">
              <div className="flex flex-col items-center space-y-4 max-w-3xl">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-gray-800">
                    Create Beautiful Airbnb/VRBO Guest Guidebooks in Minutes
                  </h1>
                  <p className="text-gray-600 md:text-xl">
                    Impress your short‑term rental guests with a professional guidebook tailored to your home. No design skills needed—delight guests, reduce questions, and boost reviews.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center relative py-4">
                  {/* Arrows wrapper to sync animation */}
                  <div className="hidden md:block absolute inset-0 pointer-events-none animate-pulse">
                    {/* Left arrow */}
                    <div className="absolute left-0 -translate-x-32 lg:-translate-x-44 top-1/2 -translate-y-1/2 select-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/arrow.png" alt="arrow" className="w-[7.5rem] h-[7.5rem] md:w-[10.5rem] md:h-[10.5rem] object-contain drop-shadow rotate-6" />
                    </div>
                    {/* Right arrow (mirrored) */}
                    <div className="absolute right-0 translate-x-32 lg:translate-x-44 top-1/2 -translate-y-1/2 select-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/arrow.png" alt="arrow" className="w-[7.5rem] h-[7.5rem] md:w-[10.5rem] md:h-[10.5rem] object-contain drop-shadow -rotate-6 scale-x-[-1]" />
                    </div>
                  </div>
                  {/* CTA Button (auth-aware) */}
                  <GetStartedButton />
                </div>
              </div>
              {/* Hero image removed for now */}
            </div>
          </div>
        </section>
        {/* Digital Guidebooks section */}
        <section className="w-full py-10 md:py-16 bg-white">
          <div className="px-4 md:px-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* Left: copy + CTA + QR */}
              <div className="text-left md:pr-6">
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">Beautiful, Digital Guidebooks for Airbnb & VRBO</h2>
                <p className="text-gray-600 mt-3">
                  Share a clean, mobile‑first guidebook with guests. Perfect for short‑term rentals on Airbnb or VRBO—access via link or QR code.
                  Fully customizable templates keep your brand consistent and your guests informed.
                </p>
                <div className="mt-6 flex items-center gap-5">
                  <Link
                    href="https://guidewise.onrender.com/guidebook/c0bc448b-2c20-4f85-83d7-5687c12b7651"
                    className="inline-flex items-center px-3 py-2 rounded-xl text-pink-600 font-medium whitespace-nowrap no-underline hover:no-underline border border-transparent hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700 transition-colors duration-200"
                  >
                    See an example guidebook →
                  </Link>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/defaultQR.png"
                    alt="QR code to view example guidebook"
                    className="hidden md:block w-40 h-40 md:w-48 md:h-48 object-contain rounded-xl border bg-white p-3"
                  />
                </div>
              </div>
              {/* Right: overlaid iPhone images */}
              <div className="relative w-full flex justify-end items-center min-h-[500px] pr-8">
                {/* Portrait iPhone - back layer (higher up) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/Iphone-portrait.png"
                  alt="Guidebook on iPhone"
                  className="w-3/5 h-auto object-contain relative z-10 -translate-y-8"
                />
              </div>
            </div>
          </div>
        </section>
        {/* Why Digital Guidebooks section (hero background) */}
        <section className="w-full py-12 md:py-20 bg-transparent">
          <div className="px-4 md:px-6 max-w-6xl mx-auto">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">Why Digital Guidebooks Matter for Short‑Term Rentals</h2>
              <p className="text-gray-600 mt-3">
                Digital guidebooks keep Airbnb and VRBO guests informed and delighted. They’re always up to date, easy to access, and
                reduce repetitive questions for short‑term rentals—freeing up your time while elevating the guest experience.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200 p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center mb-3">
                  {/* Refresh/Update icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M12 6v3l4-4-4-4v3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">Always Up To Date</h3>
                <p className="text-gray-600 mt-1">Edit once, update everywhere—no reprinting or resending PDFs.</p>
              </div>
              {/* Card 2 */}
              <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200 p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                  {/* Phone icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H7zm0 2h10v16H7V4zm5 14a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">Mobile-First Access</h3>
                <p className="text-gray-600 mt-1">Open via link or QR code—perfect for phones and tablets.</p>
              </div>
              {/* Card 3 */}
              <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200 p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                  {/* Chat bubble icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M4 4h16v10H7l-3 3V4zm2 4h12v2H6V8zm0 3h8v2H6v-2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">Fewer Questions</h3>
                <p className="text-gray-600 mt-1">Answer common questions proactively—directions, Wi‑Fi, house rules, and more.</p>
              </div>
            </div>
          </div>
        </section>
        {/* PDF Downloads section */}
        <section className="w-full py-12 md:py-20 bg-white">
          <div className="px-4 md:px-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/PDF_Standard.png"
                alt="Sample PDF guidebook"
                className="w-full rounded-2xl shadow-sm border"
              />
              {/* Copy */}
              <div className="text-left">
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">Prefer PDFs? We’ve got you covered</h2>
                <p className="text-gray-600 mt-3">
                  In addition to digital guidebooks, we provide polished PDF downloads—great for printing, sharing,
                  or sending ahead of time. Choose from clean, branded layouts that look great on any device.
                </p>
                <ul className="mt-5 space-y-2 text-gray-700">
                  <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span> Professional, print-ready designs</li>
                  <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-pink-500"></span> Share as attachment or link</li>
                  <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-indigo-500"></span> Optional scannable QR for easy access</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        <Contact />
      </main>
    </div>
  );
}
