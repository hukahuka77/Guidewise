/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { LIMITS } from "@/constants/limits";
import ConfirmModal from "@/components/ui/ConfirmModal";

export interface DynamicItem {
  name: string;
  address: string;
  description: string;
  image_url?: string;
  driving_minutes?: number | null;
}

interface DynamicItemListProps {
  items: DynamicItem[];
  onChange: (index: number, field: keyof DynamicItem, value: string) => void;
  onAdd: () => void;
  label: string;
}

interface DynamicItemListProps {
  items: DynamicItem[];
  onChange: (idx: number, field: keyof DynamicItem, value: string) => void;
  onAdd: () => void;
  onDelete?: (idx: number) => void;
  label: string;
}

const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;

export default function DynamicItemList({ items, onChange, onAdd, onDelete, label }: DynamicItemListProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const uploadImage = async (idx: number, file: File) => {
    try {
      setUploadingIdx(idx);
      if (!supabase) throw new Error("Supabase not configured");
      if (!BUCKET_NAME) throw new Error("Supabase bucket not configured (NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET)");
      const ext = file.name.split('.').pop() || 'jpg';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `guidebook/${Date.now()}-${idx}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { contentType: file.type || `image/${ext}`, upsert: true });
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
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onChange(idx, "image_url", dataUrl);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingIdx(null);
    }
  };
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">{label}</h2>
      </div>
      {items.length === 0 ? (
        <button type="button" onClick={onAdd} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition">
          <Plus style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
          <span>Add</span>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-white/80 shadow flex flex-col gap-2 relative">
                {onDelete && (
                  <button
                    type="button"
                    aria-label="Delete item"
                    className="absolute top-2 left-2 z-20 p-1 rounded bg-white/90 hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                    onClick={() => {
                      setPendingDeleteIdx(idx);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={20} />
                  </button>
                )}
                {item.image_url ? (
                  <div className="relative mb-2">
                    <img
                      src={
                        item.image_url.startsWith('http')
                          ? (
                              item.image_url.includes('/maps.googleapis.com/maps/api/place/photo') && /[?&]photo_reference=([^&]+)/.test(item.image_url)
                                ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/place-photo?photo_reference=${encodeURIComponent((item.image_url.match(/[?&]photo_reference=([^&]+)/) || [,''])[1])}&maxwidth=800`
                                : item.image_url
                            )
                          : `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/place-photo?photo_reference=${encodeURIComponent(item.image_url)}&maxwidth=800`
                      }
                      alt={item.name + " image"}
                      className="w-full h-32 object-cover rounded border shadow"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-white/90 border shadow hover:bg-white"
                      onClick={() => onChange(idx, "image_url", "")}
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <div
                    className="mb-2 w-full h-32 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-sm text-gray-500 bg-gray-50/40 hover:bg-gray-50 cursor-pointer"
                    onClick={() => document.getElementById(`upload-${idx}`)?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (!file) return;
                      await uploadImage(idx, file);
                    }}
                  >
                    {uploadingIdx === idx ? "Uploading…" : "Drop image here or click to upload"}
                  </div>
                )}
                <input
                  id={`upload-${idx}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await uploadImage(idx, file);
                  }}
                />
                <Label>Name</Label>
                <Input maxLength={LIMITS.itemName} value={item.name} onChange={e => onChange(idx, "name", e.target.value)} />
                {item.address && (
                  <div className="mt-1 mb-2">
                    <div className="flex items-center text-xs text-gray-600">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7-7.5 11-7.5 11s-7.5-4-7.5-11a7.5 7.5 0 1115 0z"/></svg>
                      <span>{item.address}</span>
                    </div>
                    {item.driving_minutes != null && (
                      <div className="flex items-center text-xs text-gray-500 mt-1 ml-5">
                        🚗 {item.driving_minutes} min drive
                      </div>
                    )}
                  </div>
                )}
                <Label>Address</Label>
                <Input maxLength={LIMITS.itemAddress} value={item.address} onChange={e => onChange(idx, "address", e.target.value)} />
                <Label>Description</Label>
                <Textarea maxLength={LIMITS.itemDescription} value={item.description} onChange={e => onChange(idx, "description", e.target.value)} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (items.length >= LIMITS.maxFoodActivityItems) return;
              onAdd();
            }}
            disabled={items.length >= LIMITS.maxFoodActivityItems}
            className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition mt-6 ${items.length >= LIMITS.maxFoodActivityItems ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
            <span>Add another</span>
          </button>
        </>
      )}

      {onDelete && (
        <ConfirmModal
          open={showDeleteConfirm}
          title="Remove item?"
          description={"This will permanently remove this place or activity from your guidebook."}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          destructive
          onCancel={() => {
            setShowDeleteConfirm(false);
            setPendingDeleteIdx(null);
          }}
          onConfirm={() => {
            if (pendingDeleteIdx == null) {
              setShowDeleteConfirm(false);
              return;
            }
            onDelete(pendingDeleteIdx);
            setShowDeleteConfirm(false);
            setPendingDeleteIdx(null);
          }}
        />
      )}
    </section>
  );
}
