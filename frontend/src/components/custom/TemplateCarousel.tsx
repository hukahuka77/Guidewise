"use client";

export default function TemplateCarousel() {
  const templates = [
    { src: "/images/URL_Classic_WhiteHouse.png", alt: "Guidewise Classic Template", name: "Guidewise Classic" },
    { src: "/images/URL_Lifestyle_WhiteHouse.png", alt: "Lifestyle Template", name: "Lifestyle" },
    { src: "/images/URL_Welcoming_WhiteHouse.png", alt: "Welcoming Template", name: "Welcoming" },
  ];

  return (
    <div className="relative overflow-hidden">
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-100% / 3));
          }
        }
        .carousel-track {
          animation: scroll 40s linear infinite;
          will-change: transform;
        }
      `}</style>
      <div className="flex gap-8 carousel-track">
        {/* Render templates 3 times for seamless loop */}
        {[...Array(3)].map((_, setIndex) => (
          <div key={setIndex} className="flex gap-8 flex-shrink-0">
            {templates.map((template, i) => (
              <div key={`${setIndex}-${i}`} className="flex-shrink-0 w-80 md:w-96">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.src}
                  alt={template.alt}
                  className="w-full h-auto rounded-2xl shadow-lg border border-gray-200"
                />
                <p className="text-center mt-3 font-medium text-gray-700">{template.name}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
