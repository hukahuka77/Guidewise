import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Check, X } from "lucide-react";
import { LIMITS } from "@/constants/limits";

export interface CheckoutInfoItem {
  name: string;
  description: string;
  checked: boolean;
}

interface CheckoutSectionProps {
  checkoutTime: string;
  items: CheckoutInfoItem[];
  onTimeChange: (value: string) => void;
  onChange: (idx: number, field: keyof CheckoutInfoItem, value: string | boolean) => void;
  onAdd: () => void;
}

export default function CheckoutSection({ checkoutTime, items, onTimeChange, onChange, onAdd }: CheckoutSectionProps) {
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const startEdit = (idx: number) => setEditing(prev => new Set(prev).add(idx));
  const finishEdit = (idx: number) => setEditing(prev => { const next = new Set(prev); next.delete(idx); return next; });
  const cancelEdit = (idx: number) => finishEdit(idx);
  const canAdd = items.length < LIMITS.maxCheckoutItems;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Checkout Info</h2>
      </div>
      <Label htmlFor="checkOutTime">Checkout Time</Label>
      <Input id="checkOutTime" type="time" step={300} value={checkoutTime} onChange={e => onTimeChange(e.target.value)} className="mb-2 mt-1 w-40" />
      <p className="text-sm text-gray-500 mb-2">Select your preferred checkout time (5-minute increments).</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
        {[...items.keys()].filter(i => items[i].checked).map((idx) => {
          const item = items[idx];
          const isEditing = editing.has(idx);
          return (
            <div key={idx} className={`p-4 rounded-lg bg-white/80 shadow flex flex-col gap-3 relative`}>
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {!isEditing ? (
                  <button
                    type="button"
                    aria-label="Edit info"
                    className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                    onClick={() => startEdit(idx)}
                  >
                    <Pencil style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="Save info"
                      className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                      onClick={() => finishEdit(idx)}
                    >
                      <Check style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel edit"
                      className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                      onClick={() => cancelEdit(idx)}
                    >
                      <X style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                    </button>
                  </>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={e => onChange(idx, 'checked', e.target.checked)}
                  className="mt-1 accent-[oklch(0.6923_0.22_21.05)]"
                />
                {!isEditing ? (
                  <span>
                    <span className="font-medium">{item.name || 'Untitled'}</span>
                    <br />
                    <span className="text-sm text-gray-600">{item.description || 'No description'}</span>
                  </span>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    <div>
                      <Label>Title</Label>
                      <Input maxLength={LIMITS.checkoutName} value={item.name} onChange={e => onChange(idx, 'name', e.target.value)} placeholder="e.g. Trash & linens" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea maxLength={LIMITS.checkoutDescription} value={item.description} onChange={e => onChange(idx, 'description', e.target.value)} placeholder="What guests should know before checkout..." />
                    </div>
                  </div>
                )}
              </label>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => { if (!canAdd) return; onAdd(); }}
        disabled={!canAdd}
        className={`mt-6 flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Plus style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <span>Add another</span>
      </button>
      {/* Inactive checkout items below the add button */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...items.keys()].filter(i => !items[i].checked).map((idx) => {
          const item = items[idx];
          const isEditing = editing.has(idx);
          return (
            <div key={idx} className={`p-4 rounded-lg bg-white/80 shadow flex flex-col gap-3 relative opacity-60 grayscale`}>
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {!isEditing ? (
                  <button
                    type="button"
                    aria-label="Edit info"
                    className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                    onClick={() => startEdit(idx)}
                  >
                    <Pencil style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="Save info"
                      className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                      onClick={() => finishEdit(idx)}
                    >
                      <Check style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel edit"
                      className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                      onClick={() => cancelEdit(idx)}
                    >
                      <X style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                    </button>
                  </>
                )}
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={e => onChange(idx, 'checked', e.target.checked)}
                  className="mt-1 accent-[oklch(0.6923_0.22_21.05)]"
                />
                {!isEditing ? (
                  <span>
                    <span className="font-medium">{item.name || 'Untitled'}</span>
                    <br />
                    <span className="text-sm text-gray-600">{item.description || 'No description'}</span>
                  </span>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    <div>
                      <Label>Title</Label>
                      <Input maxLength={LIMITS.checkoutName} value={item.name} onChange={e => onChange(idx, 'name', e.target.value)} placeholder="e.g. Trash & linens" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea maxLength={LIMITS.checkoutDescription} value={item.description} onChange={e => onChange(idx, 'description', e.target.value)} placeholder="What guests should know before checkout..." />
                    </div>
                  </div>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
