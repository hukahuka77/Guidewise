import React from "react";
import { ParkingCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ParkingSectionProps {
  parkingInfo: string;
  onChange: (id: string, value: string) => void;
}

export default function ParkingSection({ parkingInfo, onChange }: ParkingSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <ParkingCircle style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <h2 className="text-xl font-semibold">Parking</h2>
      </div>
      <Label htmlFor="parkingInfo">Parking Details</Label>
      <Input
        id="parkingInfo"
        value={parkingInfo}
        onChange={e => onChange("parkingInfo", e.target.value)}
        className="mt-1"
      />
    </section>
  );
}
