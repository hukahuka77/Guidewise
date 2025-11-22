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
            alt="Guidewise Classic Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Guidewise Classic</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_Generic2.png"
            alt="Lifestyle Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Lifestyle</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_WelcomeBook.png"
            alt="Welcoming Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Welcoming</p>
        </div>

        {/* Duplicate set for infinite loop */}
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_Generic1.png"
            alt="Guidewise Classic Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Guidewise Classic</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_Generic2.png"
            alt="Lifestyle Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Lifestyle</p>
        </div>
        <div className="flex-shrink-0 w-80 md:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/URL_WelcomeBook.png"
            alt="Welcoming Template"
            className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
          />
          <p className="text-center mt-3 font-medium text-gray-700">Welcoming</p>
        </div>
      </div>
    </div>
  );
}
