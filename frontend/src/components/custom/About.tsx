export default function About() {
  return (
    <section id="about" className="w-full py-12 md:py-24 lg:py-32 bg-white">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">About Us</h2>
        <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="text-xl font-bold">Our Mission</h3>
            <p className="text-sm text-gray-500 mt-2">
              To empower hosts to create unforgettable guest experiences through beautiful, easy-to-use digital guidebooks.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold">Our Story</h3>
            <p className="text-sm text-gray-500 mt-2">
              Founded in 2023, GuideWise started as a simple tool to help a friend manage their vacation rental. Today, we&#39;re on a mission to help hosts all over the world.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
