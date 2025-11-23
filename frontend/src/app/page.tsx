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
          <div className="px-4 md:px-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* Left: hero copy + CTA */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-8">
                <div className="space-y-4 max-w-3xl">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-gray-800">
                    Create Beautiful Airbnb/VRBO Guest Guidebooks in Minutes
                  </h1>
                  <p className="text-gray-600 md:text-xl">
                    Impress your short‑term rental guests with a professional guidebook tailored to your home. No design skills needed. Delight guests, reduce questions, and boost reviews.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start relative py-4">
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

              {/* Right: iPhone mockup */}
              <div className="hidden md:flex justify-end items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/Iphone-portrait.png"
                  alt="Guidebook on iPhone"
                  className="w-2/3 h-auto object-contain drop-shadow-xl"
                />
              </div>
            </div>
          </div>
        </section>
        {/* Live Demo Guidebook */}
        <section className="hidden md:block w-full py-12 md:py-20 bg-gradient-to-b from-white to-[#F8F5F1]">
          <div className="px-4 md:px-6 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-3">Try It Out: Interactive Demo</h2>
              <p className="text-gray-600">Explore a live guidebook below. Click around, navigate sections, and see how your guests will experience it.</p>
            </div>
            <div className="w-full">
              <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-gray-300 bg-gray-100 p-2">
                <div className="rounded-xl overflow-hidden bg-white shadow-inner">
                  <iframe
                    src="https://guidewise.onrender.com/g/the-white-house"
                    title="Demo Guidebook"
                    className="w-full h-[800px] lg:h-[900px]"
                    style={{ border: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* QR code + link under demo */}
            <div className="mt-8 flex items-center justify-center gap-5">
              <Link
                href="https://guidewise.onrender.com/g/the-white-house"
                className="inline-flex items-center px-3 py-2 rounded-xl text-pink-600 font-medium whitespace-nowrap no-underline hover:no-underline border border-transparent hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700 transition-colors duration-200"
              >
                Or check it out on your phone →
              </Link>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/QR_Code_WhiteHouse.png"
                alt="QR code to view example guidebook on your phone"
                className="w-40 h-40 md:w-48 md:h-48 object-contain rounded-xl border bg-white p-3"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-20 md:py-32 bg-gradient-to-b from-[#F8F5F1] to-white">
          <div className="px-4 md:px-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
                Powerful Features That Save You Time
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Everything you need to create professional guidebooks that guests love, without the hassle.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">

              {/* Feature 1: Video House Manual */}
              <div className="flex flex-col">
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Video House Manual
                  </h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Stop answering the same questions over and over. Upload photos and videos showing guests exactly how to use your appliances, hot tub, pool, thermostat, and more. One quick video saves hours of back-and-forth messages.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-pink-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Upload unlimited photos and videos</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-pink-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Works perfectly on all devices</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-pink-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Show, don&apos;t tell - reduce support requests</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 2: AI Prepopulation */}
              <div className="flex flex-col">
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    AI-Powered Local Recommendations
                  </h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Just enter your property address and click &quot;Prepopulate.&quot; Our AI instantly generates personalized recommendations for nearby restaurants, activities, and attractions - complete with photos, descriptions, and driving distances.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Generates recommendations in seconds</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Auto-includes photos and driving times</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Fully customizable - edit any suggestion</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 3: Live Hosted Guidebook */}
              <div className="flex flex-col">
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7a2 2 0 012-2h9a2 2 0 012 2v11H6a2 2 0 01-2-2V7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5V4a2 2 0 012-2h8a2 2 0 012 2v11a2 2 0 01-2 2h-1" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Live, Hosted Guidebook
                  </h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-6">
                    Your guidebook lives online, not in a static PDF. Update it anytime and every guest sees the latest
                    version instantlyno re-sending files or reprinting welcome binders.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-sky-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Changes to WiFi, rules, or recommendations go live immediately</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-sky-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Guests always access a single, always-up-to-date link</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-sky-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">No more outdated PDFs or printed binders floating around</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Template Showcase Carousel - highlight template variety as a feature */}
        <section className="w-full py-12 md:py-16 bg-gradient-to-b from-white to-[#F8F5F1] overflow-hidden">
          <div className="px-4 md:px-6 max-w-6xl mx-auto mb-10">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-3">Select Your Perfect Template</h2>
              <p className="text-gray-600">
                Guidewise isn&apos;t just about contentit&apos;s about presentation. Preview the different template styles your
                guests will experience.
              </p>
            </div>
          </div>
          <TemplateCarousel />
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
                    When guests arrive and scan a QR code to find everything they need (WiFi, check-in instructions,
                    local recommendations), they immediately feel taken care of. This sets the tone for 5-star reviews.
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
                    Your guidebook works beautifully on any device. No app downloads, no logins.
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
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[oklch(0.6923_0.22_21.05)] text-white font-medium rounded-lg hover:opacity-90 transition-all"
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
