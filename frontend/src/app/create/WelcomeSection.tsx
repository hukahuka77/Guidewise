/* eslint-disable @next/next/no-img-element */
import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/constants/limits";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import HostInfoSection from "./HostInfoSection";

interface WelcomeSectionProps {
  welcomeMessage: string;
  location: string;
  onChange: (id: string, value: string) => void;
  // Safety Info (optional but included here)
  emergencyContact: string;
  fireExtinguisherLocation: string;
  // Host Info
  hostName: string;
  hostBio: string;
  hostContact: string;
  onHostPhotoChange: (file: File | null) => void;
  hostPhotoPreviewUrl: string | null;
}

export default function WelcomeSection({
  welcomeMessage,
  location,
  onChange,
  emergencyContact,
  fireExtinguisherLocation,
  hostName,
  hostBio,
  hostContact,
  onHostPhotoChange,
  hostPhotoPreviewUrl,
}: WelcomeSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Welcome</h2>
      </div>

      {/* Welcome message */}
      <Label htmlFor="welcomeMessage">Welcome Message</Label>
      <Textarea
        id="welcomeMessage"
        maxLength={LIMITS.welcomeMessage}
        value={welcomeMessage}
        onChange={(e) => onChange("welcomeMessage", e.target.value)}
        className="mb-2 mt-1"
        placeholder="Write a friendly greeting and what guests can expect during their stay."
      />

      {/* Location */}
      <Label htmlFor="location">Location <span className="text-red-500" title="Required">*</span></Label>
      <PlacesAutocomplete
        value={location}
        onChange={(val) => onChange("location", val)}
        placeholder="Start typing an address or place..."
        className="mb-4 mt-1"
      />

      {/* Host Info (reused) */}
      <div className="mt-6">
        <HostInfoSection
          name={hostName}
          bio={hostBio}
          contact={hostContact}
          onChange={onChange}
          onHostPhotoChange={onHostPhotoChange}
          hostPhotoPreviewUrl={hostPhotoPreviewUrl}
        />
      </div>

      {/* Safety Info (moved to bottom) */}
      <div className="mt-6">
        <h3 className="font-semibold mb-2">Safety Info</h3>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label htmlFor="emergencyContact">Emergency Contact</Label>
            <input
              id="emergencyContact"
              type="text"
              value={emergencyContact}
              onChange={(e) => onChange("emergencyContact", e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="Name and phone (e.g., Host +1 555-555-5555)"
            />
          </div>
          <div>
            <Label htmlFor="fireExtinguisherLocation">Fire Extinguisher Location</Label>
            <input
              id="fireExtinguisherLocation"
              type="text"
              value={fireExtinguisherLocation}
              onChange={(e) => onChange("fireExtinguisherLocation", e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="e.g., Under kitchen sink"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
