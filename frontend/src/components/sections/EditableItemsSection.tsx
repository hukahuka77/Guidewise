import React, { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { AddRowButton, Card, CardHeader, IconButton, SuggestionChips, inputClass, compactTextareaClass } from "@/components/editor/primitives";

export interface EditableItem {
  name: string;
  description: string;
  checked: boolean;
}

interface Suggestion {
  name: string;
  description: string;
}

interface EditableItemsSectionProps {
  title: string;
  /** Short helper line under the card title. */
  description?: string;
  items: EditableItem[];
  suggestions?: Suggestion[];
  onChange: (index: number, field: keyof EditableItem, value: string | boolean) => void;
  onAdd: () => void;
  onAddWithValues?: (item: Omit<EditableItem, "checked">) => void;
  onDelete?: (index: number) => void;
  maxItems: number;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  nameLabel?: string;
  descriptionLabel?: string;
  nameMaxLength?: number;
  descriptionMaxLength?: number;
  /** Kept for compatibility; items are always edited inline now. */
  showCheckboxes?: boolean;
  autoEditIndex?: number | null;
  onAutoEditHandled?: () => void;
  headerContent?: React.ReactNode;
  addLabel?: string;
}

/** A list of name + description rows (house rules, checkout steps), edited inline. */
export default function EditableItemsSection({
  title,
  description,
  items,
  suggestions = [],
  onChange,
  onAdd,
  onAddWithValues,
  onDelete,
  maxItems,
  namePlaceholder = "Title",
  descriptionPlaceholder = "Details (optional)",
  nameLabel = "Title",
  descriptionLabel = "Details",
  nameMaxLength = 100,
  descriptionMaxLength = 500,
  headerContent,
  addLabel = "Add another",
}: EditableItemsSectionProps) {
  const visible = [...items.keys()].filter((i) => items[i].checked !== false);
  const canAdd = items.length < maxItems;

  // Focus the title of a row the host just added
  const prevLen = useRef(items.length);
  const rowRefs = useRef<Record<number, HTMLInputElement | null>>({});
  useEffect(() => {
    if (items.length > prevLen.current) {
      const last = rowRefs.current[items.length - 1];
      if (last && !last.value) last.focus();
    }
    prevLen.current = items.length;
  }, [items.length]);

  const findIndex = (name: string) => items.findIndex((it) => typeof it.name === "string" && it.name.toLowerCase() === name.toLowerCase());

  const toggleSuggestion = (name: string) => {
    const existing = findIndex(name);
    if (existing >= 0) {
      onDelete?.(existing);
      return;
    }
    if (!canAdd) return;
    const s = suggestions.find((x) => x.name === name);
    if (!s) return;
    if (onAddWithValues) onAddWithValues(s);
    else {
      const newIndex = items.length;
      onAdd();
      setTimeout(() => {
        onChange(newIndex, "name", s.name);
        onChange(newIndex, "description", s.description);
        onChange(newIndex, "checked", true);
      }, 10);
    }
  };

  return (
    <div className="space-y-5">
      {headerContent}
      <Card>
        <CardHeader
          title={title}
          description={description}
          action={<span className="rounded-full bg-[#F5EFE7] px-2.5 py-1 text-xs font-medium text-gray-600">{visible.length} of {maxItems}</span>}
        />
        <SuggestionChips items={suggestions.map((s) => s.name)} isActive={(n) => findIndex(n) >= 0} onToggle={toggleSuggestion} />

        {visible.length > 0 && (
          <ol className="mb-4 space-y-3">
            {visible.map((idx, position) => {
              const item = items[idx];
              return (
                <li key={idx} className="group flex gap-3 rounded-xl border border-[#ECE5DB] bg-[#FDFBF8] p-3 sm:p-4">
                  <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{position + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      aria-label={nameLabel}
                      maxLength={nameMaxLength}
                      value={item.name}
                      onChange={(e) => onChange(idx, "name", e.target.value)}
                      placeholder={namePlaceholder}
                      className={`${inputClass} font-medium`}
                    />
                    <textarea
                      aria-label={descriptionLabel}
                      maxLength={descriptionMaxLength}
                      value={item.description}
                      onChange={(e) => onChange(idx, "description", e.target.value)}
                      placeholder={descriptionPlaceholder}
                      rows={2}
                      className={compactTextareaClass}
                    />
                  </div>
                  {onDelete && (
                    <IconButton label="Remove" tone="danger" onClick={() => onDelete(idx)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <AddRowButton onClick={() => canAdd && onAdd()} disabled={!canAdd}>
          {canAdd ? addLabel : `Limit of ${maxItems} reached`}
        </AddRowButton>
      </Card>
    </div>
  );
}
