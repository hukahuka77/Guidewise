export default function Pricing() {
  return (
    <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Simple, Transparent Pricing</h2>
        <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
          All plans include AI content generation, custom templates, and preview mode. Choose the plan that fits your needs.
        </p>
        <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2 md:gap-8">
          {/* Starter Plan */}
          <div className="grid gap-1 p-6 border rounded-lg bg-white hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold">Starter</h3>
            <p className="text-sm text-gray-500">Perfect for individuals</p>
            <div className="text-4xl font-bold mt-4">$9.99</div>
            <p className="text-sm text-gray-500">per month</p>
            <ul className="grid gap-2 mt-4 text-sm">
              <li>✓ 1 Active Guidebook</li>
              <li>✓ AI Content Generation</li>
              <li>✓ All Templates</li>
              <li>✓ PDF Export</li>
              <li>✓ Unlimited Previews</li>
            </ul>
          </div>

          {/* Growth Plan */}
          <div className="grid gap-1 p-6 border-2 border-[#CC7A52] rounded-lg bg-white hover:shadow-lg transition-shadow relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#CC7A52] text-white px-3 py-1 rounded-full text-xs font-semibold">
              POPULAR
            </div>
            <h3 className="text-xl font-bold">Growth</h3>
            <p className="text-sm text-gray-500">For growing hosts</p>
            <div className="text-4xl font-bold mt-4">$19.99</div>
            <p className="text-sm text-gray-500">per month</p>
            <ul className="grid gap-2 mt-4 text-sm">
              <li>✓ 3 Active Guidebooks</li>
              <li>✓ AI Content Generation</li>
              <li>✓ All Templates</li>
              <li>✓ PDF Export</li>
              <li>✓ Unlimited Previews</li>
              <li>✓ Priority Support</li>
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="grid gap-1 p-6 border rounded-lg bg-white hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold">Pro</h3>
            <p className="text-sm text-gray-500">For professionals</p>
            <div className="text-4xl font-bold mt-4">$29.99</div>
            <p className="text-sm text-gray-500">per month</p>
            <ul className="grid gap-2 mt-4 text-sm">
              <li>✓ 10 Active Guidebooks</li>
              <li>✓ AI Content Generation</li>
              <li>✓ All Templates</li>
              <li>✓ PDF Export</li>
              <li>✓ Unlimited Previews</li>
              <li>✓ Priority Support</li>
              <li>✓ Custom Branding</li>
            </ul>
          </div>

          {/* Enterprise Plan */}
          <div className="grid gap-1 p-6 border rounded-lg bg-gray-50 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold">Enterprise</h3>
            <p className="text-sm text-gray-500">For large teams</p>
            <div className="text-3xl font-bold mt-4">Custom</div>
            <p className="text-sm text-gray-500">contact us</p>
            <ul className="grid gap-2 mt-4 text-sm">
              <li>✓ Unlimited Guidebooks</li>
              <li>✓ AI Content Generation</li>
              <li>✓ All Templates</li>
              <li>✓ PDF Export</li>
              <li>✓ Unlimited Previews</li>
              <li>✓ Dedicated Support</li>
              <li>✓ Custom Branding</li>
              <li>✓ API Access</li>
            </ul>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 mt-8">
          All plans include unlimited draft guidebooks in preview mode (with watermark). Activate what you need, when you need it.
        </p>
      </div>
    </section>
  );
}
