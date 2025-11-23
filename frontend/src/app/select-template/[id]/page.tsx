/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

export default function SelectTemplatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const guidebookId = params?.id;

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<'template_original' | 'template_generic' | 'template_welcomebook'>('template_original');
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [urlCarouselEl, setUrlCarouselEl] = useState<HTMLDivElement | null>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!urlCarouselEl) return;
    const scrollAmount = 320;
    const newScrollLeft = direction === 'left'
      ? urlCarouselEl.scrollLeft - scrollAmount
      : urlCarouselEl.scrollLeft + scrollAmount;
    urlCarouselEl.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  const getUrlPlaceholder = (templateKey: 'template_original' | 'template_generic' | 'template_welcomebook') => {
    if (templateKey === 'template_welcomebook') return '/images/URL_Welcoming_WhiteHouse.png';
    return templateKey === 'template_original' ? '/images/URL_Classic_WhiteHouse.png' : '/images/URL_Lifestyle_WhiteHouse.png';
  };

  // Store guidebookId in storage for success page
  useEffect(() => {
    if (guidebookId) {
      try {
        sessionStorage.setItem('guidebookId', guidebookId);
        localStorage.setItem('guidebookId', guidebookId);
        // Also store preview URL
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const previewPath = `${apiBase}/preview/${guidebookId}`;
        sessionStorage.setItem('previewGuidebookUrl', previewPath);
        localStorage.setItem('previewGuidebookUrl', previewPath);
      } catch (e) {
        console.error('Failed to store guidebook info:', e);
      }
    }
  }, [guidebookId]);

  // Load current template
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!guidebookId) return;
      try {
        const sess = await supabase?.auth.getSession();
        const tok = sess?.data.session?.access_token || null;
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/guidebooks/${guidebookId}`, {
          headers: tok ? { 'Authorization': `Bearer ${tok}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && (data.template_key === 'template_original' || data.template_key === 'template_generic' || data.template_key === 'template_welcomebook')) {
          setSelectedTemplateKey(data.template_key);
        }
      } catch (e) {
        console.error('Failed to load template:', e);
      }
    };
    fetchTemplate();
  }, [guidebookId]);

  const TemplateCard = ({ label, templateKey }: { label: string; templateKey: 'template_original' | 'template_generic' | 'template_welcomebook' }) => {
    const isSelected = selectedTemplateKey === templateKey;
    const displayName = templateKey === 'template_original' ? 'Guidewise Classic' : templateKey === 'template_welcomebook' ? 'Welcoming' : 'Lifestyle';

    return (
      <div className={`relative rounded-xl p-4 bg-white shadow hover:shadow-lg transition border ${isSelected ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-gray-200'}`}>
        {isSelected && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-2.59a.75.75 0 10-1.22-.86l-4.053 5.75-2.154-2.154a.75.75 0 10-1.06 1.06l2.75 2.75a.75.75 0 001.153-.094l4.644-6.452z" clipRule="evenodd" />
            </svg>
            Selected
          </div>
        )}
        <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
          <img
            src={getUrlPlaceholder(templateKey)}
            alt={`${label} thumbnail`}
            className="object-contain w-full h-full"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-700 font-medium">{displayName}</p>
          <Button
            size="sm"
            disabled={!guidebookId || isUpdatingTemplate}
            onClick={async () => {
              if (!guidebookId) return;
              setIsUpdatingTemplate(true);
              setTemplateMessage(null);
              try {
                const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
                const url = `${apiBase}/api/guidebook/${guidebookId}/template`;
                const sess = await supabase?.auth.getSession();
                const tok = sess?.data.session?.access_token || null;
                const res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(tok ? { 'Authorization': `Bearer ${tok}` } : {}) },
                  body: JSON.stringify({ template_key: templateKey })
                });
                if (!res.ok) throw new Error('Failed to set template');
                setTemplateMessage(`${displayName} template selected!`);
                setSelectedTemplateKey(templateKey);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Failed to select template';
                setTemplateMessage(msg);
              } finally {
                setIsUpdatingTemplate(false);
              }
            }}
          >
            {isSelected ? 'Re‑select' : 'Select'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Choose Your Guidebook Template
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select a template for your live guidebook. You can change this anytime from your dashboard.
          </p>
        </div>

        {/* Template Message */}
        {templateMessage && (
          <div className="w-full max-w-3xl mx-auto rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 text-center">
            {templateMessage}
          </div>
        )}

        {/* URL Templates Section */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-semibold mb-6">Live Guidebook Templates</h2>

          {/* Horizontal Carousel */}
          <div className="relative">
            {/* Left Arrow */}
            <button
              onClick={() => scrollCarousel('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Scroll left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Scrollable Container */}
            <div
              ref={setUrlCarouselEl}
              className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-8"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="flex-shrink-0 w-[300px] snap-start">
                <TemplateCard label="Guidewise Classic" templateKey="template_original" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <TemplateCard label="Lifestyle" templateKey="template_generic" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <TemplateCard label="Welcoming" templateKey="template_welcomebook" />
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => scrollCarousel('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Scroll right"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </section>

        {/* Continue Button */}
        <div className="flex justify-center pt-6">
          <Button
            onClick={() => router.push('/success')}
            className="px-8 py-6 text-lg bg-[oklch(0.6923_0.22_21.05)] hover:opacity-90"
            size="lg"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
