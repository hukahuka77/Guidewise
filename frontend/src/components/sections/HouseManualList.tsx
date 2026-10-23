/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import { Film, ImagePlus, Trash2, X } from "lucide-react";
import Spinner from "@/components/ui/spinner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { AddRowButton, Card, CardHeader, IconButton, SuggestionChips, inputClass, compactTextareaClass } from "@/components/editor/primitives";

export type HouseManualItem = { name: string; description: string; mediaUrl?: string; mediaType?: "image" | "video" };

interface HouseManualListProps {
  items: HouseManualItem[];
  onChange: (idx: number, field: keyof HouseManualItem, value: string) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onMediaSelect?: (idx: number, file: File | null) => void;
  onRemoveMedia?: (idx: number) => void;
}

const HOUSE_MANUAL_SUGGESTIONS: Pick<HouseManualItem, "name" | "description">[] = [
  { name: "Trash Location", description: "Where guests can find the trash and recycling bins, and when pickup day is." },
  { name: "Thermostat / HVAC", description: "How to use the thermostat or AC/heat, including any limits or eco settings." },
  { name: "Washer / Dryer", description: "Instructions for using the washer and dryer, including detergent and cycle tips." },
  { name: "Parking Instructions", description: "Where to park, how many cars are allowed, and any street parking rules." },
  { name: "Hot Tub / Pool", description: "How to operate the hot tub or pool safely, including covers and temperature limits." },
];

/** Opens a file picker for a photo or video and hands the file to `onPick`. */
export function pickMedia(onPick: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  };
  input.click();
}

/** Thumbnail of an attached photo/video, or a button to attach one. */
export function MediaSlot({
  url,
  type,
  uploading,
  onAdd,
  onRemove,
}: {
  url?: string;
  type?: "image" | "video";
  uploading: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (uploading) {
    return (
      <div className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#DCD2C4] text-sm text-gray-500 sm:w-36">
        <Spinner size={16} colorClass="text-primary" /> Uploading…
      </div>
    );
  }
  if (url) {
    return (
      <div className="relative h-24 w-full overflow-hidden rounded-xl border border-[#ECE5DB] bg-gray-100 sm:w-36">
        {type === "video" ? <video src={url} className="size-full object-cover" muted /> : <img src={url} alt="" className="size-full object-cover" />}
        {type === "video" && <Film className="absolute bottom-1.5 left-1.5 size-4 text-white drop-shadow" />}
        <button type="button" aria-label="Remove media" onClick={onRemove} className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-red-600">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#DCD2C4] bg-[#FBF8F4] text-xs font-medium text-gray-500 transition hover:border-primary/60 hover:text-primary sm:w-36"
    >
      <ImagePlus className="size-5" />
      Photo or video
    </button>
  );
}

export default function HouseManualList({ items, onChange, onAdd, onDelete, onMediaSelect, onRemoveMedia }: HouseManualListProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);

  const findIndex = (name: string) => items.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());

  const toggleSuggestion = (name: string) => {
    const existing = findIndex(name);
    if (existing >= 0) {
      onDelete(existing);
      return;
    }
    const s = HOUSE_MANUAL_SUGGESTIONS.find((x) => x.name === name);
    if (!s) return;
    const newIdx = items.length;
    onAdd();
    onChange(newIdx, "name", s.name);
    onChange(newIdx, "description", s.description);
  };

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
    <Card>
      <CardHeader title="How things work" description="Explain the appliances, quirks and house systems. A short video often says it best." />
      <SuggestionChips items={HOUSE_MANUAL_SUGGESTIONS.map((s) => s.name)} isActive={(n) => findIndex(n) >= 0} onToggle={toggleSuggestion} />

      {items.length > 0 && (
        <ul className="mb-4 space-y-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex flex-col gap-3 rounded-xl border border-[#ECE5DB] bg-[#FDFBF8] p-3 sm:flex-row sm:p-4">
              <MediaSlot
                url={item.mediaUrl}
                type={item.mediaType}
                uploading={uploadingIdx === idx}
                onAdd={() => attach(idx)}
                onRemove={() => onRemoveMedia?.(idx)}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <input aria-label="Title" value={item.name} onChange={(e) => onChange(idx, "name", e.target.value)} placeholder="e.g. Coffee machine" className={`${inputClass} font-medium`} />
                <textarea aria-label="Instructions" value={item.description} onChange={(e) => onChange(idx, "description", e.target.value)} placeholder="Where it is and how to use it." rows={2} className={compactTextareaClass} />
              </div>
              <div className="flex justify-end sm:block">
                <IconButton label="Remove" tone="danger" onClick={() => setPendingDeleteIdx(idx)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddRowButton onClick={onAdd}>Add an item</AddRowButton>

      <ConfirmModal
        open={pendingDeleteIdx !== null}
        title="Remove this item?"
        description="It will be removed from your guidebook, along with any attached photo or video."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setPendingDeleteIdx(null)}
        onConfirm={() => {
          if (pendingDeleteIdx !== null) onDelete(pendingDeleteIdx);
          setPendingDeleteIdx(null);
        }}
      />
    </Card>
  );
}
