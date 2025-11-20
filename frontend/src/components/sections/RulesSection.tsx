import React, { useEffect, useRef, useState } from "react";
import { LIMITS } from "@/constants/limits";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";

interface Rule {
  name: string;
  description: string;
  checked: boolean;
}

interface RulesSectionProps {
  rules: Rule[];
  onChange: (index: number, field: keyof Rule, value: string | boolean) => void;
  onAdd: () => void;
  onDelete?: (index: number) => void;
  autoEditIndex?: number | null;
  onAutoEditHandled?: () => void;
}

const RULES_SUGGESTIONS = [
  { name: "No Smoking", description: "Smoking is not permitted anywhere on the property." },
  { name: "No Parties", description: "No parties or events are allowed." },
  { name: "Quiet Hours", description: "Please keep noise to a minimum between 10 PM and 8 AM." },
  { name: "No Pets", description: "Pets are not allowed on the property." },
  { name: "Respect Neighbors", description: "Please be respectful of our neighbors and the surrounding community." },
];



export default function RulesSection({ rules, onChange, onAdd, onDelete, autoEditIndex, onAutoEditHandled }: RulesSectionProps) {
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const prevLen = useRef<number>(rules.length);

  // When a new rule is added (length increases), automatically open the newest in edit mode.
  useEffect(() => {
    if (rules.length > prevLen.current) {
      const newIdx = rules.length - 1;
      setEditing(prev => new Set(prev).add(newIdx));
    } else if (rules.length < prevLen.current) {
      // If items removed, ensure we don't keep editing indexes out of range
      setEditing(prev => new Set(Array.from(prev).filter(i => i < rules.length)));
    }
    prevLen.current = rules.length;
  }, [rules.length]);

  // Parent-driven auto-edit trigger
  useEffect(() => {
    if (autoEditIndex != null && autoEditIndex >= 0 && autoEditIndex < rules.length) {
      setEditing(prev => new Set(prev).add(autoEditIndex));
      onAutoEditHandled?.();
    }
  }, [autoEditIndex, rules.length, onAutoEditHandled]);

  const startEdit = (idx: number) => setEditing(prev => new Set(prev).add(idx));
  const finishEdit = (idx: number) => setEditing(prev => { const next = new Set(prev); next.delete(idx); return next; });
  const cancelEdit = (idx: number) => finishEdit(idx); // changes are live; cancel just exits
  const canAdd = rules.length < LIMITS.maxRules;

  // Check if a suggestion is already added
  const isSuggestionActive = (suggestionName: string) => {
    return rules.some(rule => rule.name.toLowerCase() === suggestionName.toLowerCase());
  };

  // Add or remove a suggestion
  const handleAddSuggestion = (suggestion: { name: string; description: string }) => {
    const existingIndex = rules.findIndex(rule => rule.name.toLowerCase() === suggestion.name.toLowerCase());
    if (existingIndex >= 0) {
      // Remove if exists
      onDelete?.(existingIndex);
    } else {
      // Add if doesn't exist
      if (!canAdd) return;
      onAdd();
      const newIndex = rules.length;
      setTimeout(() => {
        onChange(newIndex, "name", suggestion.name);
        onChange(newIndex, "description", suggestion.description);
        onChange(newIndex, "checked", true);
      }, 0);
    }
  };
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold text-center">House Rules</h2>
      </div>

      {/* Quick-add suggestions */}
      <div className="mb-6 flex flex-col items-center">
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          {RULES_SUGGESTIONS.map((suggestion) => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...rules.keys()].filter(i => rules[i].checked).map((idx) => {
          const rule = rules[idx];
          const isEditing = editing.has(idx);
          return (
            <div key={idx} className="p-4 rounded-lg bg-white/80 shadow flex flex-col gap-3 relative">
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {onDelete && (
                  <button
                    type="button"
                    aria-label="Delete rule"
                    className="p-1 rounded hover:bg-red-100 transition"
                    onClick={() => onDelete(idx)}
                  >
                    <Trash2 style={{ color: '#ef4444' }} size={18} />
                  </button>
                )}
                {!isEditing ? (
                  <button
                    type="button"
                    aria-label="Edit rule"
                    className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                    onClick={() => startEdit(idx)}
                  >
                    <Pencil style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="Save rule"
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
                  checked={rule.checked}
                  onChange={e => onChange(idx, 'checked', e.target.checked)}
                  className="mt-1 accent-[oklch(0.6923_0.22_21.05)]"
                />
                {!isEditing ? (
                  <span>
                    <span className="font-medium">{rule.name || 'Untitled rule'}</span>
                    <br />
                    <span className="text-sm text-gray-600">{rule.description || 'No description'}</span>
                  </span>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    <div>
                      <Label>Rule Name</Label>
                      <Input autoFocus maxLength={LIMITS.ruleName} value={rule.name} onChange={e => onChange(idx, 'name', e.target.value)} placeholder="e.g. Quiet Hours" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea maxLength={LIMITS.ruleDescription} value={rule.description} onChange={e => onChange(idx, 'description', e.target.value)} placeholder="Explain the rule details..." />
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
        onClick={() => {
          if (!canAdd) return;
          const newIdx = rules.length;
          onAdd();
          // Mark the soon-to-exist item as editing so it renders in edit mode on the next render
          setEditing(prev => new Set(prev).add(newIdx));
        }}
        disabled={!canAdd}
        className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[oklch(0.6923_0.22_21.05)]/60 rounded-lg hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Plus style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <span>Add another</span>
      </button>
      {/* Inactive rules section below the add button */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...rules.keys()].filter(i => !rules[i].checked).map((idx) => {
          const rule = rules[idx];
          const isEditing = editing.has(idx);
          return (
            <div key={idx} className="p-4 rounded-lg bg-white/80 shadow flex flex-col gap-3 relative opacity-60 grayscale">
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {onDelete && (
                  <button
                    type="button"
                    aria-label="Delete rule"
                    className="p-1 rounded hover:bg-red-100 transition"
                    onClick={() => onDelete(idx)}
                  >
                    <Trash2 style={{ color: '#ef4444' }} size={18} />
                  </button>
                )}
                {!isEditing ? (
                  <button
                    type="button"
                    aria-label="Edit rule"
                    className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                    onClick={() => startEdit(idx)}
                  >
                    <Pencil style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="Save rule"
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
                  checked={rule.checked}
                  onChange={e => onChange(idx, 'checked', e.target.checked)}
                  className="mt-1 accent-[oklch(0.6923_0.22_21.05)]"
                />
                {!isEditing ? (
                  <span>
                    <span className="font-medium">{rule.name || 'Untitled rule'}</span>
                    <br />
                    <span className="text-sm text-gray-600">{rule.description || 'No description'}</span>
                  </span>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    <div>
                      <Label>Rule Name</Label>
                      <Input autoFocus maxLength={LIMITS.ruleName} value={rule.name} onChange={e => onChange(idx, 'name', e.target.value)} placeholder="e.g. Quiet Hours" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea maxLength={LIMITS.ruleDescription} value={rule.description} onChange={e => onChange(idx, 'description', e.target.value)} placeholder="Explain the rule details..." />
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
