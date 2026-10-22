"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shown at /guidebook/<id> for guidebooks that are not published. Publishing is free; owners do it from the dashboard. */
export default function UnpublishedGuidebookPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white border rounded-2xl shadow-sm p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">This guidebook isn&apos;t published</h1>
        <p className="mt-4 text-gray-600">
          If this is your guidebook, publish it from your dashboard. Publishing is free. Otherwise, please ask your host for the current link.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/dashboard">
            <Button className="w-full">Go to my dashboard</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full">Back to Guidewise</Button>
          </Link>
        </div>
        <div className="mt-6 text-xs text-gray-500">
          Powered by <Link className="font-semibold hover:underline" href="/">GUIDEWISE</Link>
        </div>
      </div>
    </div>
  );
}
