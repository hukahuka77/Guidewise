import React, { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";

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
  items: EditableItem[];
  suggestions?: Suggestion[];
  onChange: (index: number, field: keyof EditableItem, value: string | boolean) => void;
  onAdd: () => void;
  onAddWithValues?: (item: Omit<EditableItem, 'checked'>) => void;
  onDelete?: (index: number) => void;
  maxItems: number;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  nameLabel?: string;
  descriptionLabel?: string;
  nameMaxLength?: number;
  descriptionMaxLength?: number;
  showCheckboxes?: boolean;
  autoEditIndex?: number | null;
  onAutoEditHandled?: () => void;
  headerContent?: React.ReactNode;
}

export default function EditableItemsSection({
  title,
  items,
  suggestions = [],
  onChange,
  onAdd,
  onAddWithValues,
  onDelete,
  maxItems,
  namePlaceholder = "Item name",
  descriptionPlaceholder = "Item description",
  nameLabel = "Name",
  descriptionLabel = "Description",
  nameMaxLength = 100,
  descriptionMaxLength = 500,
  showCheckboxes = false,
  autoEditIndex,
  onAutoEditHandled,
  headerContent,
}: EditableItemsSectionProps) {
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const prevLen = useRef<number>(items.length);

  // When a new item is added, automatically open it in edit mode
  useEffect(() => {
    if (items.length > prevLen.current) {
      const newIdx = items.length - 1;
      setEditing(prev => new Set(prev).add(newIdx));
    } else if (items.length < prevLen.current) {
      setEditing(prev => new Set(Array.from(prev).filter(i => i < items.length)));
    }
    prevLen.current = items.length;
  }, [items.length]);

  // Parent-driven auto-edit trigger
  useEffect(() => {
    if (autoEditIndex != null && autoEditIndex >= 0 && autoEditIndex < items.length) {
      setEditing(prev => new Set(prev).add(autoEditIndex));
      onAutoEditHandled?.();
    }
  }, [autoEditIndex, items.length, onAutoEditHandled]);

  const startEdit = (idx: number) => setEditing(prev => new Set(prev).add(idx));
  const finishEdit = (idx: number) => setEditing(prev => { const next = new Set(prev); next.delete(idx); return next; });
  const cancelEdit = (idx: number) => finishEdit(idx);
  const canAdd = items.length < maxItems;

  // Check if a suggestion is already added
  const isSuggestionActive = (suggestionName: string) => {
    const target = suggestionName.toLowerCase();
    return items.some(item => typeof item.name === 'string' && item.name.toLowerCase() === target);
  };

  // Add or remove a suggestion
  const handleAddSuggestion = (suggestion: Suggestion) => {
    const target = suggestion.name.toLowerCase();
    const existingIndex = items.findIndex(item => typeof item.name === 'string' && item.name.toLowerCase() === target);
    if (existingIndex >= 0) {
      onDelete?.(existingIndex);
    } else {
      if (!canAdd) return;
      if (onAddWithValues) {
        onAddWithValues(suggestion);
      } else {
        onAdd();
        setTimeout(() => {
          const newIndex = items.length;
          onChange(newIndex, "name", suggestion.name);
          onChange(newIndex, "description", suggestion.description);
          onChange(newIndex, "checked", true);
        }, 10);
      }
    }
  };

  const renderItemCard = (idx: number, isInactive: boolean = false) => {
    const item = items[idx];
    const isEditing = editing.has(idx);

    return (
      <div
        key={idx}
        className={`p-4 rounded-lg bg-white/80 shadow flex flex-col gap-3 relative ${isInactive ? 'opacity-60 grayscale' : ''}`}
      >
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              aria-label="Delete item"
              className="p-1 rounded hover:bg-red-100 transition"
              onClick={() => onDelete(idx)}
            >
              <Trash2 style={{ color: '#ef4444' }} size={18} />
            </button>
          )}
          {!isEditing ? (
            <button
              type="button"
              aria-label="Edit item"
              className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
              onClick={() => startEdit(idx)}
            >
              <Pencil style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
            </button>
          ) : (
            <>
              <button
                type="button"
                aria-label="Save item"
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

        {showCheckboxes ? (
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
                  <Label>{nameLabel}</Label>
                  <Input
                    autoFocus
                    maxLength={nameMaxLength}
                    value={item.name}
                    onChange={e => onChange(idx, 'name', e.target.value)}
                    placeholder={namePlaceholder}
                  />
                </div>
                <div>
                  <Label>{descriptionLabel}</Label>
                  <Textarea
                    maxLength={descriptionMaxLength}
                    value={item.description}
                    onChange={e => onChange(idx, 'description', e.target.value)}
                    placeholder={descriptionPlaceholder}
                  />
                </div>
              </div>
            )}
          </label>
        ) : (
          <div className="flex-1">
            {!isEditing ? (
              <div>
                <div className="font-medium">{item.name || 'Untitled'}</div>
                <div className="text-sm text-gray-600 mt-1">{item.description || 'No description'}</div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
                <div>
                  <Label>{nameLabel}</Label>
                  <Input
                    autoFocus
                    maxLength={nameMaxLength}
                    value={item.name}
                    onChange={e => onChange(idx, 'name', e.target.value)}
                    placeholder={namePlaceholder}
                  />
                </div>
                <div>
                  <Label>{descriptionLabel}</Label>
                  <Textarea
                    maxLength={descriptionMaxLength}
                    value={item.description}
                    onChange={e => onChange(idx, 'description', e.target.value)}
                    placeholder={descriptionPlaceholder}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold text-center">{title}</h2>
      </div>

      {headerContent}

      {/* Quick-add suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-6 flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 mb-2">
            {suggestions.map((suggestion) => {
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
          <p className="text-sm text-gray-400 italic">Quick add suggestions</p>
        </div>
      )}

      {/* Active items */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...items.keys()].filter(i => items[i].checked).map((idx) => renderItemCard(idx))}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!canAdd) return;
          const newIdx = items.length;
          onAdd();
          setEditing(prev => new Set(prev).add(newIdx));
        }}
        disabled={!canAdd}
        className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Plus style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <span>Add another</span>
      </button>

      {/* Inactive items */}
      {showCheckboxes && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...items.keys()].filter(i => !items[i].checked).map((idx) => renderItemCard(idx, true))}
        </div>
      )}
    </section>
  );
}
