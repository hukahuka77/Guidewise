"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

const FORMSPREE_ENDPOINT = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "https://formspree.io/f/mnnzldka";

const field =
  "w-full rounded-xl border-0 bg-[#f6f2ee] px-4 py-3 text-[15px] text-[#1f1a17] placeholder:text-[#a0958d] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#db2777]/50";

export default function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSent(false);
    const form = e.currentTarget;

    // Honeypot: bots fill every field, people never see this one
    if ((form.elements.namedItem("company") as HTMLInputElement | null)?.value) return;

    setSubmitting(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error(`Failed to submit (${res.status})`);
      setSent(true);
      form.reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-7 w-7" strokeWidth={2.5} />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-[#1f1a17]">Thanks, message sent.</h2>
        <p className="mt-2 max-w-xs text-[#5b524c]">We&apos;ll reply to the email you gave us as soon as we can.</p>
        <button type="button" onClick={() => setSent(false)} className="mt-6 text-sm font-medium text-[#db2777] hover:underline">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <input type="text" name="company" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#1f1a17]">Name</span>
          <input name="name" placeholder="Your name" className={field} required autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#1f1a17]">Email</span>
          <input name="email" type="email" placeholder="you@example.com" className={field} required autoComplete="email" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#1f1a17]">Message</span>
        <textarea name="message" placeholder="How can we help?" className={`${field} resize-y`} rows={6} required />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgba(219,39,119,0.7)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
