import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Host Info</h2>
      </div>
      <Label htmlFor="hostName">Host Name <span className="text-red-600">*</span></Label>
      <Input id="hostName" required value={name} onChange={e => onChange("hostName", e.target.value)} className="mb-2 mt-1" placeholder="e.g. Alex Morgan" />
      <Label htmlFor="hostBio">Bio</Label>
      <Textarea id="hostBio" value={bio} onChange={e => onChange("hostBio", e.target.value)} className="mb-2 mt-1" />
      <Label htmlFor="hostContact">Contact Info</Label>
      <Input id="hostContact" value={contact} onChange={e => onChange("hostContact", e.target.value)} className="mt-1" placeholder="e.g. alex@email.com | (555) 123-4567" />

      <div className="mt-4">
        <Label htmlFor="hostPhoto">Host Photo</Label>
        <Input
          id="hostPhoto"
          type="file"
          accept="image/*"
          className="mt-1"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
            onHostPhotoChange(file);
          }}
        />
        <p className="text-sm text-gray-600 mt-1">This photo can appear alongside your host intro.</p>
        {hostPhotoPreviewUrl && (
          <img src={hostPhotoPreviewUrl} alt="Host Preview" className="mt-3 h-32 w-32 object-cover rounded-full border" />
        )}
      </div>
    </section>
  );
}
