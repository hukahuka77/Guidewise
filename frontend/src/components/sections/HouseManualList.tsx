import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash } from "lucide-react";
import Spinner from "@/components/ui/spinner";
import ConfirmModal from "@/components/ui/ConfirmModal";

export type HouseManualItem = { name: string; description: string; mediaUrl?: string; mediaType?: "image" | "video" };

interface HouseManualListProps {
  items: HouseManualItem[];
  onChange: (idx: number, field: keyof HouseManualItem, value: string) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onMediaSelect?: (idx: number, file: File | null) => void;
  onRemoveMedia?: (idx: number) => void;
}

export default function HouseManualList({ items, onChange, onAdd, onDelete, onMediaSelect, onRemoveMedia }: HouseManualListProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
                  onClick={() => {
                    setPendingDeleteIdx(idx);
                    setShowDeleteConfirm(true);
                  }}
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
                <div className="mt-2 flex items-center justify-between">
                  {item.mediaUrl ? (
                    <button
                      type="button"
                      className="text-sm text-red-600 underline-offset-2 hover:underline"
                      onClick={() => {
                        if (!onRemoveMedia) return;
                        onRemoveMedia(idx);
                      }}
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
                        onClick={() => {
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
                        }}
                      >
                        Add picture or video
                      </button>
                    )
                  )}
                  {item.mediaUrl && (
                    <span className="text-xs text-gray-500 truncate max-w-[50%]">
                      {item.mediaType === "video" ? "Video attached" : "Image attached"}
                    </span>
                  )}
                </div>
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
      <ConfirmModal
        open={showDeleteConfirm}
        title="Remove section?"
        description={"This will permanently remove this House Manual section from your guidebook."}
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
    </section>
  );
}
