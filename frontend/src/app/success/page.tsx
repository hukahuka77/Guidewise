/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import QRDownloadButton from '@/components/custom/QRDownloadButton';
import { absoluteUrl } from '@/lib/publicUrl';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Shown after a new guidebook is created and its template chosen. The guidebook is already live.
export default function SuccessPage() {
  const [guidebookId, setGuidebookId] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      setGuidebookId(sessionStorage.getItem('guidebookId') || localStorage.getItem('guidebookId'));
    } catch { }
  }, []);

  useEffect(() => {
    if (!guidebookId) return;
    (async () => {
      try {
        const token = (await supabase?.auth.getSession())?.data.session?.access_token || null;
        const res = await fetch(`${API_BASE}/api/guidebooks/${guidebookId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.public_slug) setLiveUrl(absoluteUrl(`/g/${data.public_slug}`));
      } catch { }
    })();
  }, [guidebookId]);

  const qrImageUrl = (url: string, size = 400) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-6xl space-y-8">
        {guidebookId && (
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800">Your guidebook is live!</h1>
            <p className="text-lg text-gray-600 mt-2">It is ready to share with your guests.</p>
          </div>
        )}

        {liveUrl && (
          <section className="bg-white rounded-2xl shadow p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold mb-2">Your Guidebook</h2>
              <p className="text-gray-600">Click around to experience it as your guests will.</p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-gray-300 bg-gray-100 p-2">
              <div className="rounded-xl overflow-hidden bg-white shadow-inner">
                <iframe src={liveUrl} title="Your guidebook" className="w-full h-[700px] lg:h-[800px]" style={{ border: 'none' }} />
              </div>
            </div>
            <div className="flex gap-3 items-center flex-wrap justify-center mt-6">
              {guidebookId && (
                <Link href={`/edit/${guidebookId}`}>
                  <Button variant="outline" className="px-6 py-3 rounded-lg border border-pink-200 text-pink-700 bg-white hover:bg-pink-50">
                    Continue Editing
                  </Button>
                </Link>
              )}
              <Link href="/dashboard">
                <Button className="px-6 py-3 rounded-lg">Go to Dashboard</Button>
              </Link>
            </div>
          </section>
        )}

        {liveUrl && (
          <section className="bg-white rounded-2xl shadow p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold mb-2">QR Code for Mobile Access</h2>
              <p className="text-gray-600">Print it and place it in your rental. Guests scan it with their phone camera. No app needed.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                <img src={qrImageUrl(liveUrl)} alt="Guidebook QR Code" className="w-64 h-64" />
              </div>
              <QRDownloadButton targetUrl={liveUrl} propertyName="guidebook" className="mt-4" />
            </div>
          </section>
        )}

        {!guidebookId && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No guidebook found in this session.</p>
            <Link href="/onboarding"><Button variant="outline">Create a guidebook</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
