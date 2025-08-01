export default function Contact() {
  return (
    <section id="contact" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Contact Us</h2>
        <div className="mx-auto max-w-sm space-y-4">
          <div className="space-y-2 text-center">
            <p className="text-gray-500">Fill out the form below and we'll get back to you as soon as possible.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name">Name</label>
              <input id="name" placeholder="Enter your name" className="w-full p-2 border rounded" />
            </div>
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="Enter your email" className="w-full p-2 border rounded" />
            </div>
            <div className="space-y-2">
              <label htmlFor="message">Message</label>
              <textarea id="message" placeholder="Enter your message" className="w-full p-2 border rounded" rows={5}></textarea>
            </div>
            <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded">Submit</button>
          </div>
        </div>
      </div>
    </section>
  );
}
