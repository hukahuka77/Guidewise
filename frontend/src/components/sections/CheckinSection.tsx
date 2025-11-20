import React from "react";
import { DoorOpen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/constants/limits";
import QuickSuggestions, { QuickSuggestion } from "@/components/ui/quick-suggestions";

const SAFETY_SUGGESTIONS: QuickSuggestion[] = [
  {
    field: "emergencyContact",
    label: "Emergency Contact",
    value: "In case of emergency, call: +1 (555) 123-4567"
  },
  {
    field: "fireExtinguisherLocation",
    label: "Fire Extinguisher",
    value: "Located under the kitchen sink"
  },
];

interface CheckinSectionProps {
  accessInfo: string;
  parkingInfo: string;
  checkInTime: string;
  emergencyContact: string;
  fireExtinguisherLocation: string;
  wifiNetwork: string;
  wifiPassword: string;
  onChange: (id: string, value: string) => void;
}

export default function CheckinSection({ accessInfo, parkingInfo, checkInTime, emergencyContact, fireExtinguisherLocation, wifiNetwork, wifiPassword, onChange }: CheckinSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <DoorOpen style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <h2 className="text-xl font-semibold">Check-in Info</h2>
      </div>
      <Label htmlFor="checkInTime">Check-in Time</Label>
      <Input
        id="checkInTime"
        type="time"
        value={checkInTime}
        onChange={e => onChange("checkInTime", e.target.value)}
        className="w-40 mb-2 mt-1"
      />
      <Label htmlFor="accessInfo">Access Info</Label>
      <Textarea id="accessInfo" maxLength={LIMITS.accessInfo} value={accessInfo} onChange={e => onChange("access_info", e.target.value)} className="mb-2 mt-1" placeholder="Door code, lockbox location, entry instructions, or concierge details." />
      <Label htmlFor="parkingInfo">Parking Info</Label>
      <Textarea id="parkingInfo" maxLength={LIMITS.parkingInfo} value={parkingInfo} onChange={e => onChange("parkingInfo", e.target.value)} className="mb-2 mt-1" placeholder="Where to park, permit requirements, garage/spot number, and any restrictions." />

      {/* Wi-Fi Info */}
      <div className="mt-6">
        <h3 className="font-semibold mb-2">Wi-Fi</h3>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label htmlFor="wifiNetwork">Network Name</Label>
            <Input
              id="wifiNetwork"
              type="text"
              maxLength={LIMITS.wifiNetwork}
              value={wifiNetwork}
              onChange={(e) => onChange("wifiNetwork", e.target.value)}
              className="mt-1 w-full"
              placeholder="Network name (SSID)"
            />
          </div>
          <div>
            <Label htmlFor="wifiPassword">Password</Label>
            <Input
              id="wifiPassword"
              type="text"
              maxLength={LIMITS.wifiPassword}
              value={wifiPassword}
              onChange={(e) => onChange("wifiPassword", e.target.value)}
              className="mt-1 w-full"
              placeholder="Wi-Fi password"
            />
          </div>
        </div>
      </div>

      {/* Safety Info */}
      <div className="mt-6">
        <h3 className="font-semibold mb-2">Safety Info</h3>

        {/* Quick-add suggestions */}
        <QuickSuggestions
          suggestions={SAFETY_SUGGESTIONS}
          selectedValues={{ emergencyContact, fireExtinguisherLocation }}
          onChange={onChange}
        />

        <div className="grid grid-cols-1 gap-3">
          {emergencyContact && (
            <div>
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                type="text"
                value={emergencyContact}
                onChange={(e) => onChange("emergencyContact", e.target.value)}
                className="mt-1 w-full"
                placeholder="Name and phone (e.g., Host +1 555-555-5555)"
              />
            </div>
          )}
          {fireExtinguisherLocation && (
            <div>
              <Label htmlFor="fireExtinguisherLocation">Fire Extinguisher Location</Label>
              <Input
                id="fireExtinguisherLocation"
                type="text"
                value={fireExtinguisherLocation}
                onChange={(e) => onChange("fireExtinguisherLocation", e.target.value)}
                className="mt-1 w-full"
                placeholder="e.g., Under kitchen sink"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
