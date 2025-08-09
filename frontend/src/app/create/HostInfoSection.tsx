import React, { useState, useRef } from "react";
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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Host Info</h2>
      </div>
      <Label htmlFor="hostName">Host Name <span className="text-red-600">*</span></Label>
      <Input id="hostName" required value={name} onChange={e => onChange("hostName", e.target.value)} className="mb-2 mt-1" placeholder="e.g. Alex Morgan" />
      <Label htmlFor="hostBio">Bio</Label>
      <Textarea id="hostBio" value={bio} onChange={e => onChange("hostBio", e.target.value)} className="mb-2 mt-1" placeholder="Tell guests about yourself and how you like to host." />
      <Label htmlFor="hostContact">Contact Info</Label>
      <Input id="hostContact" value={contact} onChange={e => onChange("hostContact", e.target.value)} className="mt-1" placeholder="e.g. alex@email.com | (555) 123-4567" />

      <div className="mt-4">
        <Label htmlFor="hostPhoto">Host Photo</Label>
        <label htmlFor="hostPhoto" className="inline-block mt-1">
          <input
            id="hostPhoto"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              onHostPhotoChange(file);
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
              onHostPhotoChange(file);
            }}
          >
            {hostPhotoPreviewUrl ? (
              <img src={hostPhotoPreviewUrl} alt="Host Preview" className="h-full w-full object-cover rounded-xl" />
            ) : (
              <span className="text-sm">Click to upload</span>
            )}
          </div>
        </label>
        <p className="text-sm text-gray-600 mt-2">This photo can appear alongside your host intro.</p>
      </div>
    </section>
  );
}
