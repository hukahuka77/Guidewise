"use client";
import Spinner from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-700">
        <Spinner size={22} colorClass="text-[oklch(0.6923_0.22_21.05)]" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
