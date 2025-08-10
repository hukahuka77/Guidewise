/* eslint-disable @next/next/no-img-element */
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash } from "lucide-react";

export interface DynamicItem {
  name: string;
  address: string;
  description: string;
  image_url?: string;
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

export default function DynamicItemList({ items, onChange, onAdd, onDelete, label }: DynamicItemListProps) {
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
                    className="absolute top-2 right-2 p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                    onClick={() => onDelete(idx)}
                  >
                    <Trash style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={20} />
                  </button>
                )}
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name + " image"}
                    className="w-full h-32 object-cover rounded mb-2 border shadow"
                  />
                ) : (
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(item.address)}&zoom=15&size=400x200&maptype=roadmap&markers=color:pink%7C${encodeURIComponent(item.address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`}
                    alt={item.name + " map preview"}
                    className="w-full h-32 object-cover rounded mb-2 border shadow opacity-80"
                  />
                )}
                <Label>Name</Label>
                <Input value={item.name} onChange={e => onChange(idx, "name", e.target.value)} />
                {item.address && (
                  <div className="flex items-center text-xs text-gray-600 mt-1 mb-2">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7-7.5 11-7.5 11s-7.5-4-7.5-11a7.5 7.5 0 1115 0z"/></svg>
                    <span>{item.address}</span>
                  </div>
                )}
                <Label>Address</Label>
                <Input value={item.address} onChange={e => onChange(idx, "address", e.target.value)} />
                <Label>Description</Label>
                <Textarea value={item.description} onChange={e => onChange(idx, "description", e.target.value)} />
              </div>
            ))}
          </div>
          <button type="button" onClick={onAdd} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition mt-6">
            <Plus style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
            <span>Add another</span>
          </button>
        </>
      )}
    </section>
  );
}
