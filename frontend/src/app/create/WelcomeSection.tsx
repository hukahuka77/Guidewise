/* eslint-disable @next/next/no-img-element */
import React, { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/constants/limits";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import HostInfoSection from "./HostInfoSection";

interface WelcomeSectionProps {
  welcomeMessage: string;
  location: string;
  onChange: (id: string, value: string) => void;
  // Property basics moved here
  propertyName: string;
  onCoverImageChange: (file: File | null) => void;
  coverPreviewUrl: string | null;
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
  propertyName,
  onCoverImageChange,
  coverPreviewUrl,
  hostName,
  hostBio,
  hostContact,
  onHostPhotoChange,
  hostPhotoPreviewUrl,
}: WelcomeSectionProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

      {/* Property basics (moved below Welcome and Location) */}
      <div className="mb-6">
        <Label htmlFor="propertyName">Property Name</Label>
        <input
          id="propertyName"
          value={propertyName}
          maxLength={LIMITS.propertyName}
          onChange={(e) => onChange("propertyName", e.target.value)}
          className="mb-4 mt-1 w-full border rounded px-3 py-2"
          placeholder="e.g. Sunny Retreat Guest House"
        />

        <Label htmlFor="coverImage">Property Cover Image</Label>
        <label htmlFor="coverImage" className="inline-block mt-1">
          <input
            id="coverImage"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              onCoverImageChange(file);
            }}
          />
          <div
            className={`h-40 w-40 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer bg-white text-gray-500 hover:border-[oklch(0.6923_0.22_21.05)]/70 hover:text-[oklch(0.6923_0.22_21.05)] ${dragOver ? 'border-[oklch(0.6923_0.22_21.05)] bg-[oklch(0.6923_0.22_21.05)]/10 text-[oklch(0.6923_0.22_21.05)]' : 'border-gray-300'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
              onCoverImageChange(file);
            }}
          >
            {coverPreviewUrl ? (
              <img src={coverPreviewUrl} alt="Cover Preview" className="h-full w-full object-cover rounded-xl" />
            ) : (
              <div className="text-center px-2">
                <span className="block text-sm">Click to upload</span>
                <span className="block text-xs text-gray-400">or drag & drop</span>
              </div>
            )}
          </div>
        </label>
        <p className="text-sm text-gray-600 mt-2">This image will be used as the default cover of the guidebook.</p>
      </div>

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
    </section>
  );
}
