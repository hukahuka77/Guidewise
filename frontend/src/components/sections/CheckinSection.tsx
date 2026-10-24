import React from "react";
import { LIMITS } from "@/constants/limits";
import { Card, CardHeader, Field, SuggestionChips, inputClass, textareaClass } from "@/components/editor/primitives";
import TimePicker from "@/components/editor/TimePicker";

const SAFETY_SUGGESTIONS: { field: "emergencyContact" | "fireExtinguisherLocation"; label: string; value: string }[] = [
  { field: "emergencyContact", label: "Emergency contact", value: "In case of emergency, call: +1 (555) 123-4567" },
  { field: "fireExtinguisherLocation", label: "Fire extinguisher", value: "Located under the kitchen sink" },
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
  const safety = { emergencyContact, fireExtinguisherLocation };
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Arrival" description="When guests can arrive and how they get in." />
        <div className="space-y-5">
          <Field label="Check-in time" htmlFor="checkInTime">
            <TimePicker id="checkInTime" value={checkInTime} onChange={(v) => onChange("checkInTime", v)} />
          </Field>
          <Field label="Getting in" htmlFor="accessInfo" hint="Shown highlighted, so guests can find it quickly at the door." count={[accessInfo.length, LIMITS.accessInfo]}>
            <textarea id="accessInfo" maxLength={LIMITS.accessInfo} value={accessInfo} onChange={(e) => onChange("access_info", e.target.value)} className={textareaClass} placeholder="Door code, lockbox location or entry steps." />
          </Field>
          <Field label="Parking" htmlFor="parkingInfo" count={[parkingInfo.length, LIMITS.parkingInfo]}>
            <textarea id="parkingInfo" maxLength={LIMITS.parkingInfo} value={parkingInfo} onChange={(e) => onChange("parkingInfo", e.target.value)} className={textareaClass} rows={3} placeholder="Where to park, permits, spot numbers or restrictions." />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Wi-Fi" description="Shown at the top of the guidebook with a one-tap copy button." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Network name" htmlFor="wifiNetwork">
            <input id="wifiNetwork" type="text" maxLength={LIMITS.wifiNetwork} value={wifiNetwork} onChange={(e) => onChange("wifiNetwork", e.target.value)} className={inputClass} placeholder="e.g. WillowCottage" />
          </Field>
          <Field label="Password" htmlFor="wifiPassword">
            <input id="wifiPassword" type="text" maxLength={LIMITS.wifiPassword} value={wifiPassword} onChange={(e) => onChange("wifiPassword", e.target.value)} className={`${inputClass} font-mono`} placeholder="Wi-Fi password" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Safety" description="Emergency details guests should never have to search for." />
        <SuggestionChips
          items={SAFETY_SUGGESTIONS.map((s) => s.label)}
          isActive={(label) => Boolean(safety[SAFETY_SUGGESTIONS.find((s) => s.label === label)!.field])}
          onToggle={(label) => {
            const s = SAFETY_SUGGESTIONS.find((x) => x.label === label)!;
            onChange(s.field, safety[s.field] ? "" : s.value);
          }}
        />
        {(emergencyContact || fireExtinguisherLocation) && (
          <div className="grid gap-5 sm:grid-cols-2">
            {emergencyContact && (
              <Field label="Emergency contact" htmlFor="emergencyContact">
                <input id="emergencyContact" type="text" value={emergencyContact} onChange={(e) => onChange("emergencyContact", e.target.value)} className={inputClass} placeholder="Name and phone number" />
              </Field>
            )}
            {fireExtinguisherLocation && (
              <Field label="Fire extinguisher" htmlFor="fireExtinguisherLocation">
                <input id="fireExtinguisherLocation" type="text" value={fireExtinguisherLocation} onChange={(e) => onChange("fireExtinguisherLocation", e.target.value)} className={inputClass} placeholder="e.g. Under the kitchen sink" />
              </Field>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
