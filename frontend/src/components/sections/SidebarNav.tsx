import React from "react";
import { LIMITS } from "../../constants/limits";

const NAV_META: Record<string, { label: string; icon: string }> = {
  welcome: { label: "Welcome", icon: "👋" },
  checkin: { label: "Check-in Info", icon: "🏠" },
  wifi: { label: "Wi-Fi", icon: "📶" },
  hostinfo: { label: "Host Info", icon: "👤" },
  property: { label: "House Manual", icon: "📘" },
  food: { label: "Food", icon: "🍽️" },
  activities: { label: "Activities", icon: "🎡" },
  rules: { label: "House Rules", icon: "📋" },
  checkout: { label: "Checkout Info", icon: "🧳" },
};

interface SidebarNavProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  included: string[];
  excluded: string[];
  onUpdate: (included: string[], excluded: string[]) => void;
  onCustomMetaChange?: (meta: Record<string, { icon: string; label: string }>) => void;
  /** Sections that are allowed to be clicked (enabled). Others render greyed-out and are not clickable. */
  allowedSections?: string[];
  /** Whether the Add custom button is enabled. Defaults to true. */
  customEnabled?: boolean;
  /** Custom section metadata from parent */
  customTabsMeta?: Record<string, { icon: string; label: string }>;
}

