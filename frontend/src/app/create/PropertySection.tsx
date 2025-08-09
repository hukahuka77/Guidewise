import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PropertySectionProps {
  propertyName: string;
  onChange: (id: string, value: string) => void;
  onCoverImageChange: (file: File | null) => void;
  coverPreviewUrl: string | null;
}

export default function PropertySection({ propertyName, onChange, onCoverImageChange, coverPreviewUrl }: PropertySectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Property Details</h2>
      </div>

      <Label htmlFor="propertyName">Property Name</Label>
      <Input
        id="propertyName"
        value={propertyName}
        onChange={(e) => onChange("propertyName", e.target.value)}
        className="mb-4 mt-1"
        placeholder="e.g. Sunny Retreat Guest House"
      />

      <div className="mt-4">
        <Label htmlFor="coverImage">Property Cover Image</Label>
        <Input
          id="coverImage"
          type="file"
          accept="image/*"
          className="mt-1"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
            onCoverImageChange(file);
          }}
        />
        <p className="text-sm text-gray-600 mt-1">This image will be used as the default cover of the guidebook.</p>
        {coverPreviewUrl && (
          <img src={coverPreviewUrl} alt="Cover Preview" className="mt-3 h-40 w-auto rounded border" />
        )}
      </div>
    </section>
  );
}
