"use client";

import { useState } from "react";

export default function Contact() {
  const FORMSPREE_ENDPOINT = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "https://formspree.io/f/mnnzldka"; // provided Formspree endpoint
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSent(false);
    const form = e.currentTarget;

    // Honeypot
    const hp = (form.elements.namedItem("company") as HTMLInputElement | null)?.value;
    if (hp) {
      // silently drop
      return;
    }

    const data = new FormData(form);
    setSubmitting(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      if (!res.ok) throw new Error(`Failed to submit (${res.status})`);
      setSent(true);
      form.reset();
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="w-full py-12 md:py-24 lg:py-32 bg-transparent">
      <div className="px-4 md:px-6 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-8">Contact Us</h2>
        <div className="mx-auto max-w-md space-y-4">
          <div className="space-y-2 text-center">
            <p className="text-gray-500">Fill out the form below and we'll get back to you as soon as possible.</p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Honeypot */}
            <input type="text" name="company" className="hidden" tabIndex={-1} autoComplete="off" />

            <div className="space-y-2">
              <label htmlFor="name">Name</label>
              <input name="name" id="name" placeholder="Enter your name" className="w-full p-2 border rounded" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <input name="email" id="email" type="email" placeholder="Enter your email" className="w-full p-2 border rounded" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="message">Message</label>
              <textarea name="message" id="message" placeholder="Enter your message" className="w-full p-2 border rounded" rows={5} required></textarea>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {sent && <div className="text-emerald-700 text-sm">Thanks! Your message has been sent.</div>}
            <button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed text-primary-foreground p-2 rounded">
              {submitting ? "Sending..." : "Submit"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
