import React from "react";
import EditableItemsSection, { EditableItem } from "./EditableItemsSection";
import { LIMITS } from "@/constants/limits";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Rule extends EditableItem {}

interface RulesSectionProps {
  rules: Rule[];
  onChange: (index: number, field: keyof Rule, value: string | boolean) => void;
  onAdd: () => void;
  onAddWithValues?: (rule: Omit<Rule, 'checked'>) => void;
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

export default function RulesSection({
  rules,
  onChange,
  onAdd,
  onAddWithValues,
  onDelete,
  autoEditIndex,
  onAutoEditHandled
}: RulesSectionProps) {
  const normalizedRules: Rule[] = Array.isArray(rules)
    ? rules.map((r) => ({
        name: typeof r.name === 'string' ? r.name : '',
        description: typeof r.description === 'string' ? r.description : '',
        checked: typeof r.checked === 'boolean' ? r.checked : true,
      }))
    : [];

  return (
    <EditableItemsSection
      title="House Rules"
      items={normalizedRules}
      suggestions={RULES_SUGGESTIONS}
      onChange={onChange}
      onAdd={onAdd}
      onAddWithValues={onAddWithValues}
      onDelete={onDelete}
      maxItems={LIMITS.maxRules}
      namePlaceholder="e.g. Quiet Hours"
      descriptionPlaceholder="Explain the rule details..."
      nameLabel="Rule Name"
      descriptionLabel="Description"
      nameMaxLength={LIMITS.ruleName}
      descriptionMaxLength={LIMITS.ruleDescription}
      showCheckboxes={false}
      autoEditIndex={autoEditIndex}
      onAutoEditHandled={onAutoEditHandled}
    />
  );
}
