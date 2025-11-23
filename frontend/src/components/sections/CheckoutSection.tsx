import React from "react";
import EditableItemsSection, { EditableItem } from "./EditableItemsSection";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
    <>
      <Label htmlFor="checkOutTime">Checkout Time</Label>
      <Input
        id="checkOutTime"
        type="time"
        step={300}
        value={checkoutTime}
        onChange={e => onTimeChange(e.target.value)}
        className="mb-2 mt-1 w-40"
      />
      <p className="text-sm text-gray-500 mb-4">Select your preferred checkout time (5-minute increments).</p>
    </>
  );

  return (
    <EditableItemsSection
      title="Checkout Info"
      items={items}
      suggestions={CHECKOUT_SUGGESTIONS}
      onChange={onChange}
      onAdd={onAdd}
      onAddWithValues={onAddWithValues}
      onDelete={onDelete}
      maxItems={LIMITS.maxCheckoutItems}
      namePlaceholder="e.g. Trash & linens"
      descriptionPlaceholder="What guests should know before checkout..."
      nameLabel="Title"
      descriptionLabel="Description"
      nameMaxLength={LIMITS.checkoutName}
      descriptionMaxLength={LIMITS.checkoutDescription}
      showCheckboxes={true}
      headerContent={headerContent}
    />
  );
}
