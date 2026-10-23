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
import { ensureSession, finishClaim, hasPendingClaim, isGuestSession, savePendingBuild, takeClaimed, takePendingBuild, type PendingBuild, rememberGuestGuidebook } from "@/lib/guest";
import { supabase } from "@/lib/supabaseClient";
import ImportQuestions, { EMPTY_ANSWERS, ImportProgress, answersToPayload, type ImportAnswers } from "@/components/onboarding/ImportQuestions";

type Mode = "link" | "manual";

interface Created {
  id: string;
  slug: string | null;
  imported: string[];
  missing: string[];
  places: { things_to_do: number; places_to_eat: number } | null;
}

const IMPORT_STEPS = [
  "Reading your listing…",
  "Choosing your cover photo…",
  "Writing your welcome and house rules…",
  "Finding the best places nearby…",
];

const STYLES: { key: string; label: string; hint: string }[] = [
  { key: "template_signature", label: "Signature", hint: "Elegant and easy to use" },
  { key: "template_generic", label: "Lifestyle", hint: "Light and modern" },
  { key: "template_welcomebook", label: "Welcoming", hint: "Warm and editorial" },
];

export default function OnboardingPage() {
  const router = useRouter();
  // No account needed to build a guidebook: a guest session starts when they create one
  const { accessToken: signedInToken, isGuest: guestSession } = useAuth();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const accessToken = sessionToken ?? signedInToken;
  const [guest, setGuest] = useState(false);
  const isGuest = guest || guestSession;
  // Just signed up or logged in after building a guidebook as a guest: bring it into the account
  const [claiming, setClaiming] = useState(false);

  const [mode, setMode] = useState<Mode>("link");
  const [listingUrl, setListingUrl] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [address, setAddress] = useState("");
  const [style, setStyle] = useState("template_signature");

  const [busy, setBusy] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  // Questions asked while a listing imports; the answers are saved onto the guidebook once it exists
  const [fromImport, setFromImport] = useState(false);
  const [answers, setAnswers] = useState<ImportAnswers>(EMPTY_ANSWERS);
  const [questionStep, setQuestionStep] = useState(0);
  const [questionsDone, setQuestionsDone] = useState(false);
  const savingAnswers = useRef<Promise<void> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeaders = (token = accessToken): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  useEffect(() => {
    if (!supabase || !hasPendingClaim()) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.auth.getSession();
      if (!data.session || isGuestSession(data.session)) return;
      setClaiming(true);
      await finishClaim();
      if (cancelled) return; // take the result only in the effect that's still mounted
      const ids = takeClaimed();
      if (ids[0]) router.replace(`/edit/${ids[0]}?new=true`);
      else setClaiming(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Signed up because guests weren't available: build what they asked for now that they're in
  const resumed = useRef(false);
  useEffect(() => {
    if (!supabase || resumed.current) return;
    (async () => {
      const { data } = await supabase!.auth.getSession();
      if (!data.session || isGuestSession(data.session) || resumed.current) return;
      const build = takePendingBuild();
      if (!build) return;
      resumed.current = true;
      if (build.mode === "link") {
        setMode("link");
        setListingUrl(build.url);
        void importListing(build.url);
      } else {
        setMode("manual");
        setPropertyName(build.name);
        setAddress(build.address);
        if (build.style) setStyle(build.style);
        void startFromTemplate(build);
      }
    })();
    // runs once on arrival; the build functions only read state set here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The token to create with: the signed-in user's, or a new guest session's. When guests aren't
   * available the person signs up first, and what they asked for is built once they're back here.
   */
  const sessionForCreate = async (build: PendingBuild): Promise<{ token: string; guest: boolean } | null> => {
    const session = await ensureSession();
    if (!session) {
      savePendingBuild(build);
      router.push("/signup?build=1");
      return null;
    }
    setSessionToken(session.token);
    setGuest(session.guest);
    return session;
  };

  const remember = (id: string, session: { token: string; guest: boolean }) => {
    try {
      sessionStorage.setItem("guidebookId", id);
      localStorage.setItem("guidebookId", id);
    } catch { }
    // A guest keeps a claim ticket so the guidebook follows them into their account
    if (session.guest) void rememberGuestGuidebook(session.token);
  };

  const slugFor = async (id: string, token: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/guidebooks/${id}`, { headers: authHeaders(token) });
      const data = res.ok ? await res.json() : null;
      return typeof data?.public_slug === "string" ? data.public_slug : null;
    } catch {
      return null;
    }
  };

  const startProgress = () => {
    setStepIndex(0);
    setProgress(3);
    // Imports take 20-60s and report nothing until done, so ease toward 92% and finish on completion
    timer.current = setInterval(() => {
      setProgress((p) => {
        const next = p + (92 - p) * 0.035;
        setStepIndex(Math.min(IMPORT_STEPS.length - 1, Math.floor(next / 23)));
        return next;
      });
    }, 500);
  };
  const stopProgress = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const importListing = async (urlOverride?: string) => {
    const url = (urlOverride ?? listingUrl).trim();
    if (!url || busy) return;
    setBusy(true);
    setError(null);
    setFromImport(true);
    setQuestionStep(0);
    setQuestionsDone(false);
    startProgress();
    try {
      const session = await sessionForCreate({ mode: "link", url });
      if (!session) {
        setFromImport(false);
        return;
      }
      const token = session.token;
      const res = await fetch(`/api/import-listing`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ url }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) await throwApiError(res, "We couldn't import that listing. You can start with a template instead.");
      const json = await res.json();
      remember(json.guidebook_id, session);
      setCreated({
        id: json.guidebook_id,
        slug: await slugFor(json.guidebook_id, token),
        imported: json.imported ?? [],
        missing: json.missing ?? [],
        places: json.recommendations ?? null,
      });
      setProgress(100);
    } catch (e) {
      setFromImport(false);
      if (!offerUpgrade(e)) setError(e instanceof Error ? e.message : "We couldn't import that listing.");
    } finally {
      stopProgress();
      setBusy(false);
    }
  };

  // Once the imported guidebook exists and the host is through the questions, save what they answered
  const createdId = created?.id;
  useEffect(() => {
    if (!fromImport || !createdId || !questionsDone || savingAnswers.current) return;
    const payload = answersToPayload(answers);
    if (Object.keys(payload).length === 0) {
      savingAnswers.current = Promise.resolve();
      return;
    }
    savingAnswers.current = (async () => {
      try {
        const res = await fetch(`/api/guidebooks/${createdId}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(String(res.status));
        setPreviewKey((k) => k + 1);
      } catch {
        setError("We couldn't save some of your answers. You can add them in the editor.");
      }
    })();
    // authHeaders only reads the token, which is stable here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromImport, createdId, questionsDone, answers]);

  const inImportFlow = fromImport && (!created || !questionsDone);

  const startFromTemplate = async (override?: { name: string; address: string; style: string }) => {
    const name = (override?.name ?? propertyName).trim();
    const where = (override?.address ?? address).trim();
    const look = override?.style || style;
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const session = await sessionForCreate({ mode: "manual", name, address: where, style: look });
      if (!session) return;
      const token = session.token;
      const res = await fetch(`/api/generate`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          property_name: name,
          address_street: where,
          welcome_message: "Welcome! We hope you have a wonderful stay.",
          template_key: look,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) await throwApiError(res, "We couldn't create your guidebook. Please try again.");
      const json = await res.json();
      remember(json.guidebook_id, session);
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
      const res = await fetch(`/api/guidebook/${created.id}/template`, {
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

  const message = busy && mode === "link" ? IMPORT_STEPS[stepIndex] : busy ? "Setting up your guidebook…" : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F5F1] via-white to-[#F8F5F1] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-10">
          {claiming ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Spinner />
              <h1 className="text-2xl font-semibold text-gray-900">Saving your guidebook to your account…</h1>
            </div>
          ) : inImportFlow ? (
            <>
              <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
                {created ? "Your guidebook is ready" : "Building your guidebook…"}
              </h1>
              <p className="mt-3 text-lg text-gray-600">
                {created
                  ? "Finish these questions, or skip ahead and see it."
                  : "Answer a few quick questions while Guidewise reads your listing. Skip anything you like."}
              </p>
              <div className="mt-6 space-y-4">
                <ImportProgress
                  progress={created ? 100 : progress}
                  label={created ? "Your guidebook is ready" : IMPORT_STEPS[stepIndex]}
                  done={Boolean(created)}
                />
                {!questionsDone && (
                  <ImportQuestions
                    answers={answers}
                    onChange={(patch) => setAnswers((a) => ({ ...a, ...patch }))}
                    step={questionStep}
                    onStep={setQuestionStep}
                    onFinish={() => setQuestionsDone(true)}
                  />
                )}
                {questionsDone && !created && (
                  <p className="flex items-center gap-2 text-sm text-gray-600">
                    <Spinner size={16} /> Thanks! Finishing your guidebook, almost there…
                  </p>
                )}
                {created && !questionsDone && (
                  <button type="button" onClick={() => setQuestionsDone(true)} className="text-sm font-medium text-primary hover:underline">
                    Skip the rest and see my guidebook
                  </button>
                )}
              </div>
            </>
          ) : !created ? (
            <>
              <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-5xl">
                Welcome your guests with a guidebook they&apos;ll love. Free.
              </h1>
              <p className="mt-5 text-lg text-gray-600">
                Paste your listing and Guidewise writes the check-in steps, house rules and local favorites for you. Watch your guidebook take shape on the phone.
              </p>

              <div className="mt-8 flex flex-wrap gap-3" role="radiogroup" aria-label="How do you want to start?">
                <ModeButton selected={mode === "link"} onClick={() => setMode("link")} disabled={busy}>
                  Start with a link
                </ModeButton>
                <ModeButton selected={mode === "manual"} onClick={() => setMode("manual")} disabled={busy}>
                  Manual setup
                </ModeButton>
              </div>

              {mode === "link" ? (
                <div className="mt-8">
                  <Label htmlFor="listing-url" className="text-lg font-semibold text-gray-900">
                    Paste your Airbnb or VRBO link
                  </Label>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="listing-url"
                      type="url"
                      placeholder="https://www.airbnb.com/rooms/…"
                      value={listingUrl}
                      onChange={(e) => setListingUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") importListing(); }}
                      disabled={busy}
                      className="h-14 rounded-2xl px-5 text-base"
                    />
                    <Button type="button" onClick={() => importListing()} disabled={busy || !listingUrl.trim()} className="h-14 rounded-2xl px-8 text-base">
                      {busy ? <Spinner /> : "Build my guidebook"}
                    </Button>
                  </div>
                  {busy && <p className="mt-3 text-sm text-gray-500">This can take up to a minute. Your guidebook appears on the phone as soon as it&apos;s ready.</p>}
                  <p className="mt-4 text-sm text-gray-500">Works with Airbnb and VRBO listings. No listing yet? Choose Manual setup.</p>
                </div>
              ) : (
                <div className="mt-8 space-y-5">
                  <div>
                    <Label htmlFor="property-name" className="text-lg font-semibold text-gray-900">What&apos;s your place called?</Label>
                    <Input
                      id="property-name"
                      placeholder="e.g. Willow Cottage"
                      value={propertyName}
                      onChange={(e) => setPropertyName(e.target.value)}
                      disabled={busy}
                      className="mt-3 h-14 rounded-2xl px-5 text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold text-gray-900">Where is it? <span className="text-sm font-normal text-gray-500">(so we can suggest places nearby)</span></Label>
                    <PlacesAutocomplete value={address} onChange={setAddress} placeholder="Start typing an address…" className="mt-3 h-14 rounded-2xl" />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold text-gray-900">Pick a look</Label>
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
                  <Button type="button" onClick={() => startFromTemplate()} disabled={busy || !propertyName.trim()} className="h-14 rounded-2xl px-8 text-base">
                    {busy ? <Spinner /> : "Start my guidebook"}
                  </Button>
                </div>
              )}

              {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
                {isGuest ? "Your guidebook is ready! 🎉" : "Your guidebook is live! 🎉"}
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                {isGuest
                  ? "Have a look on the phone. Create a free account to save it, then customize it and share it with your guests."
                  : "It’s already on the phone. Tap around, then fine-tune anything you like. Changes appear instantly."}
              </p>

              {created.imported.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Guidewise filled in</h2>
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
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Make it yours</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {created.missing.map((item) => (
                      <li key={item} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Look</h2>
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

              {isGuest ? (
                <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
                  <h2 className="text-lg font-semibold text-gray-900">Save your guidebook</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    It&apos;s free. Your guidebook moves into your account, ready to customize and share. Until then it isn&apos;t visible to guests.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button type="button" className="h-12 rounded-2xl px-8 text-base" onClick={async () => { await savingAnswers.current; router.push("/signup?save=1"); }}>
                      Create a free account
                    </Button>
                    <Link href="/login?save=1" onClick={async (e) => { e.preventDefault(); await savingAnswers.current; router.push("/login?save=1"); }} className="text-sm font-medium text-gray-700 underline">
                      I already have an account
                    </Link>
                  </div>
                </div>
              ) : (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button type="button" className="h-12 rounded-2xl px-8 text-base" onClick={async () => { await savingAnswers.current; router.push(`/edit/${created.id}?new=true`); }}>
                  Customize it
                </Button>
                {created.slug && (
                  <Link href={`/g/${created.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="outline" className="h-12 rounded-2xl px-6 text-base">Open the live page</Button>
                  </Link>
                )}
                <Link href="/dashboard" className="text-sm text-gray-600 underline">Go to dashboard</Link>
              </div>
              )}
            </>
          )}
        </section>

        <aside className="order-first lg:order-none lg:sticky lg:top-8">
          <PhonePreview guidebookId={created?.id} accessToken={accessToken} refreshKey={previewKey} message={message} sampleTemplate={style} />
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
