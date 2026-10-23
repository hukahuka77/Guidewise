"use client";

import { useEffect, useRef, useState } from "react";
import { setDialogListener, type DialogRequest } from "@/lib/dialog";

/** Renders the dialogs requested through `showDialog` / `notify`. Mounted once, in the root layout. */
export default function DialogHost() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDialogListener(setRequest);
    return () => setDialogListener(null);
  }, []);

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRequest(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;
  const close = () => setRequest(null);
  const confirm = () => {
    setRequest(null);
    request.onConfirm?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gw-dialog-title"
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="gw-dialog-title" className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
          {request.title}
        </h2>
        {request.message && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{request.message}</p>}
        <div className="mt-6 flex justify-end gap-2">
          {request.cancelLabel && (
            <button type="button" onClick={close} className="h-10 rounded-full px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50">
              {request.cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={confirm}
            className="h-10 rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            {request.confirmLabel || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
