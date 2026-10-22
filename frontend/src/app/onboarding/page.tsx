"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Spinner from "@/components/ui/spinner";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import PhonePreview from "@/components/custom/PhonePreview";
import { offerUpgrade, throwApiError } from "@/lib/upgrade";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type Mode = "link" | "template";

interface Created {
  id: string;
  slug: string | null;
  imported: string[];
  missing: string[];
  places: { things_to_do: number; places_to_eat: number } | null;
}

const IMPORT_STEPS = [
  "Reading your listing…",
  "Picking your cover photo…",
  "Writing your welcome and house rules…",
  "Finding places to eat and things to do nearby…",
];

const STYLES: { key: string; label: string; hint: string }[] = [
  { key: "template_original", label: "Classic", hint: "Clean and familiar" },
  { key: "template_generic", label: "Lifestyle", hint: "Light and modern" },
  { key: "template_welcomebook", label: "Welcoming", hint: "Warm and editorial" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken } = useAuth({ requireAuth: true });

  const [mode, setMode] = useState<Mode>("link");
  const [listingUrl, setListingUrl] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [address, setAddress] = useState("");
  const [style, setStyle] = useState("template_original");

  const [busy, setBusy] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeaders = (): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  });

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const remember = (id: string) => {
    try {
      sessionStorage.setItem("guidebookId", id);
      localStorage.setItem("guidebookId", id);
    } catch { }
  };

  const slugFor = async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/guidebooks/${id}`, { headers: authHeaders() });
      const data = res.ok ? await res.json() : null;
      return typeof data?.public_slug === "string" ? data.public_slug : null;
    } catch {
      return null;
    }
  };

  const startProgress = () => {
    setStepIndex(0);
    timer.current = setInterval(() => setStepIndex((i) => Math.min(i + 1, IMPORT_STEPS.length - 1)), 5000);
  };
  const stopProgress = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const importListing = async () => {
    if (!listingUrl.trim() || busy) return;
    setBusy(true);
    setError(null);
    startProgress();
    try {
      const res = await fetch(`${API_BASE}/api/import-listing`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url: listingUrl.trim() }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) await throwApiError(res, "We couldn't import that listing. You can start with a template instead.");
      const json = await res.json();
      remember(json.guidebook_id);
      setCreated({
        id: json.guidebook_id,
        slug: await slugFor(json.guidebook_id),
        imported: json.imported ?? [],
        missing: json.missing ?? [],
        places: json.recommendations ?? null,
      });
    } catch (e) {
      if (!offerUpgrade(e)) setError(e instanceof Error ? e.message : "We couldn't import that listing.");
    } finally {
      stopProgress();
      setBusy(false);
    }
  };

  const startFromTemplate = async () => {
    if (!propertyName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          property_name: propertyName.trim(),
          address_street: address.trim(),
          welcome_message: "Welcome! We hope you have a wonderful stay.",
          template_key: style,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) await throwApiError(res, "We couldn't create your guidebook. Please try again.");
      const json = await res.json();
      remember(json.guidebook_id);
      setCreated({ id: json.guidebook_id, slug: json.public_slug ?? null, imported: [], missing: [], places: null });
    } catch (e) {
      if (!offerUpgrade(e)) setError(e instanceof Error ? e.message : "We couldn't create your guidebook.");
    } finally {
      setBusy(false);
    }
  };

  const changeStyle = async (key: string) => {
    if (!created || key === style) return;
    const previous = style;
    setStyle(key);
    try {
      const res = await fetch(`${API_BASE}/api/guidebook/${created.id}/template`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ template_key: key }),
      });
      if (!res.ok) throw new Error();
      setPreviewKey((k) => k + 1);
    } catch {
      setStyle(previous);
      setError("Could not change the style. Please try again.");
    }
  };

  const message = busy && mode === "link" ? IMPORT_STEPS[stepIndex] : busy ? "Creating your guidebook…" : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F5F1] via-white to-[#F8F5F1] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-10">
          {!created ? (
            <>
              <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-5xl">
                Get your guidebook in under 3 minutes, it&apos;s FREE!
              </h1>
              <p className="mt-5 text-lg text-gray-600">
                Share your listing link and our smart AI ✨ will personalise your guidebook. Watch it come together on the phone.
              </p>

              <div className="mt-8 flex flex-wrap gap-3" role="radiogroup" aria-label="How do you want to start?">
                <ModeButton selected={mode === "link"} onClick={() => setMode("link")} disabled={busy}>
                  Start with a listing link
                </ModeButton>
                <ModeButton selected={mode === "template"} onClick={() => setMode("template")} disabled={busy}>
                  Start with a template
                </ModeButton>
              </div>

              {mode === "link" ? (
                <div className="mt-8">
                  <Label htmlFor="listing-url" className="text-lg font-semibold text-gray-900">
                    Provide your Airbnb or VRBO link
                  </Label>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="listing-url"
                      type="url"
                      placeholder="e.g. https://airbnb.com/rooms/123456…"
                      value={listingUrl}
                      onChange={(e) => setListingUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") importListing(); }}
                      disabled={busy}
                      className="h-14 rounded-2xl px-5 text-base"
                    />
                    <Button type="button" onClick={importListing} disabled={busy || !listingUrl.trim()} className="h-14 rounded-2xl px-8 text-base">
                      {busy ? <Spinner /> : "Build my guidebook"}
                    </Button>
                  </div>
                  {busy && <p className="mt-3 text-sm text-gray-500">This can take up to a minute. Your guidebook appears on the phone when it&apos;s ready.</p>}
                  <p className="mt-4 text-sm text-gray-500">Supported platforms: Airbnb, VRBO</p>
                </div>
              ) : (
                <div className="mt-8 space-y-5">
                  <div>
                    <Label htmlFor="property-name" className="text-lg font-semibold text-gray-900">Name of your place</Label>
                    <Input
                      id="property-name"
                      placeholder="e.g. Lakeside Cabin"
                      value={propertyName}
                      onChange={(e) => setPropertyName(e.target.value)}
                      disabled={busy}
                      className="mt-3 h-14 rounded-2xl px-5 text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold text-gray-900">Address <span className="text-sm font-normal text-gray-500">(helps us suggest nearby places)</span></Label>
                    <PlacesAutocomplete value={address} onChange={setAddress} placeholder="Start typing an address…" className="mt-3 h-14 rounded-2xl" />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold text-gray-900">Style</Label>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {STYLES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setStyle(s.key)}
                          disabled={busy}
                          className={`rounded-2xl border p-3 text-left transition ${style === s.key ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" : "border-gray-200 hover:bg-gray-50"}`}
                        >
                          <div className="font-semibold text-gray-900">{s.label}</div>
                          <div className="text-xs text-gray-500">{s.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="button" onClick={startFromTemplate} disabled={busy || !propertyName.trim()} className="h-14 rounded-2xl px-8 text-base">
                    {busy ? <Spinner /> : "Create my guidebook"}
                  </Button>
                </div>
              )}

              {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">Your guidebook is live! 🎉</h1>
              <p className="mt-4 text-lg text-gray-600">
                It&apos;s already on the phone. Tap around, then fine-tune anything you like. Changes appear instantly.
              </p>

              {created.imported.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">We filled in</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {created.imported.map((item) => (
                      <li key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">✓ {item}</li>
                    ))}
                  </ul>
                  {created.places && (created.places.things_to_do > 0 || created.places.places_to_eat > 0) && (
                    <p className="mt-2 text-sm text-gray-600">
                      Including {created.places.places_to_eat} places to eat and {created.places.things_to_do} things to do nearby.
                    </p>
                  )}
                </div>
              )}
              {created.missing.length > 0 && (
                <div className="mt-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Worth adding next</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {created.missing.map((item) => (
                      <li key={item} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Style</h2>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {STYLES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => changeStyle(s.key)}
                      className={`rounded-2xl border p-3 text-left transition ${style === s.key ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      <div className="font-semibold text-gray-900">{s.label}</div>
                      <div className="text-xs text-gray-500">{s.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button type="button" className="h-12 rounded-2xl px-8 text-base" onClick={() => router.push(`/edit/${created.id}?new=true`)}>
                  Customize it
                </Button>
                {created.slug && (
                  <Link href={`${API_BASE}/g/${created.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="outline" className="h-12 rounded-2xl px-6 text-base">Open the live page</Button>
                  </Link>
                )}
                <Link href="/dashboard" className="text-sm text-gray-600 underline">Go to dashboard</Link>
              </div>
            </>
          )}
        </section>

        <aside className="order-first lg:order-none lg:sticky lg:top-8">
          <PhonePreview guidebookId={created?.id} accessToken={accessToken} refreshKey={previewKey} message={message} />
        </aside>
      </div>
    </div>
  );
}

function ModeButton({ selected, onClick, disabled, children }: { selected: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-2xl border px-5 py-3 text-base font-medium transition ${selected ? "border-teal-700 bg-teal-50 text-gray-900" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-gray-900 bg-gray-900" : "border-gray-300"}`}>
        {selected && (
          <svg viewBox="0 0 20 20" className="h-3 w-3 text-white" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}
