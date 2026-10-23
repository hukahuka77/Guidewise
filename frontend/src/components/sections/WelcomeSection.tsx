import React from "react";
import { LIMITS } from "@/constants/limits";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { Card, CardHeader, Field, ImageDrop, inputClass, textareaClass } from "@/components/editor/primitives";
import HostInfoSection from "./HostInfoSection";

interface WelcomeSectionProps {
  welcomeMessage: string;
  location: string;
  onChange: (id: string, value: string) => void;
  propertyName: string;
  onCoverImageChange: (file: File | null) => void;
  coverPreviewUrl: string | null;
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
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Your place" description="The name, address and cover photo guests see first." />
        <div className="space-y-5">
          <Field label="Cover photo">
            <ImageDrop
              previewUrl={coverPreviewUrl}
              onFile={(file) => onCoverImageChange(file)}
              label="Upload a cover photo"
              hint="A bright, wide photo of the home works best. Drag and drop or click."
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Property name" htmlFor="propertyName" count={[propertyName.length, LIMITS.propertyName]}>
              <input
                id="propertyName"
                value={propertyName}
                maxLength={LIMITS.propertyName}
                onChange={(e) => onChange("propertyName", e.target.value)}
                className={inputClass}
                placeholder="e.g. Willow Cottage"
              />
            </Field>
            <Field label="Address" htmlFor="location-autocomplete" required hint="Used for directions and nearby recommendations.">
              <PlacesAutocomplete
                value={location}
                onChange={(val) => onChange("location", val)}
                placeholder="Start typing an address…"
                className={`${inputClass} h-auto`}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Welcome message" description="A short, warm hello. It opens your guidebook." />
        <Field label="Message" htmlFor="welcomeMessage" count={[welcomeMessage.length, LIMITS.welcomeMessage]}>
          <textarea
            id="welcomeMessage"
            maxLength={LIMITS.welcomeMessage}
            value={welcomeMessage}
            onChange={(e) => onChange("welcomeMessage", e.target.value)}
            className={textareaClass}
            rows={5}
            placeholder="Welcome! We're so glad you're here. Everything you need for your stay is in this guide."
          />
        </Field>
      </Card>

      <HostInfoSection
        name={hostName}
        bio={hostBio}
        contact={hostContact}
        onChange={onChange}
        onHostPhotoChange={onHostPhotoChange}
        hostPhotoPreviewUrl={hostPhotoPreviewUrl}
      />
    </div>
  );
}
