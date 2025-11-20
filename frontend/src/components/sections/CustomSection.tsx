import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Image, Video } from "lucide-react";
import { LIMITS } from "@/constants/limits";
import Spinner from "@/components/ui/spinner";

export type CustomItemText = { type: 'text', content: string };
export type CustomItemManual = { type: 'manual', name: string, description: string, mediaUrl?: string, mediaType?: "image" | "video" };
export type CustomItem = CustomItemText | CustomItemManual;

interface CustomSectionProps {
  sectionKey: string;
  icon: string;
  label: string;
  items: CustomItem[];
  onChange: (items: CustomItem[]) => void;
  onLabelChange: (newLabel: string) => void;
  onMediaSelect?: (idx: number, file: File | null) => void;
  onRemoveMedia?: (idx: number) => void;
}

export default function CustomSection({ sectionKey, icon, label, items, onChange, onLabelChange, onMediaSelect, onRemoveMedia }: CustomSectionProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const handleAddTextField = () => {
    onChange([...items, { type: 'text', content: '' }]);
  };

  const handleAddManualItem = () => {
    onChange([...items, { type: 'manual', name: '', description: '' }]);
  };

  const handleUpdateTextItem = (index: number, content: string) => {
    const updated = [...items];
    updated[index] = { type: 'text', content };
    onChange(updated);
  };

  const handleUpdateManualItem = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...items];
    const item = updated[index];
    if (item.type === 'manual') {
      updated[index] = { ...item, [field]: value };
      onChange(updated);
    }
  };

  const handleDeleteItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMediaUpload = async (idx: number) => {
    if (!onMediaSelect) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.onchange = async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;
      try {
        setUploadingIdx(idx);
        await onMediaSelect(idx, file);
      } finally {
        setUploadingIdx(null);
      }
    };
    input.click();
  };

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <Input
          value={label}
          onChange={(e) => onLabelChange(e.target.value.slice(0, LIMITS.customTabTitle))}
          placeholder="Section name"
          maxLength={LIMITS.customTabTitle}
          className="text-xl font-semibold max-w-xs"
        />
      </div>

      {/* Items */}
      <div className="space-y-4 mb-4">
        {items.map((item, idx) => (
          <div key={idx} className="relative">
            {item.type === 'text' ? (
              <div className="pr-10">
                <Label htmlFor={`${sectionKey}-item-${idx}`}>
                  Text Field {idx + 1}
                </Label>
                <Textarea
                  id={`${sectionKey}-item-${idx}`}
                  value={item.content}
                  onChange={(e) => handleUpdateTextItem(idx, e.target.value)}
                  placeholder="Enter text content..."
                  className="mt-1"
                  rows={4}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteItem(idx)}
                  className="absolute top-8 right-0 p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                  aria-label="Delete item"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-white/80 shadow flex flex-col gap-2 relative">
                <button
                  type="button"
                  onClick={() => handleDeleteItem(idx)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                  aria-label="Delete item"
                >
                  <Trash2 style={{ color: "oklch(0.6923 0.22 21.05)" }} size={20} />
                </button>
                <Label>Name</Label>
                <Input
                  value={item.name}
                  onChange={(e) => handleUpdateManualItem(idx, 'name', e.target.value)}
                  placeholder="e.g. Appliance instructions"
                />
                <Label>Description</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => handleUpdateManualItem(idx, 'description', e.target.value)}
                  placeholder="Details, instructions, etc."
                />
                <div className="mt-2 flex items-center justify-between">
                  {item.mediaUrl ? (
                    <button
                      type="button"
                      className="text-sm text-red-600 underline-offset-2 hover:underline"
                      onClick={() => onRemoveMedia?.(idx)}
                    >
                      {item.mediaType === "video" ? "Remove video" : "Remove image"}
                    </button>
                  ) : (
                    uploadingIdx === idx ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Spinner size={16} colorClass="text-[oklch(0.6923_0.22_21.05)]" />
                        <span>Uploading…</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-sm text-[oklch(0.6923_0.22_21.05)] underline-offset-2 hover:underline"
                        onClick={() => handleMediaUpload(idx)}
                      >
                        + Add photo or video
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          onClick={handleAddTextField}
          variant="outline"
          className="flex items-center gap-2"
          disabled={items.length >= LIMITS.maxCustomSectionItems}
        >
          <Plus size={18} />
          Add text field
        </Button>
        <Button
          type="button"
          onClick={handleAddManualItem}
          variant="outline"
          className="flex items-center gap-2"
          disabled={items.length >= LIMITS.maxCustomSectionItems}
        >
          <Plus size={18} />
          Add manual item
        </Button>
      </div>

      {items.length >= LIMITS.maxCustomSectionItems ? (
        <p className="text-sm text-amber-600 mt-4">
          Maximum of {LIMITS.maxCustomSectionItems} items reached for this section.
        </p>
      ) : (
        <p className="text-sm text-gray-500 mt-4">
          Add text fields or manual items (with photo/video) to organize your content.
        </p>
      )}
    </section>
  );
}
