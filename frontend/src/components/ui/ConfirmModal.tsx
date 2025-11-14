"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmClasses = destructive
    ? "bg-red-600 hover:bg-red-700 text-white"
    : "bg-[oklch(0.6923_0.22_21.05)] hover:opacity-90 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">
            {title || "Are you sure?"}
          </h3>
          <Button size="sm" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
        <div className="p-5 space-y-4">
          {description && (
            <p className="text-sm text-gray-600 whitespace-pre-line">{description}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button className={confirmClasses} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
