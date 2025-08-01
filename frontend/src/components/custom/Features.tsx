export default function Features() {
  return (
    <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-white">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Features</h2>
        <div className="grid items-center gap-6 lg:grid-cols-3 lg:gap-12">
          <div className="grid gap-1">
            <h3 className="text-xl font-bold">AI-Powered Content</h3>
            <p className="text-sm text-gray-500">
              Generate beautiful descriptions and guides with the power of AI. No writing skills needed.
            </p>
          </div>
          <div className="grid gap-1">
            <h3 className="text-xl font-bold">Customizable Templates</h3>
            <p className="text-sm text-gray-500">
              Choose from a variety of professionally designed templates to match your brand and style.
            </p>
          </div>
          <div className="grid gap-1">
            <h3 className="text-xl font-bold">Easy Sharing</h3>
            <p className="text-sm text-gray-500">
              Share your guidebook with a single link. Your guests can access it from any device.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
