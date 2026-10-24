"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** "16:00" -> "4:00 PM" ("" stays ""). */
export function formatTime(value: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Read a typed time: "4", "4pm", "4:30 p", "16:30", "1630", "noon". A bare hour from 1 to 7 is read as
 * PM since guests rarely arrive or leave at night; null when it isn't a time.
 */
export function parseTime(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/\./g, "");
  if (!raw) return null;
  if (raw === "noon") return "12:00";
  if (raw === "midnight") return "00:00";
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59 || h > 23) return null;
  const meridiem = m[3]?.[0];
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === "p" && h !== 12) h += 12;
    if (meridiem === "a" && h === 12) h = 0;
  } else if (h >= 1 && h <= 7 && !m[1].startsWith("0")) {
    h += 12;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Every half hour, from 6 AM round to 5:30 AM, so the morning and afternoon come first
const SLOTS = Array.from({ length: 48 }, (_, i) => {
  const minutes = (6 * 60 + i * 30) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

/** A time field you can type into ("4pm", "16:30") or pick from a half-hourly list. Values are "HH:MM". */
export default function TimePicker({ id, value, onChange, className, "aria-label": ariaLabel }: TimePickerProps) {
  const listId = useId();
  const [text, setText] = useState(formatTime(value));
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(formatTime(value)), [value]);

  // Open on the current time (or the nearest slot), not at the top of the list
  useEffect(() => {
    if (!open || !listRef.current) return;
    const nearest = SLOTS.find((s) => s >= value.slice(0, 5)) ?? SLOTS[0];
    const el = listRef.current.querySelector<HTMLElement>(`[data-slot="${SLOTS.includes(value) ? value : nearest}"]`);
    if (el) listRef.current.scrollTop = el.offsetTop - listRef.current.clientHeight / 2 + el.clientHeight / 2;
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const commit = () => {
    if (!text.trim()) {
      setInvalid(false);
      if (value) onChange("");
      return;
    }
    const parsed = parseTime(text);
    if (parsed) {
      setInvalid(false);
      onChange(parsed);
      setText(formatTime(parsed));
    } else {
      setInvalid(true);
    }
  };

  const pick = (slot: string) => {
    setInvalid(false);
    onChange(slot);
    setText(formatTime(slot));
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative w-full sm:w-48", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-white pl-3.5 pr-1.5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition focus-within:ring-4",
          invalid ? "border-red-300 focus-within:ring-red-100" : "border-[#E7DFD4] focus-within:border-primary focus-within:ring-primary/15",
        )}
      >
        <Clock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="e.g. 4:00 PM"
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] tabular-nums text-gray-900 outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show times"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className="grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-[#F6F2EE]"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {invalid && <p className="mt-1 text-xs text-red-600">Try a time like 4pm or 16:30.</p>}
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-60 overflow-y-auto overscroll-contain rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/10"
        >
          {SLOTS.map((slot) => (
            <li
              key={slot}
              data-slot={slot}
              role="option"
              aria-selected={slot === value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(slot);
              }}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-2 text-sm tabular-nums",
                slot === value ? "bg-primary/10 font-semibold text-primary" : "text-gray-800 hover:bg-[#F6F2EE]",
              )}
            >
              {formatTime(slot)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
