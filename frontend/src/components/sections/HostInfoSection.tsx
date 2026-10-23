import React from "react";
import { LIMITS } from "@/constants/limits";
import { Card, CardHeader, Field, ImageDrop, inputClass, textareaClass } from "@/components/editor/primitives";

interface HostInfoSectionProps {
  name: string;
  bio: string;
  contact: string;
  onChange: (id: string, value: string) => void;
  onHostPhotoChange: (file: File | null) => void;
  hostPhotoPreviewUrl: string | null;
}

export default function HostInfoSection({ name, bio, contact, onChange, onHostPhotoChange, hostPhotoPreviewUrl }: HostInfoSectionProps) {
  return (
    <Card>
      <CardHeader title="Your host details" description="Guests can call, text or email you straight from the guidebook." />
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <ImageDrop previewUrl={hostPhotoPreviewUrl} onFile={(file) => onHostPhotoChange(file)} shape="round" />
          <span className="text-xs text-gray-500">Photo</span>
        </div>
        <div className="flex-1 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="hostName">
              <input id="hostName" maxLength={LIMITS.hostName} value={name} onChange={(e) => onChange("hostName", e.target.value)} className={inputClass} placeholder="e.g. Alex Morgan" />
            </Field>
            <Field label="Phone or email" htmlFor="hostContact" hint="A phone number adds Call and Text buttons.">
              <input id="hostContact" maxLength={LIMITS.hostContact} value={contact} onChange={(e) => onChange("hostContact", e.target.value)} className={inputClass} placeholder="(555) 123-4567 · alex@email.com" />
            </Field>
          </div>
          <Field label="About you" htmlFor="hostBio" count={[bio.length, LIMITS.hostBio]}>
            <textarea id="hostBio" maxLength={LIMITS.hostBio} value={bio} onChange={(e) => onChange("hostBio", e.target.value)} className={textareaClass} rows={3} placeholder="A line or two about you and how to reach you during the stay." />
          </Field>
        </div>
      </div>
    </Card>
  );
}
