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
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);
  const [includeQrInPdf, setIncludeQrInPdf] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  // removed unused editUrl state
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [guidebookLimit, setGuidebookLimit] = useState<number>(0);
  const [activeGuidebooksCount, setActiveGuidebooksCount] = useState<number>(0);
  const [isPdfSectionExpanded, setIsPdfSectionExpanded] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [justActivated, setJustActivated] = useState<boolean>(false);

  // Carousel state
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
            setGuidebookLimit(prof?.guidebook_limit || 0);

            // Fetch count of active guidebooks
            const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
            try {
              const countRes = await fetch(`${apiBase}/api/guidebooks`, {
                headers: tok ? { 'Authorization': `Bearer ${tok}` } : undefined,
              });
              if (countRes.ok) {
                const guidebooks = await countRes.json();
                const activeCount = guidebooks.filter((gb: { active: boolean }) => gb.active).length;
                setActiveGuidebooksCount(activeCount);
              }
            } catch {}
          }
        } catch {}
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/guidebooks/${guidebookId}`, {
          headers: tok ? { 'Authorization': `Bearer ${tok}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();

        // Set active status
        if (typeof data?.active === 'boolean') {
          setIsActive(data.active);

          // If active, compute live URL
          if (data.active && data.public_slug) {
            const live = `${apiBase}/g/${data.public_slug}`;
            setLiveGuidebookUrl(live);
            try {
              sessionStorage.setItem('liveGuidebookUrl', live);
              localStorage.setItem('liveGuidebookUrl', live);
            } catch {}
          } else {
            // If not active, clear any old live URL and ensure preview URL is set
            setLiveGuidebookUrl(null);
            const preview = `${apiBase}/preview/${guidebookId}`;
            setPreviewUrl(preview);
            try {
              sessionStorage.removeItem('liveGuidebookUrl');
              localStorage.removeItem('liveGuidebookUrl');
              sessionStorage.setItem('previewGuidebookUrl', preview);
              localStorage.setItem('previewGuidebookUrl', preview);
            } catch {}
          }
        }
      } catch {}
    };
    fetchTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidebookId]);

  const handleActivateGuidebook = async () => {
    if (!guidebookId || !accessToken) return;
    setIsActivating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBase}/api/guidebooks/${guidebookId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      console.log('Toggle response status:', res.status);
      console.log('Toggle response headers:', res.headers);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to activate guidebook');
      }

      const responseText = await res.text();
      console.log('Raw response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response from server');
      }

      console.log('Parsed activation response:', data);

      // Verify activation was successful - check if active is true
      if (data.active === true) {
        // Update state
        setIsActive(true);
        setJustActivated(true);
        setActiveGuidebooksCount(prev => prev + 1);

        // Set live URL using the public slug if available
        if (data.public_slug) {
          const live = `${apiBase}/g/${data.public_slug}`;
          console.log('Setting live URL to:', live);
          setLiveGuidebookUrl(live);

          try {
            sessionStorage.setItem('liveGuidebookUrl', live);
            localStorage.setItem('liveGuidebookUrl', live);
          } catch {}
        } else {
          console.warn('No public_slug in activation response, will use preview URL');
        }

        // Wait a moment for backend to commit, then refetch to get slug if needed
        setTimeout(() => {
          fetch(`${apiBase}/api/guidebooks/${guidebookId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }).then(r => r.json()).then(gb => {
            console.log('Refetched guidebook after activation:', gb);
            if (!gb.active) {
              console.warn('Guidebook still showing as inactive after toggle');
            } else if (gb.public_slug && !liveGuidebookUrl) {
              // If we didn't get the slug initially, set it now
              const live = `${apiBase}/g/${gb.public_slug}`;
              setLiveGuidebookUrl(live);
              try {
                sessionStorage.setItem('liveGuidebookUrl', live);
                localStorage.setItem('liveGuidebookUrl', live);
              } catch {}
            }
          }).catch(e => console.error('Failed to refetch guidebook:', e));
        }, 1000);
      } else {
        console.error('Activation failed. Response:', data);
        throw new Error(`Activation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Failed to activate guidebook:', e);
      alert('Failed to activate guidebook. Please try again.');
      setIsActivating(false);
      return;
    }

    setIsActivating(false);
  };

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

        {/* Activation status message */}
        {justActivated ? (
          <div className="w-full max-w-3xl mx-auto rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-white text-emerald-900 p-6 md:p-8 shadow-md text-center">
            <h3 className="text-xl md:text-2xl font-semibold">Guidebook is now active!</h3>
            <p className="mt-2 text-sm md:text-base text-emerald-800">
              Your guidebook has been activated and is ready to share with guests.
            </p>
          </div>
        ) : !isActive && (
          <div className="w-full max-w-3xl mx-auto rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white text-amber-900 p-6 md:p-8 shadow-md text-center">
            <h3 className="text-xl md:text-2xl font-semibold">Your guidebook is saved as a draft</h3>
            <p className="mt-2 text-sm md:text-base text-amber-800">
              {activeGuidebooksCount < guidebookLimit ? (
                <>You have {guidebookLimit - activeGuidebooksCount} open slot(s). Click below to activate this guidebook.</>
              ) : (
                <>You&apos;ve reached your guidebook limit ({guidebookLimit}). <Link href="/pricing" className="underline font-semibold hover:text-amber-900">Upgrade your plan</Link> or deactivate an existing guidebook to activate this one.</>
              )}
            </p>
            {activeGuidebooksCount < guidebookLimit && (
              <div className="mt-4">
                <Button
                  onClick={handleActivateGuidebook}
                  disabled={isActivating}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  {isActivating ? 'Activating...' : 'Activate Guidebook'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Preview Section - Always shown */}
        {(previewUrl || guidebookId) && (
          <section className="bg-white rounded-2xl shadow p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold mb-2">{isActive ? 'Your Guidebook' : 'Preview Your Guidebook'}</h2>
              <p className="text-gray-600">
                {isActive
                  ? 'Your live guidebook is ready to share with guests.'
                  : 'See how your guidebook looks—click around and navigate sections to experience it as your guests will.'}
              </p>
            </div>
            <div className="w-full">
              <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-gray-300 bg-gray-100 p-2">
                <div className="rounded-xl overflow-hidden bg-white shadow-inner">
                  <iframe
                    key={isActive && liveGuidebookUrl ? 'live' : 'preview'}
                    src={
                      isActive && liveGuidebookUrl
                        ? liveGuidebookUrl
                        : (previewUrl || `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/preview/${guidebookId}`)
                    }
                    title="Guidebook Preview"
                    className="w-full h-[700px] lg:h-[800px]"
                    style={{ border: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Action buttons below iframe */}
            <div className="flex gap-3 items-center flex-wrap justify-center mt-6">
              {guidebookId && (
                <Link href={`/edit/${guidebookId}`}>
                  <Button className="px-6 py-3 rounded-lg">Continue Editing</Button>
                </Link>
              )}
              <Link href="/dashboard">
                <Button variant="default" className="px-6 py-3 rounded-lg">Go to Dashboard</Button>
              </Link>
            </div>
          </section>
        )}

        {/* QR Code Section - For mobile access */}
        {guidebookId && (
          <section className="bg-white rounded-2xl shadow p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold mb-2">QR Code for Mobile Access</h2>
              <p className="text-gray-600">Print and place in your rental—guests can scan with their phone to view the guidebook on mobile.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* QR Code Display */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                  <img
                    key={isActive && liveGuidebookUrl ? 'live-qr' : 'preview-qr'}
                    src={getQrImageUrl(
                      isActive && liveGuidebookUrl
                        ? liveGuidebookUrl
                        : (previewUrl || `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/preview/${guidebookId}`),
                      400
                    )}
                    alt="Guidebook QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <Button
                  className="mt-4"
                  onClick={() => {
                    const qrUrl = isActive && liveGuidebookUrl
                      ? liveGuidebookUrl
                      : (previewUrl || `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/preview/${guidebookId}`);
                    const link = document.createElement('a');
                    link.href = getQrImageUrl(qrUrl, 800);
                    link.download = 'guidebook-qr.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  Download QR Code
                </Button>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Perfect for your short-term rental</h3>
                <ul className="text-gray-600 space-y-3">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Place near the entrance, on the fridge, or in a welcome binder</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Guests scan with their phone camera—no app needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Opens your guidebook optimized for mobile viewing</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

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
            <Link href="/onboarding"><Button variant="outline">Create Another Guidebook</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
