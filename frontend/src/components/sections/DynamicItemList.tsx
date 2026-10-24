/* eslint-disable @next/next/no-img-element */
import React, { useRef, useState } from "react";
import { Car, ImagePlus, MapPin, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { LIMITS } from "@/constants/limits";
import { compressImage } from "@/utils/compressImage";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Spinner from "@/components/ui/spinner";
import { Card, CardHeader, IconButton, inputClass, compactTextareaClass } from "@/components/editor/primitives";

export interface DynamicItem {
  name: string;
  address: string;
  description: string;
  image_url?: string;
  place_id?: string;
  driving_minutes?: number | null;
}

interface DynamicItemListProps {
  items: DynamicItem[];
  onChange: (idx: number, field: keyof DynamicItem, value: string) => void;
  /** Adds an empty item to fill in by hand. */
  onAdd: () => void;
  onDelete?: (idx: number) => void;
  label: string;
  description?: string;
  /** Buttons shown in the card header (Add from Google, Suggest with AI). */
  toolbar?: React.ReactNode;
  emptyHint?: string;
}

const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;

function getItemImageUrl(item: DynamicItem): string {
  const imageUrl = item.image_url || "";
  if (imageUrl.startsWith("data:")) return imageUrl;

  let photoReference = imageUrl;
  if (imageUrl.startsWith("http")) {
    try {
      const parsed = new URL(imageUrl);
      if (!parsed.hostname.endsWith("googleapis.com") || !parsed.pathname.includes("/place/photo")) {
        return imageUrl;
      }
      photoReference = parsed.searchParams.get("photo_reference") || "";
    } catch {
      return imageUrl;
    }
  }

  const params = new URLSearchParams({ maxwidth: "800" });
  if (item.place_id) params.set("place_id", item.place_id);
  if (photoReference) params.set("photo_reference", photoReference);
  const query = [item.name, item.address].filter(Boolean).join(", ");
  if (query) params.set("query", query);
  return `/api/place-photo?${params.toString()}`;
}

export default function DynamicItemList({ items, onChange, onAdd, onDelete, label, description, toolbar, emptyHint }: DynamicItemListProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const full = items.length >= LIMITS.maxFoodActivityItems;

  const uploadImage = async (idx: number, original: File) => {
    setUploadingIdx(idx);
    // Big photos are scaled down first (this falls back to the original, never fails)
    const file = await compressImage(original);
    try {
      if (!supabase) throw new Error("Supabase not configured");
      if (!BUCKET_NAME) throw new Error("Supabase bucket not configured (NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET)");
      const ext = file.name.split(".").pop() || "jpg";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `guidebook/${Date.now()}-${idx}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET_NAME).upload(path, file, { contentType: file.type || `image/${ext}`, upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      if (pub?.publicUrl) {
        onChange(idx, "image_url", pub.publicUrl);
        return;
      }
      throw new Error("No public URL returned");
    } catch (e) {
      console.error("Upload failed, falling back to data URL:", e);
      // Fallback: inline data URL to avoid blocking the user
      const reader = new FileReader();
      reader.onload = () => onChange(idx, "image_url", reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploadingIdx(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={label}
        description={description}
        action={<span className="rounded-full bg-[#F5EFE7] px-2.5 py-1 text-xs font-medium text-gray-600">{items.length} of {LIMITS.maxFoodActivityItems}</span>}
      />
      {toolbar && <div className="mb-5 flex flex-wrap gap-2">{toolbar}</div>}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#DCD2C4] bg-[#FBF8F4] px-6 py-10 text-center">
          <MapPin className="mx-auto size-6 text-primary" />
          <p className="mt-2 text-sm font-medium text-gray-800">Nothing here yet</p>
          <p className="mt-1 text-sm text-gray-500">{emptyHint || "Add a few favorites from Google, or type them in yourself."}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex flex-col gap-3 rounded-xl border border-[#ECE5DB] bg-[#FDFBF8] p-3 sm:flex-row sm:p-4">
              <input
                ref={(el) => { fileInputs.current[idx] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) await uploadImage(idx, file);
                }}
              />
              {item.image_url ? (
                <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl border border-[#ECE5DB] bg-gray-100 sm:w-40">
                  <img src={getItemImageUrl(item)} alt="" className="size-full object-cover" />
                  <button type="button" aria-label="Remove photo" onClick={() => onChange(idx, "image_url", "")} className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-red-600">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputs.current[idx]?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) await uploadImage(idx, file);
                  }}
                  className="flex h-28 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#DCD2C4] bg-white text-xs font-medium text-gray-500 transition hover:border-primary/60 hover:text-primary sm:w-40"
                >
                  {uploadingIdx === idx ? <Spinner size={16} colorClass="text-primary" /> : <ImagePlus className="size-5" />}
                  {uploadingIdx === idx ? "Uploading…" : "Add a photo"}
                </button>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <input aria-label="Name" maxLength={LIMITS.itemName} value={item.name} onChange={(e) => onChange(idx, "name", e.target.value)} placeholder="Name" className={`${inputClass} font-medium`} />
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input aria-label="Address" maxLength={LIMITS.itemAddress} value={item.address} onChange={(e) => onChange(idx, "address", e.target.value)} placeholder="Address" className={`${inputClass} pl-9 text-sm`} />
                </div>
                <textarea aria-label="Description" maxLength={LIMITS.itemDescription} value={item.description} onChange={(e) => onChange(idx, "description", e.target.value)} placeholder="Why you recommend it" rows={2} className={compactTextareaClass} />
                {item.driving_minutes != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    <Car className="size-3.5" /> {item.driving_minutes} min drive
                  </span>
                )}
              </div>
              {onDelete && (
                <div className="flex justify-end sm:block">
                  <IconButton label="Remove" tone="danger" onClick={() => setPendingDeleteIdx(idx)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <button type="button" onClick={() => !full && onAdd()} disabled={full} className="mt-3 text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline">
          {full ? `Limit of ${LIMITS.maxFoodActivityItems} reached` : "+ Add one by hand"}
        </button>
      )}

      {onDelete && (
        <ConfirmModal
          open={pendingDeleteIdx !== null}
          title="Remove this place?"
          description="It will be removed from your guidebook."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          destructive
          onCancel={() => setPendingDeleteIdx(null)}
          onConfirm={() => {
            if (pendingDeleteIdx !== null) onDelete(pendingDeleteIdx);
            setPendingDeleteIdx(null);
          }}
        />
      )}
    </Card>
  );
}