export default function SidebarNav({ currentSection, onSectionChange, included, excluded, onUpdate, onCustomMetaChange, allowedSections, customEnabled = true, customTabsMeta }: SidebarNavProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = React.useState<{
    list: "included" | "excluded" | null;
    index: number; // insertion index (0..length)
  }>({ list: null, index: -1 });
  const [showCustomModal, setShowCustomModal] = React.useState(false);
  const [customEmoji, setCustomEmoji] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");
  const [customMeta, setCustomMeta] = React.useState<Record<string, { icon: string; label: string }>>({});
  const EMOJI_OPTIONS = React.useMemo(
    () => [
      "📝","✨","⭐","📍","📷","🗺️","🏖️","⛰️","🌇","🌃",
      "🍽️","🍕","🍔","🍣","☕","🍺","🍷","🍹","🧁","🍩",
      "🎡","🎟️","🎵","🏃","🚴","🏊","🛶","🎨","🏛️","🛍️",
      "🚗","🚕","🚆","✈️","⛵","🧭","🪪","💡","🔧","🧼"
    ],
    []
  );
  const customCount = React.useMemo(() => (
    [...included, ...excluded].filter(k => k.startsWith("custom_")).length
  ), [included, excluded]);
  const canAddCustom = customCount < LIMITS.maxCustomTabs && customEnabled;

  // Sync local customMeta with prop from parent
  React.useEffect(() => {
    if (customTabsMeta) {
      setCustomMeta(customTabsMeta);
    }
  }, [customTabsMeta]);

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

  const handleToggleSection = (e: React.MouseEvent, section: string, from: "included" | "excluded") => {
    e.stopPropagation();
    const newIncluded = included.slice();
    const newExcluded = excluded.slice();

    if (from === "included") {
      // Move to excluded
      const idx = newIncluded.indexOf(section);
      if (idx >= 0) newIncluded.splice(idx, 1);
      newExcluded.push(section);
    } else {
      // Move to included
      const idx = newExcluded.indexOf(section);
      if (idx >= 0) newExcluded.splice(idx, 1);
      newIncluded.push(section);
    }

    onUpdate(newIncluded, newExcluded);
  };

  const renderItem = (section: string, index: number, listName: "included" | "excluded") => {
    const meta: { icon: string; label: string } = NAV_META[section] ?? customMeta[section] ?? { icon: "📝", label: section };
    const isEnabled = listName === "included" ? (!allowedSections || allowedSections.includes(section)) : true;
    const isWelcome = section === "welcome";
    const isDraggable = !isWelcome;
    return (
      <li
        key={section}
        data-index={index}
        draggable={isDraggable}
        onDragStart={(e) => {
          if (!isDraggable) {
            e.preventDefault();
            return;
          }
          handleDragStart(e, section, listName);
        }}
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
        className={`flex items-center gap-0 md:gap-2 px-2 md:px-3 py-2 rounded-lg transition-colors ${
          currentSection === section ? "bg-white/20" : "hover:bg-white/10"
        } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : isDraggable ? 'cursor-move' : 'cursor-pointer'}`}
        onClick={() => {
          if (!isEnabled) return;
          onSectionChange(section);
        }}
        title={isWelcome ? "Welcome section (required)" : "Drag to reorder or move between lists"}
      >
        <span className="w-6 h-6 flex items-center justify-center text-lg" aria-hidden="true">{meta.icon}</span>
        <span className="font-medium text-sm md:text-base hidden sm:inline flex-1">{meta.label}</span>
        {!isWelcome && (
          <button
            type="button"
            onClick={(e) => handleToggleSection(e, section, listName)}
            className="w-6 h-6 flex items-center justify-center text-white hover:bg-white/20 rounded transition-colors hidden sm:flex"
            title={listName === "included" ? "Exclude section" : "Include section"}
            aria-label={listName === "included" ? "Exclude section" : "Include section"}
          >
            {listName === "included" ? "−" : "+"}
          </button>
        )}
      </li>
    );
  };

  return (
    <nav
      ref={containerRef}
      className="h-full w-10 sm:w-20 md:w-56 text-white flex flex-col py-6 md:py-8 px-1 sm:px-3 md:px-4"
      onDragOver={onContainerDragOver}
    >
      <div className="mb-4 text-xl md:text-2xl font-bold tracking-tight hidden sm:block">Guidebook</div>

      {/* Included list */}
      <ul
        data-tutorial="sidebar-included"
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
        className={`mb-2 inline-flex items-center justify-center sm:justify-start gap-0 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition ${!canAddCustom ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => { if (!canAddCustom) return; setShowCustomModal(true); }}
        aria-label="Add custom tab"
        disabled={!canAddCustom}
      >
        <span className="text-base" aria-hidden="true">➕</span>
        <span className="hidden sm:inline">Add custom</span>
      </button>

      {/* Divider for Excluded */}
      <div
        data-tutorial="excluded"
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
        data-tutorial="sidebar-excluded"
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
                <div className="grid grid-cols-10 gap-1 mb-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`h-9 w-9 flex items-center justify-center rounded border text-lg hover:bg-gray-50 ${customEmoji === e ? 'ring-2 ring-[oklch(0.6923_0.22_21.05)]' : ''}`}
                      onClick={() => setCustomEmoji(e)}
                      aria-label={`Choose ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="Or type/paste an emoji (1 char)"
                  className="w-full border rounded px-3 py-2"
                  value={customEmoji}
                  maxLength={LIMITS.customTabEmojiChars}
                  onChange={(e) => setCustomEmoji(e.target.value.slice(0, LIMITS.customTabEmojiChars))}
                />
                <p className="mt-1 text-xs text-gray-500">Pick from above or type a single emoji.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Custom section title"
                  className="w-full border rounded px-3 py-2"
                  value={customTitle}
                  maxLength={LIMITS.customTabTitle}
                  onChange={(e) => setCustomTitle(e.target.value.slice(0, LIMITS.customTabTitle))}
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
                className={`px-3 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white hover:opacity-90 ${!canAddCustom ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  const title = customTitle.trim().slice(0, LIMITS.customTabTitle);
                  const emoji = ((customEmoji || "").trim().slice(0, LIMITS.customTabEmojiChars)) || "📝";
                  if (!title || !canAddCustom) return;
                  const key = `custom_${Date.now()}`;
                  const newMeta = { ...customMeta, [key]: { icon: emoji, label: title } };
                  setCustomMeta(newMeta);
                  // Notify parent of the new custom section
                  if (onCustomMetaChange) {
                    onCustomMetaChange(newMeta);
                  }
                  onUpdate([...included, key], excluded);
                  onSectionChange(key);
                  setShowCustomModal(false);
                  setCustomEmoji("");
                  setCustomTitle("");
                }}
                disabled={!canAddCustom}
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
