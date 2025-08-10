import React from "react";

const NAV_META: Record<string, { label: string; icon: string }> = {
  checkin: { label: "Check-in Info", icon: "🏠" },
  property: { label: "Property Details", icon: "🏡" },
  hostinfo: { label: "Host Info", icon: "👤" },
  wifi: { label: "Wifi", icon: "📶" },
  food: { label: "Food", icon: "🍽️" },
  activities: { label: "Activities", icon: "🎡" },
  rules: { label: "Rules", icon: "📋" },
  checkout: { label: "Checkout Info", icon: "🧳" },
};

interface SidebarNavProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  included: string[];
  excluded: string[];
  onUpdate: (included: string[], excluded: string[]) => void;
  onCustomMetaChange?: (meta: Record<string, { icon: string; label: string }>) => void;
}

export default function SidebarNav({ currentSection, onSectionChange, included, excluded, onUpdate, onCustomMetaChange }: SidebarNavProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = React.useState<{
    list: "included" | "excluded" | null;
    index: number; // insertion index (0..length)
  }>({ list: null, index: -1 });
  const [showCustomModal, setShowCustomModal] = React.useState(false);
  const [customEmoji, setCustomEmoji] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");
  const [customMeta, setCustomMeta] = React.useState<Record<string, { icon: string; label: string }>>({});

  // Whenever customMeta changes, notify parent if provided
  React.useEffect(() => {
    if (onCustomMetaChange) onCustomMetaChange(customMeta);
  }, [customMeta, onCustomMetaChange]);

  const handleDragStart = (e: React.DragEvent, section: string, from: "included" | "excluded") => {
    const originalIndex = (from === "included" ? included : excluded).indexOf(section);
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ section, from, originalIndex })
    );
    // Also set text/plain for broader browser compatibility (e.g., Safari)
    e.dataTransfer.setData("text/plain", section);
    e.dataTransfer.effectAllowed = "move";
  };

  // Note: reordering handled inline during drag operations; no standalone helper needed

  const handleDropOnList = (
    e: React.DragEvent,
    targetList: "included" | "excluded",
    targetIndex?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const { section, from, originalIndex } = JSON.parse(data) as { section: string; from: "included" | "excluded"; originalIndex: number };

    let newIncluded = included.slice();
    let newExcluded = excluded.slice();

    // Remove from source
    if (from === "included") newIncluded = newIncluded.filter((s) => s !== section);
    else newExcluded = newExcluded.filter((s) => s !== section);

    // Insert into target
    const insert = (arr: string[], idxOverride?: number) => {
      const idx = typeof idxOverride === "number"
        ? Math.max(0, Math.min(idxOverride, arr.length))
        : (typeof targetIndex === "number" ? Math.max(0, Math.min(targetIndex, arr.length)) : arr.length);
      const copy = arr.slice();
      copy.splice(idx, 0, section);
      return copy;
    };

    let desiredIndex = dragOver.list === targetList && dragOver.index >= 0 ? dragOver.index : targetIndex;
    if (typeof desiredIndex !== "number") desiredIndex = (targetList === "included" ? newIncluded.length : newExcluded.length);

    // If moving within the same list and the removal index is before the desired index, shift left by one
    if (from === targetList) {
      const removedIndex = originalIndex;
      if (removedIndex < desiredIndex) desiredIndex = Math.max(0, desiredIndex - 1);
      // Ignore true no-op only (same final position)
      if (desiredIndex === removedIndex) {
        setDragOver({ list: null, index: -1 });
        return;
      }
    }

    if (targetList === "included") newIncluded = insert(newIncluded, desiredIndex);
    else newExcluded = insert(newExcluded, desiredIndex);

    onUpdate(newIncluded, newExcluded);
    setDragOver({ list: null, index: -1 });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onContainerDragOver = (e: React.DragEvent) => {
    onDragOver(e);
    // Auto-scroll window to help reach Excluded zone
    const edge = 48;
    const y = e.clientY;
    const h = window.innerHeight;
    if (y > h - edge) {
      window.scrollBy({ top: 24, behavior: "auto" });
    } else if (y < edge) {
      window.scrollBy({ top: -24, behavior: "auto" });
    }
  };

  const onDragLeaveList = (e: React.DragEvent, listName: "included" | "excluded") => {
    // When leaving the list entirely, clear indicator
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOver((prev) => (prev.list === listName ? { list: null, index: -1 } : prev));
    }
  };

  const renderDropZone = (listName: "included" | "excluded", atIndex: number) => (
    <li
      key={`dz-${listName}-${atIndex}`}
      role="separator"
      className={`${dragOver.list === listName && dragOver.index === atIndex ? "h-[2px] bg-white/80 my-0.5" : "h-0"} mx-2 rounded`}
      onDragOver={(e) => {
        onDragOver(e);
        setDragOver({ list: listName, index: atIndex });
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver({ list: listName, index: atIndex });
      }}
      onDrop={(e) => handleDropOnList(e, listName, atIndex)}
    />
  );

  const renderItem = (section: string, index: number, listName: "included" | "excluded") => {
    const meta: { icon: string; label: string } = NAV_META[section] ?? customMeta[section] ?? { icon: "📝", label: section };
    return (
      <li
        key={section}
        data-index={index}
        draggable
        onDragStart={(e) => handleDragStart(e, section, listName)}
        onDragEnd={() => setDragOver({ list: null, index: -1 })}
        onDragOver={(e) => {
          // Compute before/after relative to the item so dropping on the item is allowed
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const before = (e.clientY - rect.top) < rect.height / 2;
          setDragOver({ list: listName, index: before ? index : index + 1 });
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const insertion = dragOver.list === listName ? dragOver.index : index;
          handleDropOnList(e, listName, insertion);
        }}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-move ${
          currentSection === section && listName === "included" ? "bg-white/20" : "hover:bg-white/10"
        }`}
        onClick={() => listName === "included" && onSectionChange(section)}
        title="Drag to reorder or move between lists"
      >
        <span className="w-6 h-6">{meta.icon}</span>
        <span className="font-medium">{meta.label}</span>
      </li>
    );
  };

  return (
    <nav ref={containerRef} className="h-full w-56 bg-[oklch(0.6923_0.22_21.05)] text-white flex flex-col py-8 px-4 shadow-lg" onDragOver={onContainerDragOver}>
      <div className="mb-4 text-2xl font-bold tracking-tight">Guidebook</div>

      {/* Included list */}
      <ul
        className="flex flex-col gap-2 mb-4 min-h-4"
        onDragOver={(e) => onDragOver(e)}
        onDragLeave={(e) => onDragLeaveList(e, "included")}
        onDrop={(e) => {
          // Fallback: drop on whitespace of Included appends at current indicator or end
          const idx = dragOver.list === "included" && dragOver.index >= 0 ? dragOver.index : included.length;
          handleDropOnList(e, "included", idx);
        }}
      >
        {renderDropZone("included", 0)}
        {included.map((s, idx) => (
          <React.Fragment key={`wrap-inc-${s}`}>
            {renderItem(s, idx, "included")}
            {renderDropZone("included", idx + 1)}
          </React.Fragment>
        ))}
      </ul>

      {/* Add custom button (below Included, above Excluded) */}
      <button
        type="button"
        className="mb-2 inline-flex items-center gap-2 text-sm px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition"
        onClick={() => setShowCustomModal(true)}
        aria-label="Add custom tab"
      >
        <span>➕</span>
        <span>Add custom</span>
      </button>

      {/* Divider for Excluded */}
      <div
        className="mt-2 mb-2 text-xs uppercase tracking-wider text-white/60"
        onDragOver={(e) => {
          onDragOver(e);
          setDragOver({ list: "excluded", index: 0 });
        }}
        onDrop={(e) => handleDropOnList(e, "excluded", 0)}
      >
        Excluded
      </div>

      {/* Excluded list */}
      <ul
        className="flex flex-col gap-2 min-h-4"
        onDragOver={(e) => onDragOver(e)}
        onDragLeave={(e) => onDragLeaveList(e, "excluded")}
        onDrop={(e) => {
          const idx = dragOver.list === "excluded" && dragOver.index >= 0 ? dragOver.index : excluded.length;
          handleDropOnList(e, "excluded", idx);
        }}
      >
        {renderDropZone("excluded", 0)}
        {excluded.map((s, idx) => (
          <React.Fragment key={`wrap-exc-${s}`}>
            {renderItem(s, idx, "excluded")}
            {renderDropZone("excluded", idx + 1)}
          </React.Fragment>
        ))}
      </ul>

      {/* Custom Tab Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCustomModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-lg bg-white text-gray-900 p-5 shadow-xl">
            <div className="text-lg font-semibold mb-3">Add custom tab</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Emoji</label>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="e.g. ✨"
                  className="w-full border rounded px-3 py-2"
                  value={customEmoji}
                  onChange={(e) => setCustomEmoji(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Custom section title"
                  className="w-full border rounded px-3 py-2"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowCustomModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white hover:opacity-90"
                onClick={() => {
                  const title = customTitle.trim();
                  const emoji = (customEmoji || "").trim() || "📝";
                  if (!title) return;
                  const key = `custom_${Date.now()}`;
                  setCustomMeta((prev) => ({ ...prev, [key]: { icon: emoji, label: title } }));
                  onUpdate([...included, key], excluded);
                  onSectionChange(key);
                  setShowCustomModal(false);
                  setCustomEmoji("");
                  setCustomTitle("");
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
