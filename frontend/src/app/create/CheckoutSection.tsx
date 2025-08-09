import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CheckoutSectionProps {
  checkoutTime: string;
  requirements: string;
  onChange: (id: string, value: string) => void;
  requirementsPlaceholder?: string;
}

export default function CheckoutSection({ checkoutTime, requirements, onChange, requirementsPlaceholder }: CheckoutSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Checkout Info</h2>
      </div>
      <Label htmlFor="checkoutTime">Checkout Time</Label>
      <Input id="checkoutTime" type="time" value={checkoutTime} onChange={e => onChange("checkoutTime", e.target.value)} className="mb-2 mt-1" />
      <Label htmlFor="checkoutRequirements">Requirements</Label>
      <Textarea id="checkoutRequirements" value={requirements} onChange={e => onChange("checkoutRequirements", e.target.value)} className="mt-1" placeholder={requirementsPlaceholder} />
    </section>
  );
}
