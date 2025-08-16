/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';

const PdfViewer = dynamic(() => import('@/components/custom/PdfViewer'), { 
  ssr: false 
});

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export default function SuccessPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [liveGuidebookUrl, setLiveGuidebookUrl] = useState<string | null>(null);
  const [guidebookId, setGuidebookId] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<'template_original' | 'template_generic' | null>('template_original');
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [includeQrInPdf, setIncludeQrInPdf] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  // Derived flags
  const isPreviewLink = useMemo(() => !!liveGuidebookUrl && liveGuidebookUrl.includes('/preview/'), [liveGuidebookUrl]);
  const claimTokenFromUrl = useMemo(() => {
    try {
      if (!isPreviewLink || !liveGuidebookUrl) return null;
      const u = new URL(liveGuidebookUrl);
      return u.searchParams.get('token');
    } catch { return null; }
  }, [isPreviewLink, liveGuidebookUrl]);

  // Persist claim token for use in auth redirects
  useEffect(() => {
    if (claimTokenFromUrl) {
      try {
        sessionStorage.setItem('claimToken', claimTokenFromUrl);
        localStorage.setItem('claimToken', claimTokenFromUrl);
      } catch {}
    }
  }, [claimTokenFromUrl]);

  const getTemplateFromPdfUrl = (): 'template_pdf_original' | 'template_pdf_basic' | undefined => {
    if (!pdfUrl) return undefined;
    if (pdfUrl.includes('template=template_pdf_basic')) return 'template_pdf_basic';
    if (pdfUrl.includes('template=template_pdf_original')) return 'template_pdf_original';
    return undefined;
  };

  const getPdfPlaceholder = (templateKey?: 'template_pdf_original' | 'template_pdf_basic') => {
    // Default to Standard placeholder
    if (templateKey === 'template_pdf_basic') return '/images/PDF_Basic.png';
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
      const storedId = sessionStorage.getItem('guidebookId') || localStorage.getItem('guidebookId');
      if (storedId) {
        setGuidebookId(storedId);
        localStorage.setItem('guidebookId', storedId);
      }
    } catch {}
  }, []);

  // Load auth token (if user logs in after anonymous creation)
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setAccessToken(data.session?.access_token || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token || null);
    });
    return () => { sub.subscription?.unsubscribe(); mounted = false; };
  }, []);

  // Attempt to load the currently selected URL template for this guidebook
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!guidebookId) return;
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/guidebook/${guidebookId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && (data.template_key === 'template_original' || data.template_key === 'template_generic')) {
          setSelectedTemplateKey(data.template_key);
        }
      } catch {}
    };
    fetchTemplate();
  }, [guidebookId]);

  const getQrTargetUrl = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (liveGuidebookUrl) return liveGuidebookUrl;
    if (guidebookId) return `${apiBase}/guidebook/${guidebookId}`;
    return null;
  };

  const handleDownload = (templateKey?: 'template_pdf_original' | 'template_pdf_basic') => {
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

  const buildPdfUrl = async (templateKey?: 'template_pdf_original' | 'template_pdf_basic') => {
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

  // Attempt auto-claim once authenticated and we have a preview link + token
  useEffect(() => {
    const doClaim = async () => {
      if (!guidebookId || !isPreviewLink || !claimTokenFromUrl || !accessToken) return;
      setIsClaiming(true);
      setClaimError(null);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/guidebook/${guidebookId}/claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ claim_token: claimTokenFromUrl })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to claim (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (data?.live_url) {
          const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
          const full = data.live_url.startsWith('http') ? data.live_url : `${apiBase}${data.live_url}`;
          setLiveGuidebookUrl(full);
          sessionStorage.setItem('liveGuidebookUrl', full);
          try { localStorage.setItem('liveGuidebookUrl', full); } catch {}
          setClaimed(true);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to claim';
        setClaimError(msg);
      } finally {
        setIsClaiming(false);
      }
    };
    doClaim();
  }, [guidebookId, isPreviewLink, claimTokenFromUrl, accessToken]);

  const PdfCard = ({ label, templateKey }: { label: string; templateKey?: 'template_pdf_original' | 'template_pdf_basic' }) => (
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
        <p className="text-sm text-gray-500">Public URL template</p>
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
            setTemplateMessage(`${label} selected. Your live guidebook is ready.`);
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

        {/* Live/Preview CTA + QR */}
        {liveGuidebookUrl && (
          <div className="w-full flex flex-col items-center justify-center gap-6 md:gap-8">
            <Link href={liveGuidebookUrl} target="_blank">
              <Button variant="default" className="text-2xl md:text-3xl px-12 md:px-16 py-9 md:py-12 rounded-2xl font-semibold shadow">
                View Live Guidebook
              </Button>
            </Link>
            {isPreviewLink && (
              <div className="w-full max-w-4xl rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white text-amber-900 p-5 md:p-6 shadow-md">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-amber-500">
                      <path fillRule="evenodd" d="M10.53 2.53a1.5 1.5 0 0 1 2.94 0l8 18A1.5 1.5 0 0 1 20.06 23H3.94a1.5 1.5 0 0 1-1.41-2.47l8-18ZM12 8a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm0 9a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 12 17Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <h3 className="text-xl md:text-2xl font-semibold">This is a temporary preview link</h3>
                        <p className="mt-1 text-sm md:text-base text-amber-800">Sign up or log in to save this guidebook to your account and publish a permanent live URL.</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href="/signup"><Button className="bg-pink-600 hover:bg-pink-700">Sign up to Save</Button></Link>
                        <Link href="/login"><Button variant="outline" className="border-pink-600 text-pink-700 hover:bg-pink-50">Log in</Button></Link>
                      </div>
                    </div>
                    {accessToken && (
                      <div className="mt-3 text-xs md:text-sm text-amber-800">Attempting to save to your account…</div>
                    )}
                    {isClaiming && <div className="mt-2 text-xs md:text-sm">Claiming…</div>}
                    {claimError && <div className="mt-2 text-xs md:text-sm text-red-700">{claimError}</div>}
                    {claimed && <div className="mt-2 text-xs md:text-sm text-emerald-700">Saved! Your permanent link is ready above.</div>}
                  </div>
                </div>
              </div>
            )}
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
            <PdfCard label="Standard PDF" templateKey="template_pdf_original" />
            <PdfCard label="Basic PDF" templateKey="template_pdf_basic" />
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
