import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash } from "lucide-react";

export type HouseManualItem = { name: string; description: string };

interface HouseManualListProps {
  items: HouseManualItem[];
  onChange: (idx: number, field: keyof HouseManualItem, value: string) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
}

export default function HouseManualList({ items, onChange, onAdd, onDelete }: HouseManualListProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">House Manual</h2>
      </div>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
        >
          <Plus style={{ color: "oklch(0.6923 0.22 21.05)" }} />
          <span>Add section</span>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-white/80 shadow flex flex-col gap-2 relative">
                <button
                  type="button"
                  aria-label="Delete section"
                  className="absolute top-2 right-2 p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                  onClick={() => onDelete(idx)}
                >
                  <Trash style={{ color: "oklch(0.6923 0.22 21.05)" }} size={20} />
                </button>
                <Label>Name</Label>
                <Input
                  value={item.name}
                  onChange={(e) => onChange(idx, "name", e.target.value)}
                  placeholder="e.g. Trash location"
                />
                <Label>Description</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => onChange(idx, "description", e.target.value)}
                  placeholder="Details, codes, where to find it, etc."
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition mt-6"
          >
            <Plus style={{ color: "oklch(0.6923 0.22 21.05)" }} />
            <span>Add another</span>
          </button>
        </>
      )}
    </section>
  );
}
