/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type TemplateKey = "template_original" | "template_generic" | "template_modern" | "template_welcomebook";

type GuidebookMeta = {
  id: string;
  property_name?: string | null;
  template_key?: TemplateKey | null;
};

export default function GuidebookUrlTemplatesPage() {
  const params = useParams();
  const router = useRouter();
  const guidebookId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  const [gb, setGb] = useState<GuidebookMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<TemplateKey | null>(null);
  const [cacheVersion, setCacheVersion] = useState<number>(0);

  const liveGuidebookUrl = useMemo(() => {
    if (!guidebookId) return null;
    const baseUrl = `${API_BASE}/guidebook/${guidebookId}`;
    // Only add cache-busting parameter if template was recently changed
    return cacheVersion > 0 ? `${baseUrl}?v=${cacheVersion}` : baseUrl;
  }, [guidebookId, cacheVersion]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!guidebookId) return;
      try {
        if (!supabase) return; // guard for TS: supabase possibly null
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || null;
        const res = await fetch(`${API_BASE}/api/guidebooks/${guidebookId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load guidebook (${res.status})`);
        const json = await res.json();
        if (mounted) setGb(json);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load guidebook";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [guidebookId, router]);

  const selectTemplate = async (template: TemplateKey) => {
    if (!guidebookId) return;
    setSaving(template);
    try {
      const res = await fetch(`${API_BASE}/api/guidebook/${guidebookId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_key: template }),
      });
      if (!res.ok) throw new Error(`Failed to update template (${res.status})`);
      const json = await res.json();
      setGb((prev) => (prev ? { ...prev, template_key: json.template_key as TemplateKey } : prev));
      // Bump cache version to force refresh when viewing live guidebook
      setCacheVersion(Date.now());
    } catch (e: unknown) {
      console.error(e);
      alert("Could not save template. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  const Card = ({ template, title, img }: { template: TemplateKey; title: string; img: string }) => {
    const isSelected = gb?.template_key === template;
    return (
      <div className="group relative border border-[#E5E1DC] rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
        <div className="absolute top-3 right-3">
          {isSelected && (
            <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-300">Selected</span>
          )}
        </div>
        <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
          <img src={img} alt={`${title} preview`} className="object-cover w-full h-full" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-gray-500">Choose this template for your live guidebook</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => selectTemplate(template)}
              disabled={saving !== null}
            >
              {saving === template ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size={16} colorClass="text-[oklch(0.6923_0.22_21.05)]" />
                  Saving…
                </span>
              ) : isSelected ? "Re-select" : "Select"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <h1 className="text-3xl font-bold text-gray-800">Guidebook Templates</h1>
            <p className="text-gray-600 mt-1">Choose how your live guidebook looks</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
            {liveGuidebookUrl && (
              <Link href={liveGuidebookUrl} target="_blank"><Button variant="outline">View Live Guidebook</Button></Link>
            )}
          </div>
        </div>

        {loading && (
          <div className="p-6 text-gray-700 flex items-center gap-3">
            <Spinner size={20} colorClass="text-[oklch(0.6923_0.22_21.05)]" />
            <span>Loading…</span>
          </div>
        )}
        {!loading && error && (
          <div className="p-6 text-red-600">{error}</div>
        )}

        {!loading && !error && (
          <section>
            {/* Responsive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card template="template_original" title="Lifestyle (Standard)" img="/images/URL_Generic1.png" />
              <Card template="template_generic" title="Minimal (Basic)" img="/images/URL_Generic2.png" />
              <Card template="template_modern" title="Modern Cards" img="/images/URL_Modern.jpg" />
              <Card template="template_welcomebook" title="Welcome Book" img="/images/URL_WelcomeBook.jpg" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
