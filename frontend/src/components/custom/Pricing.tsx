export default function Pricing() {
  return (
    <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Pricing</h2>
        <div className="grid gap-6 md:grid-cols-3 md:gap-12">
          <div className="grid gap-1 p-6 border rounded-lg">
            <h3 className="text-xl font-bold">Free</h3>
            <p className="text-sm text-gray-500">For personal use</p>
            <div className="text-4xl font-bold mt-4">$0</div>
            <ul className="grid gap-2 mt-4 text-sm">
              <li>1 Guidebook</li>
              <li>AI Content Generation</li>
            </ul>
          </div>
          <div className="grid gap-1 p-6 border rounded-lg bg-gray-100">
            <h3 className="text-xl font-bold">Pro</h3>
            <p className="text-sm text-gray-500">For professionals</p>
            <div className="text-4xl font-bold mt-4">$12</div>
            <p className="text-sm text-gray-500">per month</p>
            <ul className="grid gap-2 mt-4 text-sm">
              <li>Unlimited Guidebooks</li>
              <li>AI Content Generation</li>
              <li>Custom Branding</li>
            </ul>
          </div>
          <div className="grid gap-1 p-6 border rounded-lg">
            <h3 className="text-xl font-bold">Enterprise</h3>
            <p className="text-sm text-gray-500">For large teams</p>
            <div className="text-4xl font-bold mt-4">Contact Us</div>
            <ul className="grid gap-2 mt-4 text-sm">
              <li>Unlimited Guidebooks</li>
              <li>AI Content Generation</li>
              <li>Custom Branding</li>
              <li>Dedicated Support</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
