"use client";

import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { Button } from "@/components/ui/button";
import { inputClass, textareaClass } from "@/components/editor/primitives";
import { LIMITS } from "@/constants/limits";

export interface ImportAnswers {
  address: string;
  wifiNetwork: string;
  wifiPassword: string;
  checkIn: string;
  checkOut: string;
  access: string;
  hostName: string;
  hostContact: string;
}

export const EMPTY_ANSWERS: ImportAnswers = {
  address: "", wifiNetwork: "", wifiPassword: "", checkIn: "", checkOut: "", access: "", hostName: "", hostContact: "",
};

/** Only what the host actually answered, in the shape PUT /api/guidebooks/:id expects. */
export function answersToPayload(a: ImportAnswers): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, value: string) => { if (value.trim()) out[key] = value.trim(); };
  put("address_street", a.address);
  put("wifi_network", a.wifiNetwork);
  put("wifi_password", a.wifiPassword);
  put("check_in_time", a.checkIn);
  put("check_out_time", a.checkOut);
  put("access_info", a.access);
  put("host_name", a.hostName);
  put("host_contact", a.hostContact);
  return out;
}

interface Question {
  title: string;
  why: string;
  answered: (a: ImportAnswers) => boolean;
  render: (a: ImportAnswers, set: (patch: Partial<ImportAnswers>) => void) => React.ReactNode;
}

const QUESTIONS: Question[] = [
  {
    title: "What's the exact address?",
    why: "Listings only show the rough area. The exact address gives guests accurate directions.",
    answered: (a) => Boolean(a.address.trim()),
    render: (a, set) => (
      <PlacesAutocomplete value={a.address} onChange={(v) => set({ address: v })} placeholder="Start typing your address…" className={`${inputClass} h-auto`} />
    ),
  },
  {
    title: "What's the Wi-Fi?",
    why: "It's the first thing guests look for, so it goes right at the top with a copy button.",
    answered: (a) => Boolean(a.wifiNetwork.trim() || a.wifiPassword.trim()),
    render: (a, set) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <input aria-label="Network name" value={a.wifiNetwork} maxLength={LIMITS.wifiNetwork} onChange={(e) => set({ wifiNetwork: e.target.value })} placeholder="Network name" className={inputClass} />
        <input aria-label="Password" value={a.wifiPassword} maxLength={LIMITS.wifiPassword} onChange={(e) => set({ wifiPassword: e.target.value })} placeholder="Password" className={inputClass} />
      </div>
    ),
  },
  {
    title: "When do guests arrive and leave?",
    why: "We'll show check-in and check-out times up front.",
    answered: (a) => Boolean(a.checkIn || a.checkOut),
    render: (a, set) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-gray-700">
          <span>Check-in from</span>
          <input type="time" value={a.checkIn} onChange={(e) => set({ checkIn: e.target.value })} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-gray-700">
          <span>Check-out by</span>
          <input type="time" value={a.checkOut} onChange={(e) => set({ checkOut: e.target.value })} className={inputClass} />
        </label>
      </div>
    ),
  },
  {
    title: "How do guests get in?",
    why: "Door code, lockbox or key steps. It's shown highlighted in the arrival section.",
    answered: (a) => Boolean(a.access.trim()),
    render: (a, set) => (
      <textarea aria-label="Getting in" value={a.access} maxLength={LIMITS.accessInfo} onChange={(e) => set({ access: e.target.value })} rows={3} placeholder="e.g. The lockbox is left of the door. Your code arrives the morning you check in." className={textareaClass} />
    ),
  },
  {
    title: "How can guests reach you?",
    why: "A phone number adds Call and Text buttons to your guidebook.",
    answered: (a) => Boolean(a.hostName.trim() || a.hostContact.trim()),
    render: (a, set) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <input aria-label="Your name" value={a.hostName} maxLength={LIMITS.hostName} onChange={(e) => set({ hostName: e.target.value })} placeholder="Your first name" className={inputClass} />
        <input aria-label="Phone or email" value={a.hostContact} maxLength={LIMITS.hostContact} onChange={(e) => set({ hostContact: e.target.value })} placeholder="Phone or email" className={inputClass} />
      </div>
    ),
  },
];

export const QUESTION_COUNT = QUESTIONS.length;

/** A determinate-looking bar for work whose length we can't know: eases toward 92% until done. */
export function ImportProgress({ progress, label, done }: { progress: number; label: string; done: boolean }) {
  return (
    <div className="rounded-2xl border border-[#ECE5DB] bg-[#FBF8F4] p-4" role="status" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-gray-800">
          {done ? <Check className="size-4 text-emerald-600" /> : <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
          {label}
        </span>
        <span className="tabular-nums text-gray-500">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EDE5DA]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${done ? "bg-emerald-500" : "bg-gradient-to-r from-[#db2777] to-[#f97316]"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface ImportQuestionsProps {
  answers: ImportAnswers;
  onChange: (patch: Partial<ImportAnswers>) => void;
  step: number;
  onStep: (step: number) => void;
  /** Called after the last question (answered or skipped). */
  onFinish: () => void;
}

/** One question at a time while the listing imports. Every question can be skipped. */
export default function ImportQuestions({ answers, onChange, step, onStep, onFinish }: ImportQuestionsProps) {
  const q = QUESTIONS[step];
  if (!q) return null;
  const last = step === QUESTIONS.length - 1;
  const next = () => (last ? onFinish() : onStep(step + 1));
  return (
    <div className="rounded-2xl border border-[#ECE5DB] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">While we build it · {step + 1} of {QUESTIONS.length}</p>
        <div className="flex gap-1" aria-hidden="true">
          {QUESTIONS.map((_, i) => (
            <span key={i} className={`h-1.5 w-5 rounded-full ${i < step ? "bg-primary/60" : i === step ? "bg-primary" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      <h2 className="text-xl font-semibold text-gray-900">{q.title}</h2>
      <p className="mt-1 text-sm text-gray-500">{q.why}</p>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {q.render(answers, onChange)}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => onStep(step - 1)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-gray-500 hover:text-gray-800">
              <ArrowLeft className="size-4" /> Back
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={next} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800">
              Skip
            </button>
            <Button type="submit" className="h-11 rounded-xl px-6" disabled={!q.answered(answers)}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
