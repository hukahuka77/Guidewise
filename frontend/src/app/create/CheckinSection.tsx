import React from "react";
import { DoorOpen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { Textarea } from "@/components/ui/textarea";

interface CheckinSectionProps {
  welcomeMessage: string;
  location: string;
  accessInfo: string;
  parkingInfo: string;
  onChange: (id: string, value: string) => void;
}

export default function CheckinSection({ welcomeMessage, location, accessInfo, parkingInfo, onChange }: CheckinSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <DoorOpen style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <h2 className="text-xl font-semibold">Check-in Info</h2>
      </div>
      <Label htmlFor="welcomeMessage">Welcome Message</Label>
      <Textarea id="welcomeMessage" value={welcomeMessage} onChange={e => onChange("welcomeMessage", e.target.value)} className="mb-2 mt-1" />
      <Label htmlFor="location">Location <span className="text-red-500" title="Required">*</span></Label>
      <PlacesAutocomplete
        value={location}
        onChange={val => onChange("location", val)}
        placeholder="Start typing an address or place..."
        className="mb-2 mt-1"
      />
      <Label htmlFor="accessInfo">Access Info</Label>
      <Textarea id="accessInfo" value={accessInfo} onChange={e => onChange("accessInfo", e.target.value)} className="mb-2 mt-1" />
      <Label htmlFor="parkingInfo">Parking Info</Label>
      <Textarea id="parkingInfo" value={parkingInfo} onChange={e => onChange("parkingInfo", e.target.value)} className="mt-1" />
    </section>
  );
}
