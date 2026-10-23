import React from "react";
import { BookOpen, Compass, Eye, EyeOff, GripVertical, Home, KeyRound, ListChecks, Luggage, Plus, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { LIMITS } from "../../constants/limits";
import { cn } from "@/lib/utils";
import { EDIT_SECTIONS_ORDER } from "@/config/sections";

/** Editor labels, icons and helper text for the built-in sections. */
export const SECTION_META: Record<string, { label: string; icon: LucideIcon; description: string }> = {
  welcome: { label: "Welcome", icon: Home, description: "Your place, a warm hello and who is hosting. This always opens the guidebook." },
  checkin: { label: "Check-in", icon: KeyRound, description: "Everything guests need to arrive smoothly: timing, getting in, Wi-Fi and safety." },
  property: { label: "House manual", icon: BookOpen, description: "How things work around the house. Photos and short videos help." },
  food: { label: "Food & drink", icon: UtensilsCrossed, description: "Your favorite places to eat and drink nearby." },
  activities: { label: "Things to do", icon: Compass, description: "Sights, walks and experiences worth the trip." },
  rules: { label: "House rules", icon: ListChecks, description: "What you ask of guests, kept short and friendly." },
  checkout: { label: "Check-out", icon: Luggage, description: "When to leave and what to do before going. Guests can tick steps off." },
};

/**
 * Put a section that is being shown again back where it normally goes, instead of at the end:
 * a built-in section goes right after the visible section that precedes it in the default order.
 */
export function insertInOrder(included: string[], section: string): string[] {
  const rest = included.filter((k) => k !== section);
  const rank = (k: string) => {
    const i = EDIT_SECTIONS_ORDER.indexOf(k as (typeof EDIT_SECTIONS_ORDER)[number]);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  const target = rank(section);
  if (!Number.isFinite(target)) return [...rest, section];
  let after = -1;
  rest.forEach((k, i) => { if (rank(k) < target) after = i; });
  return [...rest.slice(0, after + 1), section, ...rest.slice(after + 1)];
}

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
      className={`${dragOver.list === listName && dragOver.index === atIndex ? "h-[2px] bg-primary my-0.5" : "h-0"} mx-2 rounded`}
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
      // Move back to included, at its usual place
      const idx = newExcluded.indexOf(section);
      if (idx >= 0) newExcluded.splice(idx, 1);
      onUpdate(insertInOrder(newIncluded, section), newExcluded);
      return;
    }

    onUpdate(newIncluded, newExcluded);
  };

  const metaFor = (section: string) => {
    const builtIn = SECTION_META[section];
    if (builtIn) return { label: builtIn.label, Icon: builtIn.icon as LucideIcon | null, emoji: null as string | null };
    const custom = customMeta[section];
    return { label: custom?.label || "Custom section", Icon: null as LucideIcon | null, emoji: custom?.icon || "📝" };
  };

  const renderItem = (section: string, index: number, listName: "included" | "excluded") => {
    const { label, Icon, emoji } = metaFor(section);
    const isEnabled = listName === "included" ? (!allowedSections || allowedSections.includes(section)) : true;
    const isWelcome = section === "welcome";
    const isDraggable = !isWelcome;
    const active = currentSection === section;
    const hidden = listName === "excluded";
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
        className={cn(
          "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
          active ? "bg-primary/10 font-semibold text-gray-900" : "text-gray-700 hover:bg-[#F5EFE7]",
          hidden && !active && "text-gray-400",
          !isEnabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
        onClick={() => {
          if (!isEnabled) return;
          onSectionChange(section);
        }}
        title={isWelcome ? "Welcome always opens your guidebook" : "Drag to reorder"}
      >
        {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary" aria-hidden="true" />}
        <span className={cn("w-3 shrink-0 text-gray-300 transition", isDraggable ? "cursor-grab opacity-0 group-hover:opacity-100" : "opacity-0")} aria-hidden="true">
          <GripVertical className="size-3.5" />
        </span>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", active ? "bg-white text-primary shadow-sm" : "bg-[#F5EFE7] text-gray-600", hidden && "opacity-60")} aria-hidden="true">
          {Icon ? <Icon className="size-4" /> : <span className="text-sm leading-none">{emoji}</span>}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {!isWelcome && (
          <button
            type="button"
            onClick={(e) => handleToggleSection(e, section, listName)}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-white hover:text-gray-900",
              hidden ? "text-gray-400" : "text-gray-400 opacity-0 focus:opacity-100 group-hover:opacity-100",
            )}
            title={hidden ? "Show in guidebook" : "Hide from guidebook"}
            aria-label={hidden ? `Show ${label} in guidebook` : `Hide ${label} from guidebook`}
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </li>
    );
  };

  return (
    <nav
      ref={containerRef}
      aria-label="Guidebook sections"
      className="flex flex-col"
      onDragOver={onContainerDragOver}
    >
      {/* Phones and small tablets: a scrollable strip of the visible sections */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
        {included.map((section) => {
          const { label, Icon, emoji } = metaFor(section);
          const active = currentSection === section;
          return (
            <button
              key={`chip-${section}`}
              type="button"
              onClick={() => onSectionChange(section)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                active ? "border-primary bg-primary/10 font-semibold text-gray-900" : "border-[#E7DFD4] bg-white text-gray-700",
              )}
            >
              {Icon ? <Icon className="size-4 text-primary" /> : <span aria-hidden="true">{emoji}</span>}
              {label}
            </button>
          );
        })}
        {excluded.length > 0 && excluded.map((section) => {
          const { label } = metaFor(section);
          return (
            <button key={`chip-x-${section}`} type="button" onClick={() => onSectionChange(section)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-gray-400", currentSection === section && "border-primary text-gray-700")}>
              <EyeOff className="size-3.5" />
              {label}
            </button>
          );
        })}
        {canAddCustom && (
          <button type="button" onClick={() => setShowCustomModal(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-primary/60 px-3 py-1.5 text-sm font-medium text-primary">
            <Plus className="size-3.5" /> Section
          </button>
        )}
      </div>

      <div className="hidden md:block">
        <p className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Sections</p>

        {/* Included list */}
        <ul
          data-tutorial="sidebar-included"
          className="flex min-h-4 flex-col gap-0.5"
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

        <button
          type="button"
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
          onClick={() => { if (!canAddCustom) return; setShowCustomModal(true); }}
          aria-label="Add custom section"
          disabled={!canAddCustom}
          title={canAddCustom ? undefined : `Up to ${LIMITS.maxCustomTabs} custom sections`}
        >
          <span className="w-3" aria-hidden="true" />
          <span className="flex size-7 items-center justify-center rounded-lg border border-dashed border-current" aria-hidden="true"><Plus className="size-4" /></span>
          Add a section
        </button>

        {/* Hidden sections */}
        <div
          data-tutorial="excluded"
          className="mt-5 border-t border-[#ECE5DB] px-2.5 pt-4 text-xs font-semibold uppercase tracking-wider text-gray-400"
          onDragOver={(e) => {
            onDragOver(e);
            setDragOver({ list: "excluded", index: 0 });
          }}
          onDrop={(e) => handleDropOnList(e, "excluded", 0)}
        >
          Hidden from guests
        </div>

        <ul
          data-tutorial="sidebar-excluded"
          className="mt-2 flex min-h-10 flex-col gap-0.5"
          onDragOver={(e) => onDragOver(e)}
          onDragLeave={(e) => onDragLeaveList(e, "excluded")}
          onDrop={(e) => {
            const idx = dragOver.list === "excluded" && dragOver.index >= 0 ? dragOver.index : excluded.length;
            handleDropOnList(e, "excluded", idx);
          }}
        >
          {renderDropZone("excluded", 0)}
          {excluded.length === 0 && <li className="px-2.5 py-1 text-xs text-gray-400">Drag a section here to hide it.</li>}
          {excluded.map((s, idx) => (
            <React.Fragment key={`wrap-exc-${s}`}>
              {renderItem(s, idx, "excluded")}
              {renderDropZone("excluded", idx + 1)}
            </React.Fragment>
          ))}
        </ul>
      </div>

      {/* Custom Tab Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCustomModal(false)} />
          <div className="relative z-10 w-[92vw] max-w-sm rounded-2xl bg-white text-gray-900 p-6 shadow-xl">
            <div className="text-lg font-semibold mb-1">Add a section</div>
            <p className="mb-4 text-sm text-gray-500">For anything that doesn&apos;t fit elsewhere: a pool guide, a kids corner, local transport.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Emoji</label>
                <div className="grid grid-cols-10 gap-1 mb-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`h-9 w-9 flex items-center justify-center rounded border text-lg hover:bg-gray-50 ${customEmoji === e ? 'ring-2 ring-primary' : ''}`}
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
                  className="w-full rounded-lg border border-[#E7DFD4] px-3 py-2 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
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
                  placeholder="e.g. Pool & hot tub"
                  className="w-full rounded-lg border border-[#E7DFD4] px-3 py-2 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                  value={customTitle}
                  maxLength={LIMITS.customTabTitle}
                  onChange={(e) => setCustomTitle(e.target.value.slice(0, LIMITS.customTabTitle))}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowCustomModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg bg-gradient-to-r from-[#db2777] to-[#f97316] font-medium text-white hover:opacity-90 ${!canAddCustom ? 'opacity-50 cursor-not-allowed' : ''}`}
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
