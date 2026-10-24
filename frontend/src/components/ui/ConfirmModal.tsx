"use client";

import React, { useRef } from "react";
import { useDialog } from "@/hooks/useDialog";

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

/** Confirm a step in Guidewise's dialog style (matches DialogHost). */
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(open, onCancel, dialogRef);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
          {title || "Are you sure?"}
        </h3>
        {description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-full px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 rounded-full px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 ${
              destructive ? "bg-red-600" : "bg-gradient-to-r from-[#db2777] to-[#f97316]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
