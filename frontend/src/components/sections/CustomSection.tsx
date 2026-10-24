import React, { useState } from "react";
import { ImagePlus, Text, Trash2 } from "lucide-react";
import { LIMITS } from "@/constants/limits";
import { Card, CardHeader, Field, IconButton, inputClass, compactTextareaClass, textareaClass } from "@/components/editor/primitives";
import { MediaSlot, pickMedia } from "./HouseManualList";

export type CustomItemText = { type: "text"; content: string };
export type CustomItemManual = { type: "manual"; name: string; description: string; mediaUrl?: string; mediaType?: "image" | "video" };
export type CustomItem = CustomItemText | CustomItemManual;

interface CustomSectionProps {
  sectionKey: string;
  label: string;
  items: CustomItem[];
  onChange: (items: CustomItem[]) => void;
  onLabelChange: (newLabel: string) => void;
  onMediaSelect?: (idx: number, file: File | null) => void;
  onRemoveMedia?: (idx: number) => void;
}

export default function CustomSection({ sectionKey, label, items, onChange, onLabelChange, onMediaSelect, onRemoveMedia }: CustomSectionProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const full = items.length >= LIMITS.maxCustomSectionItems;

  const update = (index: number, next: CustomItem) => onChange(items.map((it, i) => (i === index ? next : it)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  const attach = (idx: number) =>
    pickMedia(async (file) => {
      if (!onMediaSelect) return;
      try {
        setUploadingIdx(idx);
        await onMediaSelect(idx, file);
      } finally {
        setUploadingIdx(null);
      }
    });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Section name" description="Shown as a tab and heading in your guidebook." />
        <Field label="Name" htmlFor={`${sectionKey}-label`} count={[label.length, LIMITS.customTabTitle]}>
          <div className="flex items-center gap-3">
            <input
              id={`${sectionKey}-label`}
              value={label}
              onChange={(e) => onLabelChange(e.target.value.slice(0, LIMITS.customTabTitle))}
              placeholder="Section name"
              maxLength={LIMITS.customTabTitle}
              className={`${inputClass} max-w-xs font-medium`}
            />
          </div>
        </Field>
      </Card>

      <Card>
        <CardHeader title="Content" description="Mix paragraphs of text with items that have a photo or video." />
        {items.length > 0 && (
          <ul className="mb-4 space-y-3">
            {items.map((item, idx) => (
              <li key={idx} className="flex flex-col gap-3 rounded-xl border border-[#ECE5DB] bg-[#FDFBF8] p-3 sm:flex-row sm:p-4">
                {item.type === "text" ? (
                  <textarea
                    id={`${sectionKey}-item-${idx}`}
                    aria-label={`Text ${idx + 1}`}
                    value={item.content}
                    maxLength={LIMITS.customText}
                    onChange={(e) => update(idx, { type: "text", content: e.target.value })}
                    placeholder="Write anything guests should know…"
                    rows={4}
                    className={`${textareaClass} flex-1`}
                  />
                ) : (
                  <>
                    <MediaSlot url={item.mediaUrl} type={item.mediaType} uploading={uploadingIdx === idx} onAdd={() => attach(idx)} onRemove={() => onRemoveMedia?.(idx)} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <input aria-label="Title" value={item.name} onChange={(e) => update(idx, { ...item, name: e.target.value })} placeholder="Title" className={`${inputClass} font-medium`} />
                      <textarea aria-label="Details" value={item.description} onChange={(e) => update(idx, { ...item, description: e.target.value })} placeholder="Details" rows={2} className={compactTextareaClass} />
                    </div>
                  </>
                )}
                <div className="flex justify-end sm:block">
                  <IconButton label="Remove" tone="danger" onClick={() => remove(idx)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={full} onClick={() => onChange([...items, { type: "text", content: "" }])} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#DCD2C4] bg-[#FBF8F4] px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
            <Text className="size-4" /> Add text
          </button>
          <button type="button" disabled={full} onClick={() => onChange([...items, { type: "manual", name: "", description: "" }])} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#DCD2C4] bg-[#FBF8F4] px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
            <ImagePlus className="size-4" /> Add item with photo
          </button>
        </div>
        {full && <p className="mt-3 text-sm text-amber-700">You&apos;ve reached the limit of {LIMITS.maxCustomSectionItems} items for this section.</p>}
      </Card>
    </div>
  );
}
