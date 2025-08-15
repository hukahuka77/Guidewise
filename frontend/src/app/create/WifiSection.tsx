import React from "react";
import { Wifi } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LIMITS } from "@/constants/limits";

interface WifiSectionProps {
  wifiNetwork: string;
  wifiPassword: string;
  onChange: (id: string, value: string) => void;
}

export default function WifiSection({ wifiNetwork, wifiPassword, onChange }: WifiSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Wifi style={{ color: 'oklch(0.6923 0.22 21.05)' }} />
        <h2 className="text-xl font-semibold">Wifi</h2>
      </div>
      <Label htmlFor="wifiNetwork">Network Name</Label>
      <Input
        id="wifiNetwork"
        value={wifiNetwork}
        maxLength={LIMITS.wifiNetwork}
        onChange={e => onChange("wifiNetwork", e.target.value)}
        className="mb-2 mt-1"
        placeholder="e.g. SunnyRetreatGuest"
      />
      <Label htmlFor="wifiPassword">Password</Label>
      <Input
        id="wifiPassword"
        value={wifiPassword}
        maxLength={LIMITS.wifiPassword}
        onChange={e => onChange("wifiPassword", e.target.value)}
        className="mt-1"
        placeholder="e.g. beachtime2025"
      />
    </section>
  );
}
