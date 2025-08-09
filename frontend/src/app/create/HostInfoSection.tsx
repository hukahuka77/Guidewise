import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface HostInfoSectionProps {
  name: string;
  bio: string;
  contact: string;
  onChange: (id: string, value: string) => void;
}

export default function HostInfoSection({ name, bio, contact, onChange }: HostInfoSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-semibold">Host Info</h2>
      </div>
      <Label htmlFor="hostName">Host Name</Label>
      <Input id="hostName" value={name} onChange={e => onChange("hostName", e.target.value)} className="mb-2 mt-1" placeholder="e.g. Alex Morgan" />
      <Label htmlFor="hostBio">Bio</Label>
      <Textarea id="hostBio" value={bio} onChange={e => onChange("hostBio", e.target.value)} className="mb-2 mt-1" />
      <Label htmlFor="hostContact">Contact Info</Label>
      <Input id="hostContact" value={contact} onChange={e => onChange("hostContact", e.target.value)} className="mt-1" placeholder="e.g. alex@email.com | (555) 123-4567" />
    </section>
  );
}
