/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useId, useRef, useState } from "react";
import { Check, ImagePlus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared look for the guidebook editor: white cards on Guidewise cream, coral accents.

export const inputClass =
  "w-full rounded-xl border border-[#E7DFD4] bg-white px-3.5 py-2.5 text-[15px] text-gray-900 placeholder:text-gray-400 shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60";

export const textareaClass = cn(inputClass, "min-h-[96px] resize-y leading-relaxed");

/** Smaller text box for the second line of a list row. */
export const compactTextareaClass = cn(inputClass, "min-h-[60px] resize-y text-sm leading-relaxed");

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-[#ECE5DB] bg-white p-5 shadow-[0_1px_2px_rgba(34,28,23,0.04)] sm:p-6", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  /** Current length and maximum, shown as a counter once the text gets long. */
  count?: [number, number];
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, required, count, children, className }: FieldProps) {
  const showCount = count && count[1] > 0 && count[0] >= count[1] * 0.8;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-gray-800">
          {label}
          {required && <span className="ml-0.5 text-primary" title="Required">*</span>}
        </label>
        {showCount && <span className="text-xs tabular-nums text-gray-400">{count[0]}/{count[1]}</span>}
      </div>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** Quick-add chips: tap to add a common item, tap again to remove it. */
export function SuggestionChips({
  items,
  isActive,
  onToggle,
  label = "Quick add",
}: {
  items: string[];
  isActive: (name: string) => boolean;
  onToggle: (name: string) => void;
  label?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((name) => {
          const active = isActive(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(name)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                active
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-[#E7DFD4] bg-white text-gray-700 hover:border-primary/50 hover:text-gray-900",
              )}
            >
              {active ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AddRowButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#DCD2C4] bg-[#FBF8F4] px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary/60 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus className="size-4" />
      {children}
    </button>
  );
}

export function IconButton({ label, onClick, children, tone = "default" }: { label: string; onClick: () => void; children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-gray-400 transition",
        tone === "danger" ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-gray-100 hover:text-gray-700",
      )}
    >
      {children}
    </button>
  );
}

/** Click or drag-and-drop image picker with a preview. */
export function ImageDrop({
  previewUrl,
  onFile,
  onRemove,
  shape = "wide",
  label = "Upload a photo",
  hint,
}: {
  previewUrl: string | null;
  onFile: (file: File) => void;
  onRemove?: () => void;
  shape?: "wide" | "round";
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const round = shape === "round";
  return (
    <div className={cn("relative", round ? "size-24 shrink-0" : "w-full")}>
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={cn(
          "group flex cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed bg-[#FBF8F4] text-gray-500 transition hover:border-primary/60 hover:text-primary",
          round ? "size-24 rounded-full" : "aspect-[16/6] max-h-60 w-full rounded-2xl",
          over ? "border-primary bg-primary/5 text-primary" : "border-[#DCD2C4]",
          previewUrl && "border-solid border-transparent",
        )}
      >
        <input
          id={id}
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="" className="size-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
              Change
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center">
            <ImagePlus className={round ? "size-5" : "size-6"} />
            {!round && <span className="text-sm font-medium">{label}</span>}
            {!round && hint && <span className="text-xs text-gray-400">{hint}</span>}
          </span>
        )}
      </label>
      {previewUrl && onRemove && (
        <button
          type="button"
          aria-label="Remove photo"
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 inline-flex size-7 items-center justify-center rounded-full border border-[#E7DFD4] bg-white text-gray-500 shadow-sm hover:text-red-600"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Pill switch used for "Show in guidebook". */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn("inline-flex select-none items-center gap-2.5 text-sm text-gray-700", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition", checked ? "bg-primary" : "bg-gray-300")}
      >
        <span className={cn("inline-block size-5 rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}
