import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash } from "lucide-react";

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
}



export default function RulesSection({ rules, onChange, onAdd, onDelete }: RulesSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Rules</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {rules.map((rule, idx) => (
          <div key={idx} className="p-4 rounded-lg bg-white/80 shadow flex flex-col gap-2 relative">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rule.checked}
                onChange={e => onChange(idx, 'checked', e.target.checked)}
                className="accent-pink-500 mt-1"
              />
              <span>
                <span className="font-medium">{rule.name}</span>
                <br />
                <span className="text-sm text-gray-600">{rule.description}</span>
              </span>
            </label>
            {onDelete && (
              <button
                type="button"
                aria-label="Delete rule"
                className="absolute top-2 right-2 p-1 rounded hover:bg-pink-100 transition"
                onClick={() => onDelete(idx)}
              >
                <Trash style={{ color: 'oklch(0.6923 0.22 21.05)' }} size={20} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-pink-400 rounded-lg hover:bg-pink-50 transition">
        <Plus style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <span>Add another rule</span>
      </button>
    </section>
  );
}
