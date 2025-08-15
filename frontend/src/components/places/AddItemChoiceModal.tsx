"use client";

import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onGoogle: () => void;
  onManual: () => void;
};

export default function AddItemChoiceModal({ open, title, onClose, onGoogle, onManual }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title || "Add item"}</h3>
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        </div>
        <div className="p-6 flex flex-col gap-3">
          <Button onClick={() => { onGoogle(); onClose(); }}>
            Add from Google
          </Button>
          <Button variant="secondary" onClick={() => { onManual(); onClose(); }}>
            Add manually
          </Button>
        </div>
      </div>
    </div>
  );
}
