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
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<'template_original' | 'template_generic' | null>('template_original');
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [includeQrInPdf, setIncludeQrInPdf] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  // removed unused editUrl state
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<'free'|'pro'|''>('');

  // removed unused derived flag isEditPath

  // no-op: claim tokens removed

  const getTemplateFromPdfUrl = (): 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile' | undefined => {
    if (!pdfUrl) return undefined;
    if (pdfUrl.includes('template=template_pdf_basic')) return 'template_pdf_basic';
    if (pdfUrl.includes('template=template_pdf_original')) return 'template_pdf_original';
    if (pdfUrl.includes('template=template_pdf_mobile')) return 'template_pdf_mobile';
    return undefined;
  };

  const getPdfPlaceholder = (templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile') => {
    // Default to Standard placeholder
    if (templateKey === 'template_pdf_basic') return '/images/PDF_Basic.png';
    if (templateKey === 'template_pdf_mobile') return '/images/PDF_Mobile.png';
    return '/images/PDF_Standard.png';
  };

  const getUrlPlaceholder = (templateKey: 'template_original' | 'template_generic') => {
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
        // Load access token once (guard supabase)
        if (!accessToken) {
          const sess = await supabase?.auth.getSession();
          const tok = sess?.data.session?.access_token || null;
          setAccessToken(tok);
        }
        // Load plan for Upgrade CTA
        try {
          if (!supabase) throw new Error('Supabase client not initialized');
          const { data: userData } = await supabase.auth.getUser();
          const user = userData?.user;
          if (user) {
            const { data: prof } = await (supabase
              .from('profiles')
              .select('plan')
              .eq('user_id', user.id)
              .single());
            const p = (prof?.plan as 'free'|'pro'|undefined) || 'free';
            setPlan(p);
          }
        } catch {}
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/guidebooks/${guidebookId}`, {
          headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && (data.template_key === 'template_original' || data.template_key === 'template_generic')) {
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
  }, [guidebookId, accessToken]);

  const getQrTargetUrl = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (liveGuidebookUrl) return liveGuidebookUrl;
    if (guidebookId) return `${apiBase}/guidebook/${guidebookId}`;
    return null;
  };

  const handleDownload = (templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile') => {
    // Build a URL that forces download on the server via ?download=1
    if (!guidebookId) return;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const tplParam = templateKey ? `&template=${templateKey}` : '';
    const qr = includeQrInPdf ? getQrTargetUrl() : null;
    const qrParams = qr ? `&include_qr=1&qr_url=${encodeURIComponent(qr)}` : '';
    const url = `${apiBase}/api/guidebook/${guidebookId}/pdf?download=1${tplParam}${qrParams}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'guidebook.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buildPdfUrl = async (templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile') => {
    if (!guidebookId) return null;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const hasTemplate = Boolean(templateKey);
    const tplParam = templateKey ? `?template=${templateKey}` : '';
    const qr = includeQrInPdf ? getQrTargetUrl() : null;
    const qrParams = qr ? `${hasTemplate ? '&' : '?'}include_qr=1&qr_url=${encodeURIComponent(qr)}` : '';
    const url = `${apiBase}/api/guidebook/${guidebookId}/pdf${tplParam}${qrParams}`;
    setPdfUrl(url);
    return url;
  };

  // remove: claim flow

  const PdfCard = ({ label, templateKey }: { label: string; templateKey?: 'template_pdf_original' | 'template_pdf_basic' | 'template_pdf_mobile' }) => (
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

  const TemplateCard = ({ label, templateKey }: { label: string; templateKey: 'template_original' | 'template_generic' }) => {
    const isSelected = selectedTemplateKey === templateKey;
    const displayName = templateKey === 'template_original' ? 'Original' : 'Generic';
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
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F5F1] to-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800">Success!</h1>
          <p className="text-lg text-gray-600 mt-2">Your guidebook has been generated.</p>
        </div>
        {plan !== 'pro' && (
          <div className="bg-white rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-gray-700 text-center sm:text-left">
              <div className="font-semibold">Upgrade to Pro to activate and share your guidebook</div>
              <div className="text-sm text-gray-500">Pro automatically activates all your guidebooks and unlocks billing management.</div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <TemplateCard label="Template 1" templateKey="template_original" />
            <TemplateCard label="Template 2" templateKey="template_generic" />
          </div>
        </section>

        {/* Live Guidebook CTA + QR if active; otherwise show edit/dashboard CTAs */}
        {(isActive && liveGuidebookUrl) ? (
          <div className="w-full flex flex-col items-center justify-center gap-6 md:gap-8">
            <Link href={liveGuidebookUrl} target="_blank">
              <Button variant="default" className="text-2xl md:text-3xl px-12 md:px-16 py-9 md:py-12 rounded-2xl font-semibold shadow">
                View Live Guidebook
              </Button>
            </Link>
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 items-start gap-6 md:gap-10">
              {/* Words/description (left) */}
              <div className="px-2 md:px-4">
                <h4 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">Share with every guest</h4>
                <p className="text-gray-600 mb-3">Print the QR and place it by the entry, fridge, or welcome binder. Guests scan to open your live guidebook instantly.</p>
                <ul className="text-gray-600 list-disc list-inside space-y-1">
                  <li>Reduce repeat questions</li>
                  <li>Keep info up to date in one place</li>
                  <li>Works on any phone camera</li>
                </ul>
              </div>
              {/* QR card (right) */}
              <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow p-4 md:p-5 flex flex-col items-center gap-4 justify-self-center">
                <img
                  src={getQrImageUrl(liveGuidebookUrl, 300)}
                  alt="Guidebook QR code"
                  className="w-[260px] h-[260px] border rounded-xl p-3 bg-white"
                />
                <Button
                  variant="default"
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
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center gap-6 md:gap-8">
            {previewUrl && (
              <Link href={previewUrl} target="_blank">
                <Button variant="default" className="text-2xl md:text-3xl px-12 md:px-16 py-9 md:py-12 rounded-2xl font-semibold shadow">
                  View Preview
                </Button>
              </Link>
            )}
            <div className="w-full max-w-3xl rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white text-amber-900 p-5 md:p-6 shadow-md">
              <h3 className="text-xl md:text-2xl font-semibold">Your guidebook is saved as a draft</h3>
              <p className="mt-1 text-sm md:text-base text-amber-800">Publish from the Edit page to make it live and get a shareable URL.</p>
            </div>
            <div className="flex gap-3 items-center flex-wrap justify-center">
              {guidebookId && (
                <Link href={`/edit/${guidebookId}`}>
                  <Button className="px-6 py-6 rounded-xl text-lg">Continue Editing</Button>
                </Link>
              )}
              <Link href="/dashboard">
                <Button variant="outline" className="px-6 py-6 rounded-xl text-lg">Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Center-dot divider and explainer for PDF option */}
        <div className="w-full py-6">
          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-300 flex-1"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
            <div className="h-px bg-gray-300 flex-1"></div>
          </div>
        </div>
        <div className="text-center max-w-3xl mx-auto mb-2">
          <h3 className="text-lg md:text-xl font-semibold text-gray-800">Prefer a printable PDF?</h3>
          <p className="text-gray-600">If you don’t want to use a digital guidebook or you’d like a PDF instead, explore our templates below.</p>
        </div>

        {/* PDF Templates Section */}
        <section className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">PDF Templates</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={includeQrInPdf}
                onChange={(e) => setIncludeQrInPdf(e.target.checked)}
              />
              Include Scannable QR Code
            </label>
          </div>
          <p className="text-sm text-gray-500 mb-4">Preview a compact PDF. Click to open a larger preview.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <PdfCard label="Basic PDF" templateKey="template_pdf_basic" />
            <PdfCard label="Standard PDF" templateKey="template_pdf_original" />
            <PdfCard label="Mobile PDF" templateKey="template_pdf_mobile" />
          </div>
        </section>

        {/* Removed old QR container section in favor of above inline layout */}

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
