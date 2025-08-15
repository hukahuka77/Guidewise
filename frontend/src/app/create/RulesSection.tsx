import React, { useEffect, useRef, useState } from "react";
import { LIMITS } from "@/constants/limits";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash, Pencil, Check, X } from "lucide-react";

interface Rule {
  name: string;
  description: string;
  checked: boolean;
}

interface RulesSectionProps {
  rules: Rule[];
  onChange: (index: number, field: keyof Rule, value: string | boolean) => void;
  onAdd: () => void;
  onDelete?: (idx: number) => void;
  autoEditIndex?: number | null;
  onAutoEditHandled?: () => void;
}



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
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Rules</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {rules.map((rule, idx) => {
          const isEditing = editing.has(idx);
          return (
            <div key={idx} className="p-4 rounded-lg bg-white/80 shadow flex flex-col gap-3 relative">
              <div className="absolute top-2 right-2 flex items-center gap-1">
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
                {onDelete && (
                  <button
                    type="button"
                    aria-label="Delete rule"
                    className="p-1 rounded hover:bg-[oklch(0.6923_0.22_21.05)]/10 transition"
                    onClick={() => onDelete(idx)}
                  >
                    <Trash style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={18} />
                  </button>
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
        <span>Add another rule</span>
      </button>
    </section>
  );
}
