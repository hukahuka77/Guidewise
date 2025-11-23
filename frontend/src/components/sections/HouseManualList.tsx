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

const HOUSE_MANUAL_SUGGESTIONS: Pick<HouseManualItem, "name" | "description">[] = [
  {
    name: "Trash Location",
    description: "Where guests can find the trash and recycling bins, and when pickup day is.",
  },
  {
    name: "Thermostat / HVAC",
    description: "How to use the thermostat or AC/heat, including any limits or eco settings.",
  },
  {
    name: "Washer / Dryer",
    description: "Instructions for using the washer and dryer, including detergent and cycle tips.",
  },
  {
    name: "Parking Instructions",
    description: "Where to park, how many cars are allowed, and any street parking rules.",
  },
  {
    name: "Hot Tub / Pool",
    description: "How to operate the hot tub or pool safely, including covers and temperature limits.",
  },
];

export default function HouseManualList({ items, onChange, onAdd, onDelete, onMediaSelect, onRemoveMedia }: HouseManualListProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const canAdd = true; // House manual uses a simple add button; max enforced elsewhere if needed

  const isSuggestionActive = (suggestionName: string) => {
    return items.some(item => item.name.toLowerCase() === suggestionName.toLowerCase());
  };

  const handleAddSuggestion = (suggestion: Pick<HouseManualItem, "name" | "description">) => {
    const existingIndex = items.findIndex(item => item.name.toLowerCase() === suggestion.name.toLowerCase());
    if (existingIndex >= 0) {
      onDelete(existingIndex);
    } else {
      if (!canAdd) return;
      const newIdx = items.length;
      onAdd();
      onChange(newIdx, "name", suggestion.name);
      onChange(newIdx, "description", suggestion.description);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">House Manual</h2>
      </div>

      {/* Quick-add suggestions for common house manual sections */}
      {HOUSE_MANUAL_SUGGESTIONS.length > 0 && (
        <div className="mb-6 flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 mb-2">
            {HOUSE_MANUAL_SUGGESTIONS.map((suggestion) => {
              const isActive = isSuggestionActive(suggestion.name);
              return (
                <button
                  key={suggestion.name}
                  type="button"
                  onClick={() => handleAddSuggestion(suggestion)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    isActive
                      ? "bg-[oklch(0.6923_0.22_21.05)] text-white border-[oklch(0.6923_0.22_21.05)] hover:opacity-90"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[oklch(0.6923_0.22_21.05)]"
                  }`}
                >
                  {isActive ? "✓ " : "+ "}{suggestion.name}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-gray-400 italic">Quick add common house manual sections</p>
        </div>
      )}

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

                {/* Media thumbnail preview */}
                {item.mediaUrl && (
                  <div className="mt-3">
                    {item.mediaType === "video" ? (
                      // Video thumbnail/preview
                      <video
                        src={item.mediaUrl}
                        className="w-full max-h-48 rounded-md border object-cover"
                        controls
                      />
                    ) : (
                      // Image thumbnail
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.mediaUrl}
                        alt={item.name || "House manual media"}
                        className="w-full max-h-48 rounded-md border object-cover"
                      />
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
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
