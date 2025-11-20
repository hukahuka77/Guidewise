import Link from "next/link";
import GetStartedButton from "@/components/custom/GetStartedButton";
import Contact from "@/components/custom/Contact";
import TemplateCarousel from "@/components/custom/TemplateCarousel";
import { Heart, Clock, RefreshCw, Smartphone, Star, MapPin, ArrowRight } from "lucide-react";

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
        {/* Template Showcase Carousel */}
        <section className="w-full py-12 md:py-16 bg-gradient-to-b from-white to-[#F8F5F1] overflow-hidden">
          <div className="px-4 md:px-6 max-w-6xl mx-auto mb-10">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-3">Choose Your Perfect Template</h2>
              <p className="text-gray-600">Multiple beautiful designs to match your brand and style</p>
            </div>
          </div>
          <TemplateCarousel />
        </section>
        {/* Live Demo Guidebook */}
        <section className="hidden md:block w-full py-12 md:py-20 bg-gradient-to-b from-white to-[#F8F5F1]">
          <div className="px-4 md:px-6 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-3">Try It Out: Interactive Demo</h2>
              <p className="text-gray-600">Explore a live guidebook below—click around, navigate sections, and see how your guests will experience it.</p>
            </div>
            <div className="w-full">
              <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-gray-300 bg-gray-100 p-2">
                <div className="rounded-xl overflow-hidden bg-white shadow-inner">
                  <iframe
                    src="https://guidewise.onrender.com/guidebook/c0bc448b-2c20-4f85-83d7-5687c12b7651"
                    title="Demo Guidebook"
                    className="w-full h-[700px] lg:h-[800px]"
                    style={{ border: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Why Digital Guidebooks section - Clean & Professional */}
        <section className="w-full py-20 md:py-32 bg-white">
          <div className="px-4 md:px-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="max-w-3xl mb-20">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
                Why digital guidebooks matter
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Your guests deserve more than a PDF buried in their inbox. Digital guidebooks create seamless,
                memorable stays while saving you countless hours.
              </p>
            </div>

            {/* Benefits List - Two Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12">
              {/* Benefit 1 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-pink-50 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-pink-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Delight guests from day one</h3>
                  <p className="text-gray-600 leading-relaxed">
                    When guests arrive and scan a QR code to find everything they need—WiFi, check-in instructions,
                    local recommendations—they immediately feel taken care of. This sets the tone for 5-star reviews.
                  </p>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Save hours every week</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Stop answering &ldquo;What&rsquo;s the WiFi password?&rdquo; for the hundredth time. Digital guidebooks answer
                    common questions before guests even ask. Hosts report saving 5-10 hours per week.
                  </p>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Update once, reflect everywhere</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Restaurant closed? New house rule? WiFi password changed? Update your guidebook in 30 seconds
                    and every current and future guest sees the latest information instantly.
                  </p>
                </div>
              </div>

              {/* Benefit 4 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Built for mobile-first guests</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Your guidebook works beautifully on any device—no app downloads, no logins.
                    Guests can access it from the Uber, at dinner, or lounging on your couch.
                  </p>
                </div>
              </div>

              {/* Benefit 5 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Star className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Stand out, earn better reviews</h3>
                  <p className="text-gray-600 leading-relaxed">
                    A polished digital guidebook signals professionalism and care. &ldquo;The digital guidebook was so helpful!&rdquo;
                    becomes a recurring theme that attracts more premium bookings.
                  </p>
                </div>
              </div>

              {/* Benefit 6 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-rose-50 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-rose-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Be their local expert</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Share your favorite coffee shop, hidden hiking trail, or best pizza spot. Curated local recommendations
                    make guests feel like insiders, not tourists.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="mt-20 pt-16 border-t border-gray-200">
              <div className="max-w-2xl">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Ready to elevate your guest experience?
                </h3>
                <p className="text-lg text-gray-600 mb-8">
                  Join hundreds of hosts who&rsquo;ve upgraded to digital guidebooks and never looked back.
                </p>
                <a
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Create your first guidebook
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
        <Contact />
      </main>
    </div>
  );
}
