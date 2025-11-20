"use client";

export default function TemplateCarousel() {
  return (
    <div className="relative overflow-hidden">
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .carousel-track {
          animation: scroll 30s linear infinite;
          will-change: transform;
          width: max-content;
        }
      `}</style>
      <div className="flex gap-8 carousel-track pl-4">
        {/* First set of templates */}
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_Generic1.png"
            alt="Classic Style Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Classic Style</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_Generic2.png"
            alt="Professional Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Professional</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_WelcomeBook.png"
            alt="Welcome Book Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Welcome Book</p>
        </div>

        {/* Duplicate set for infinite loop */}
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_Generic1.png"
            alt="Classic Style Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Classic Style</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_Generic2.png"
            alt="Professional Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Professional</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_WelcomeBook.png"
            alt="Welcome Book Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Welcome Book</p>
        </div>
      </div>
    </div>
  );
}
