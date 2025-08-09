import React from "react";
import { CalendarCheck2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ArrivalSectionProps {
  checkInTime: string;
  onChange: (id: string, value: string) => void;
}

export default function ArrivalSection({ checkInTime, onChange }: ArrivalSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <CalendarCheck2 style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <h2 className="text-xl font-semibold">Arrival</h2>
      </div>
      <Label htmlFor="checkInTime">Check-in Time</Label>
      <Input
        id="checkInTime"
        type="time"
        step={300}
        value={checkInTime}
        onChange={e => onChange("checkInTime", e.target.value)}
        className="w-40 mt-1"
      />
      <p className="text-sm text-gray-500 mt-1">Select your preferred arrival time (5-minute increments).</p>
    </section>
  );
}
