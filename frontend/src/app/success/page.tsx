/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { startStripeCheckout } from '@/lib/billing';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
// No auth/claim needed here anymore

const PdfViewer = dynamic(() => import('@/components/custom/PdfViewer'), { 
  ssr: false 
});

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export default function SuccessPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [liveGuidebookUrl, setLiveGuidebookUrl] = useState<string | null>(null);
  const [guidebookId, setGuidebookId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<'template_original' | 'template_generic' | 'template_modern' | 'template_welcomebook' | null>('template_original');
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [includeQrInPdf, setIncludeQrInPdf] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  // removed unused editUrl state
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<'free'|'trial'|'starter'|'growth'|'pro'|''>('');
  const [guidebookLimit, setGuidebookLimit] = useState<number>(0);
  const [isPdfSectionExpanded, setIsPdfSectionExpanded] = useState<boolean>(false);

  // Carousel state
  const [urlCarouselEl, setUrlCarouselEl] = useState<HTMLDivElement | null>(null);
  const [pdfCarouselEl, setPdfCarouselEl] = useState<HTMLDivElement | null>(null);

  const scrollCarousel = (direction: 'left' | 'right', carouselEl: HTMLDivElement | null) => {
    if (!carouselEl) return;
    const scrollAmount = 320; // Approximate card width + gap
    const newScrollLeft = direction === 'left'
      ? carouselEl.scrollLeft - scrollAmount
      : carouselEl.scrollLeft + scrollAmount;
    carouselEl.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  // removed unused derived flag isEditPath

  // no-op: claim tokens removed

  const getTemplateFromPdfUrl = (): 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile' | 'template_pdf_qr' | 'template_pdf_modern' | undefined => {
    if (!pdfUrl) return undefined;
    if (pdfUrl.includes('template=template_pdf_basic')) return 'template_pdf_basic';
    if (pdfUrl.includes('template=template_pdf_original')) return 'template_pdf_original';
    if (pdfUrl.includes('template=template_pdf_mobile')) return 'template_pdf_mobile';
    if (pdfUrl.includes('template=template_pdf_qr')) return 'template_pdf_qr';
    if (pdfUrl.includes('template=template_pdf_modern')) return 'template_pdf_modern';
    return undefined;
  };

  const getPdfPlaceholder = (templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile' | 'template_pdf_qr' | 'template_pdf_modern') => {
    // Default to Standard placeholder
    if (templateKey === 'template_pdf_basic') return '/images/PDF_Basic.png';
    if (templateKey === 'template_pdf_mobile') return '/images/PDF_Mobile.png';
    if (templateKey === 'template_pdf_qr') return '/images/PDF_QR.png';
    if (templateKey === 'template_pdf_modern') return '/images/PDF_Modern.png';
    return '/images/PDF_Standard.png';
  };

  const getUrlPlaceholder = (templateKey: 'template_original' | 'template_generic' | 'template_modern' | 'template_welcomebook') => {
    if (templateKey === 'template_modern') return '/images/URL_Modern.jpg';
    if (templateKey === 'template_welcomebook') return '/images/URL_WelcomeBook.jpg';
    return templateKey === 'template_original' ? '/images/URL_Generic1.png' : '/images/URL_Generic2.png';
  };

  // Build a QR image URL for the live guidebook link (no extra deps)
  const getQrImageUrl = (url: string, size: number = 300) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  useEffect(() => {
    try {
      // If arriving from email/OAuth redirect, the signup/login flow may have attached a hash with gb/token
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const gb = params.get('gb');
        const token = params.get('token');
        if (gb && token) {
          const previewPath = `/preview/${gb}?token=${encodeURIComponent(token)}`;
          setGuidebookId(gb);
          setLiveGuidebookUrl(previewPath);
          try {
            sessionStorage.setItem('guidebookId', gb);
            sessionStorage.setItem('liveGuidebookUrl', previewPath);
            localStorage.setItem('guidebookId', gb);
            localStorage.setItem('liveGuidebookUrl', previewPath);
          } catch {}
          // Clean the hash to avoid re-processing
          try { window.history.replaceState(null, '', window.location.pathname); } catch {}
        }
      }
      const liveUrl = sessionStorage.getItem('liveGuidebookUrl') || localStorage.getItem('liveGuidebookUrl');
      if (liveUrl) {
        setLiveGuidebookUrl(liveUrl);
        // Mirror to localStorage to survive email redirect/new tab
        localStorage.setItem('liveGuidebookUrl', liveUrl);
      }
      const storedPreview = sessionStorage.getItem('previewGuidebookUrl') || localStorage.getItem('previewGuidebookUrl');
      if (storedPreview) {
        setPreviewUrl(storedPreview);
        try { localStorage.setItem('previewGuidebookUrl', storedPreview); } catch {}
      }
      const storedId = sessionStorage.getItem('guidebookId') || localStorage.getItem('guidebookId');
      if (storedId) {
        setGuidebookId(storedId);
        localStorage.setItem('guidebookId', storedId);
      }
    } catch {}
  }, []);

  // remove: no auth/claim flow

  // Load guidebook info: template and active/public status
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!guidebookId) return;
      try {
        // Always load a fresh access token for this request
        const sess = await supabase?.auth.getSession();
        const tok = sess?.data.session?.access_token || null;
        if (tok !== accessToken) setAccessToken(tok || null);
        // Load plan and guidebook limits for Upgrade CTA
        try {
          if (!supabase) throw new Error('Supabase client not initialized');
          const { data: userData } = await supabase.auth.getUser();
          const user = userData?.user;
          if (user) {
            const { data: prof } = await (supabase
              .from('profiles')
              .select('plan, guidebook_limit')
              .eq('user_id', user.id)
              .single());
            const p = (prof?.plan as 'free'|'trial'|'starter'|'growth'|'pro'|undefined) || 'free';
            setPlan(p);
            setGuidebookLimit(prof?.guidebook_limit || 0);
          }
        } catch {}
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/guidebooks/${guidebookId}`, {
          headers: tok ? { 'Authorization': `Bearer ${tok}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && (data.template_key === 'template_original' || data.template_key === 'template_generic' || data.template_key === 'template_modern' || data.template_key === 'template_welcomebook')) {
          setSelectedTemplateKey(data.template_key);
        }
        if (typeof data?.active === 'boolean') {
          setIsActive(data.active);
        }
        // If active and we have a slug/path available, compute live URL
        if (data?.active) {
          const apiBase2 = process.env.NEXT_PUBLIC_API_BASE_URL || '';
          const live = data.public_slug ? `${apiBase2}/g/${data.public_slug}` : `${apiBase2}/guidebook/${guidebookId}`;
          setLiveGuidebookUrl(live);
          try { sessionStorage.setItem('liveGuidebookUrl', live); localStorage.setItem('liveGuidebookUrl', live); } catch {}
        }
      } catch {}
    };
    fetchTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidebookId]);

  const getQrTargetUrl = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (liveGuidebookUrl) return liveGuidebookUrl;
    if (guidebookId) return `${apiBase}/guidebook/${guidebookId}`;
    return null;
  };

  const handleDownload = (templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile' | 'template_pdf_qr' | 'template_pdf_modern') => {
    // Build a URL that forces download on the server via ?download=1
    if (!guidebookId) return;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const tplParam = templateKey ? `&template=${templateKey}` : '';
    const forceQr = templateKey === 'template_pdf_qr';
    const qr = (forceQr || includeQrInPdf) ? getQrTargetUrl() : null;
    const qrParams = qr ? `&include_qr=1&qr_url=${encodeURIComponent(qr)}` : '';
    const url = `${apiBase}/api/guidebook/${guidebookId}/pdf?download=1${tplParam}${qrParams}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'guidebook.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buildPdfUrl = async (templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile' | 'template_pdf_qr' | 'template_pdf_modern') => {
    if (!guidebookId) return null;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const hasTemplate = Boolean(templateKey);
    const tplParam = templateKey ? `?template=${templateKey}` : '';
    const forceQr = templateKey === 'template_pdf_qr';
    const qr = (forceQr || includeQrInPdf) ? getQrTargetUrl() : null;
    const qrParams = qr ? `${hasTemplate ? '&' : '?'}include_qr=1&qr_url=${encodeURIComponent(qr)}` : '';
    const url = `${apiBase}/api/guidebook/${guidebookId}/pdf${tplParam}${qrParams}`;
    setPdfUrl(url);
    return url;
  };

  // remove: claim flow

  const PdfCard = ({ label, templateKey }: { label: string; templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile' | 'template_pdf_qr' | 'template_pdf_modern' }) => (
    <div className="group relative border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
      <div className="aspect-[8.5/11] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        <img
          src={getPdfPlaceholder(templateKey)}
          alt={`${label} placeholder`}
          className="object-contain w-full h-full"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{label}</h3>
          <p className="text-sm text-gray-500">Preview the PDF or download it</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white text-pink-600 border border-pink-500 hover:bg-pink-50"
            onClick={async () => {
              await buildPdfUrl(templateKey);
              setPdfModalOpen(true);
            }}
          >
            Preview
          </Button>
          <Button size="sm" onClick={() => handleDownload(templateKey)} disabled={!guidebookId}>Download</Button>
        </div>
      </div>
    </div>
  );

  const TemplateCard = ({ label, templateKey }: { label: string; templateKey: 'template_original' | 'template_generic' | 'template_modern' | 'template_welcomebook' }) => {
    const isSelected = selectedTemplateKey === templateKey;
    const displayName = templateKey === 'template_original' ? 'Original' : templateKey === 'template_modern' ? 'Modern Cards' : templateKey === 'template_welcomebook' ? 'Welcome Book' : 'Generic';
    return (
    <div className={`relative rounded-xl p-4 bg-white shadow hover:shadow-lg transition border ${isSelected ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-gray-200'}`}>
      {selectedTemplateKey === templateKey && (
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
        <Button size="sm" disabled={!guidebookId || isUpdatingTemplate} onClick={async () => {
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
            setTemplateMessage(`${displayName} template selected. Your live guidebook is ready.`);
            setSelectedTemplateKey(templateKey);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to select template';
            setTemplateMessage(msg);
          } finally {
            setIsUpdatingTemplate(false);
          }
        }}>{isSelected ? 'Re‑select' : 'Select Template'}</Button>
      </div>
    </div>
  ); };

  const showUpgradeCTA = plan === 'free' || plan === 'trial' || plan === '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800">Success!</h1>
          <p className="text-lg text-gray-600 mt-2">
            {isActive ? 'Your guidebook is now live and ready to share!' : 'Your guidebook has been generated.'}
          </p>
        </div>

        {/* Success banner for auto-activated guidebooks */}
        {isActive && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-emerald-800">Automatically Activated</p>
                <p className="text-sm text-emerald-700 mt-0.5">Your guidebook has been published and is ready for guests to access.</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Guidebook CTA - Main action */}
        {(isActive && liveGuidebookUrl) ? (
          <div className="flex justify-center">
            <Link href={liveGuidebookUrl} target="_blank">
              <Button
                variant="default"
                size="lg"
                className="text-2xl px-16 py-8 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              >
                View Live Guidebook
              </Button>
            </Link>
          </div>
        ) : previewUrl && (
          <div className="flex justify-center">
            <Link href={previewUrl} target="_blank">
              <Button
                variant="default"
                size="lg"
                className="text-2xl px-16 py-8 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              >
                View Your Guidebook Preview
              </Button>
            </Link>
          </div>
        )}

        {showUpgradeCTA && (
          <div className="bg-white rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-gray-700 text-center sm:text-left">
              <div className="font-semibold">Upgrade to activate and share your guidebook</div>
              <div className="text-sm text-gray-500">Paid plans automatically activate your guidebooks and unlock billing management.</div>
            </div>
            <Button className="whitespace-nowrap" onClick={() => { void startStripeCheckout(); }}>Upgrade</Button>
          </div>
        )}

        {/* Digital Guidebooks Section (moved first) */}
        <section className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-semibold">Digital Guidebooks</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Choose how your public guidebook looks. You can change this anytime.</p>
          {templateMessage && (
            <div className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{templateMessage}</div>
          )}

          {/* Horizontal Carousel */}
          <div className="relative">
            {/* Left Arrow */}
            <button
              onClick={() => scrollCarousel('left', urlCarouselEl)}
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
                <TemplateCard label="Lifestyle (Standard)" templateKey="template_original" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <TemplateCard label="Minimal (Basic)" templateKey="template_generic" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <TemplateCard label="Modern Cards" templateKey="template_modern" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <TemplateCard label="Welcome Book" templateKey="template_welcomebook" />
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => scrollCarousel('right', urlCarouselEl)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Scroll right"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </section>

        {/* Draft message if not active */}
        {!isActive && (
          <div className="w-full flex flex-col items-center justify-center gap-6 md:gap-8">
            <div className="w-full max-w-3xl rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white text-amber-900 p-6 md:p-8 shadow-md text-center">
              <h3 className="text-xl md:text-2xl font-semibold">Your guidebook is saved as a draft</h3>
              <p className="mt-2 text-sm md:text-base text-amber-800">
                You&apos;ve reached your guidebook limit ({guidebookLimit}). Upgrade your plan or deactivate an existing guidebook to activate this one from the <Link href="/dashboard" className="underline font-semibold">Dashboard</Link>.
              </p>
            </div>
            <div className="flex gap-3 items-center flex-wrap justify-center">
              {guidebookId && (
                <Link href={`/edit/${guidebookId}`}>
                  <Button className="px-6 py-6 rounded-xl text-lg">Continue Editing</Button>
                </Link>
              )}
              <Link href="/dashboard">
                <Button variant="default" className="px-6 py-6 rounded-xl text-lg">Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        )}

        {/* QR Code Section - For physical placement */}
        <section className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-semibold">Printable QR Code</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Print and place around your property so guests can instantly access your guidebook</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* QR Description */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Perfect for physical spaces</h3>
              <ul className="text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Place by the entry, fridge, or welcome binder</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Works with any phone camera - no app needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Download standard QR or full-page poster PDF</span>
                </li>
              </ul>
            </div>

            {/* QR Options */}
            <div className="flex flex-col gap-4">
              {/* Standard QR Download */}
              {(isActive && liveGuidebookUrl) ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">Standard QR Code</h4>
                    <p className="text-sm text-gray-600">PNG image for printing</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = getQrImageUrl(liveGuidebookUrl, 600);
                      link.download = 'guidebook-qr.png';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    Download QR
                  </Button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800">Activate your guidebook to download QR codes</p>
                </div>
              )}

              {/* QR Poster PDF */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-800">QR Poster PDF</h4>
                  <p className="text-sm text-gray-600">Full-page printable poster</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await buildPdfUrl('template_pdf_qr');
                      setPdfModalOpen(true);
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownload('template_pdf_qr')}
                    disabled={!guidebookId}
                  >
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Center-dot divider */}
        <div className="w-full py-6">
          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-300 flex-1"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
            <div className="h-px bg-gray-300 flex-1"></div>
          </div>
        </div>

        {/* PDF Templates Section - Collapsible */}
        <section className="bg-white rounded-2xl shadow p-6">
          <button
            onClick={() => setIsPdfSectionExpanded(!isPdfSectionExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-2xl font-semibold">PDF Templates</h2>
              <p className="text-sm text-gray-500 mt-1">
                {isPdfSectionExpanded ? 'Printable PDF versions of your guidebook' : 'Click to view printable PDF options'}
              </p>
            </div>
            <svg
              className={`w-6 h-6 text-gray-600 transition-transform ${isPdfSectionExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isPdfSectionExpanded && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={includeQrInPdf}
                    onChange={(e) => setIncludeQrInPdf(e.target.checked)}
                  />
                  Include Scannable QR Code in PDFs
                </label>
              </div>
              <p className="text-sm text-gray-500 mb-4">Preview a compact PDF. Click to open a larger preview.</p>

          {/* Horizontal Carousel */}
          <div className="relative">
            {/* Left Arrow */}
            <button
              onClick={() => scrollCarousel('left', pdfCarouselEl)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Scroll left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Scrollable Container */}
            <div
              ref={setPdfCarouselEl}
              className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-8"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="flex-shrink-0 w-[300px] snap-start">
                <PdfCard label="Basic PDF" templateKey="template_pdf_basic" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <PdfCard label="Standard PDF" templateKey="template_pdf_original" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <PdfCard label="Modern PDF" templateKey="template_pdf_modern" />
              </div>
              <div className="flex-shrink-0 w-[300px] snap-start">
                <PdfCard label="Mobile PDF" templateKey="template_pdf_mobile" />
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => scrollCarousel('right', pdfCarouselEl)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Scroll right"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
            </div>
          )}
        </section>

        {/* Modal for PDF large preview */}
        {isPdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPdfModalOpen(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] max-w-5xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-3 border-b shrink-0">
                <h3 className="font-semibold">PDF Preview</h3>
                <div className="flex gap-2">
                  {guidebookId && (
                    <Button size="sm" onClick={() => handleDownload(getTemplateFromPdfUrl())}>Download</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setPdfModalOpen(false)}>Close</Button>
                </div>
              </div>
              <div className="w-full flex-1 min-h-0">
                {pdfUrl ? (
                  <PdfViewer fileUrl={pdfUrl} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">No PDF available</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fallback when nothing in storage */}
        {!guidebookId && !liveGuidebookUrl && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No guidebook found in this session.</p>
            <Link href="/create"><Button variant="outline">Create Another Guidebook</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
