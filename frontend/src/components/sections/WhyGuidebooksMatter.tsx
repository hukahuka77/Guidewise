import GetStartedButton from "@/components/custom/GetStartedButton";

const benefits = [
  {
    number: "01",
    eyebrow: "Better arrivals",
    title: "Welcome guests with confidence",
    summary: "Put check-in details, WiFi, and house essentials one scan away.",
    detail:
      "Guests arrive knowing exactly what to do, so the stay starts smoothly and your first impression feels thoughtful.",
    accent: "bg-pink-500",
    wash: "from-pink-50 to-rose-50",
    numberColor: "text-pink-600",
    offset: "xl:translate-y-6",
  },
  {
    number: "02",
    eyebrow: "Fewer questions",
    title: "Get hours back each week",
    summary: "Answer everyday guest questions before they reach your inbox.",
    detail:
      "One clear source for the answers guests need means less repetitive messaging and more time to focus on hosting.",
    accent: "bg-emerald-500",
    wash: "from-emerald-50 to-teal-50",
    numberColor: "text-emerald-600",
    offset: "xl:-translate-y-3",
  },
  {
    number: "03",
    eyebrow: "Always current",
    title: "Update once, share everywhere",
    summary: "Change a rule, code, or recommendation in moments.",
    detail:
      "Every guest sees the latest information instantly—without another attachment, reprint, or follow-up message.",
    accent: "bg-sky-500",
    wash: "from-sky-50 to-blue-50",
    numberColor: "text-sky-600",
    offset: "xl:translate-y-10",
  },
  {
    number: "04",
    eyebrow: "Zero friction",
    title: "Meet guests on any device",
    summary: "No download or login—just a polished guide that works anywhere.",
    detail:
      "Guests can open your guide from the car, the couch, or across town and find a mobile-friendly answer in seconds.",
    accent: "bg-violet-500",
    wash: "from-violet-50 to-purple-50",
    numberColor: "text-violet-600",
    offset: "xl:translate-y-2",
  },
  {
    number: "05",
    eyebrow: "Memorable stays",
    title: "Turn care into better reviews",
    summary: "Make every detail of your hospitality feel considered.",
    detail:
      "A useful, professional guide helps guests feel looked after—and gives them one more reason to leave a five-star review.",
    accent: "bg-amber-500",
    wash: "from-amber-50 to-orange-50",
    numberColor: "text-amber-600",
    offset: "xl:-translate-y-7",
  },
  {
    number: "06",
    eyebrow: "Local expertise",
    title: "Share the places worth knowing",
    summary: "Lead guests to the neighborhood spots you genuinely recommend.",
    detail:
      "Your favorite coffee, dinner, and hidden-gem suggestions help guests experience the area like a local, not a tourist.",
    accent: "bg-rose-500",
    wash: "from-rose-50 to-pink-50",
    numberColor: "text-rose-600",
    offset: "xl:translate-y-6",
  },
];

export default function WhyGuidebooksMatter() {
  return (
    <section className="w-full overflow-hidden bg-white py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center md:mb-24">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-pink-600">
            A smoother stay for everyone
          </p>
          <h2 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
            Why digital guidebooks matter
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 md:text-xl">
            Give guests the right answer at the right moment—and give yourself
            more time to host.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-10 md:grid-cols-2 lg:gap-8 xl:grid-cols-3">
          {benefits.map((benefit) => (
            <article
              key={benefit.number}
              tabIndex={0}
              aria-label={`${benefit.title}. Hover or focus to reveal more details.`}
              className={`group relative min-h-72 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] outline-none transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_28px_70px_-24px_rgba(236,72,153,0.3)] focus-visible:-translate-y-3 focus-visible:ring-4 focus-visible:ring-pink-200 md:min-h-[21rem] xl:min-h-80 ${benefit.offset}`}
            >
              <div
                className={`absolute inset-x-0 top-0 h-1.5 ${benefit.accent}`}
              />

              <div className="absolute inset-0 p-7 transition-all duration-300 group-hover:pointer-events-none group-hover:-translate-y-3 group-hover:opacity-0 group-focus-within:pointer-events-none group-focus-within:-translate-y-3 group-focus-within:opacity-0 md:p-8">
                <div className="mb-10 flex items-center justify-between">
                  <span
                    className={`text-3xl font-black tracking-tight ${benefit.numberColor}`}
                    aria-hidden="true"
                  >
                    {benefit.number}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-600">
                    {benefit.eyebrow}
                  </span>
                </div>
                <h3 className="mb-4 text-2xl font-bold tracking-tight text-gray-900">
                  {benefit.title}
                </h3>
                <p className="leading-relaxed text-gray-600">
                  {benefit.summary}
                </p>
                <p className="absolute bottom-7 left-7 text-sm font-semibold text-gray-400 md:bottom-8 md:left-8">
                  Hover to discover more
                </p>
              </div>

              <div
                className={`pointer-events-none invisible absolute inset-0 flex translate-y-3 flex-col justify-center bg-gradient-to-br p-7 opacity-0 transition-all duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 md:p-8 ${benefit.wash}`}
              >
                <span
                  className={`mb-5 text-sm font-black uppercase tracking-[0.2em] ${benefit.numberColor}`}
                >
                  {benefit.eyebrow}
                </span>
                <h3 className="mb-5 text-2xl font-bold tracking-tight text-gray-900">
                  {benefit.title}
                </h3>
                <p className="text-lg leading-relaxed text-gray-700">
                  {benefit.detail}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl border-t border-gray-200 pt-12 text-center md:mt-24 md:pt-16">
          <h3 className="mb-4 text-3xl font-bold text-gray-900">
            Ready to elevate your guest experience?
          </h3>
          <p className="mb-8 text-lg text-gray-600">
            Create a guide guests will actually use.
          </p>
          <GetStartedButton
            labelWhenLoggedOut="Create your first guidebook"
            labelWhenLoggedIn="Create your first guidebook"
            buttonClassName="px-6 py-3 text-lg rounded-lg"
          />
        </div>
      </div>
    </section>
  );
}
