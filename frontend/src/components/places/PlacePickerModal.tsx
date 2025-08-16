"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type PlaceSearchItem = {
  name: string;
  address: string;
  place_id: string;
};

export type DynamicItem = {
  name: string;
  address: string;
  description: string;
  image_url?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: DynamicItem) => void;
  near?: string | null;
  apiBase: string;
  title?: string;
};

export default function PlacePickerModal({ open, onClose, onSelect, near, apiBase, title }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceSearchItem[]>([]);

  if (!open) return null;

  const performSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`${apiBase}/api/places/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, near: near || null }),
      });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const json = await res.json();
      setResults(Array.isArray(json.items) ? json.items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const pick = async (place_id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/places/enrich?place_id=${encodeURIComponent(place_id)}`);
      if (!res.ok) throw new Error(`Enrich failed (${res.status})`);
      const item = (await res.json()) as DynamicItem;
      onSelect(item);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title || "Add from Google Places"}</h3>
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4 flex gap-2">
          <Input
            placeholder="Search places (e.g., best tacos, surf shop, art museum)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') performSearch(); }}
          />
          <Button onClick={performSearch} disabled={loading || !query.trim()}>{loading ? "Searching…" : "Search"}</Button>
        </div>
        {error && <div className="px-4 pb-2 text-red-600 text-sm">{error}</div>}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {results.length === 0 && !loading && (
            <div className="text-gray-500 text-sm">No results yet. Try a search above.</div>
          )}
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.place_id} className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-gray-50">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-gray-600 truncate">{r.address}</div>
                </div>
                <Button size="sm" onClick={() => pick(r.place_id)}>Select</Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
