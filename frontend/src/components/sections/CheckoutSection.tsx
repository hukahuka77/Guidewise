import React from "react";
import EditableItemsSection, { EditableItem } from "./EditableItemsSection";
import { Card, CardHeader, Field, inputClass } from "@/components/editor/primitives";
import { LIMITS } from "@/constants/limits";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CheckoutInfoItem extends EditableItem {}

interface CheckoutSectionProps {
  checkoutTime: string;
  items: CheckoutInfoItem[];
  onTimeChange: (value: string) => void;
  onChange: (idx: number, field: keyof CheckoutInfoItem, value: string | boolean) => void;
  onAdd: () => void;
  onAddWithValues?: (item: Omit<CheckoutInfoItem, 'checked'>) => void;
  onDelete?: (idx: number) => void;
}

const CHECKOUT_SUGGESTIONS = [
  { name: "Trash", description: "Please bag all trash and place it in the outside bin." },
  { name: "Dishes", description: "Load and run the dishwasher (or hand wash any used dishes)." },
  { name: "Lights", description: "Turn off all lights throughout the property." },
  { name: "Thermostat", description: "Set thermostat to 72°F." },
  { name: "Lock Doors", description: "Ensure all doors and windows are locked." },
];

export default function CheckoutSection({
  checkoutTime,
  items,
  onTimeChange,
  onChange,
  onAdd,
  onAddWithValues,
  onDelete
}: CheckoutSectionProps) {
  const headerContent = (
    <Card>
      <CardHeader title="Check-out time" description="Shown at the top of the guidebook and on the departure card." />
      <Field label="Guests leave by" htmlFor="checkOutTime">
        <input id="checkOutTime" type="time" step={300} value={checkoutTime} onChange={(e) => onTimeChange(e.target.value)} className={`${inputClass} sm:w-48`} />
      </Field>
    </Card>
  );

  return (
    <EditableItemsSection
      title="Before you go"
      description="Steps guests tick off before leaving."
      items={items}
      addLabel="Add a step"
      suggestions={CHECKOUT_SUGGESTIONS}
      onChange={onChange}
      onAdd={onAdd}
      onAddWithValues={onAddWithValues}
      onDelete={onDelete}
      maxItems={LIMITS.maxCheckoutItems}
      namePlaceholder="e.g. Take out the trash"
      descriptionPlaceholder="Details (optional)"
      nameLabel="Title"
      descriptionLabel="Description"
      nameMaxLength={LIMITS.checkoutName}
      descriptionMaxLength={LIMITS.checkoutDescription}
      showCheckboxes={false}
      headerContent={headerContent}
    />
  );
}
