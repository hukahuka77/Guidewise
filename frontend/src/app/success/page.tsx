/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import QRDownloadButton from '@/components/custom/QRDownloadButton';

export default function SuccessPage() {
  const [liveGuidebookUrl, setLiveGuidebookUrl] = useState<string | null>(null);
  const [guidebookId, setGuidebookId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [guidebookLimit, setGuidebookLimit] = useState<number>(0);
  const [activeGuidebooksCount, setActiveGuidebooksCount] = useState<number>(0);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [justActivated, setJustActivated] = useState<boolean>(false);

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
          } catch { }
          // Clean the hash to avoid re-processing
          try { window.history.replaceState(null, '', window.location.pathname); } catch { }
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
        try { localStorage.setItem('previewGuidebookUrl', storedPreview); } catch { }
      }
      const storedId = sessionStorage.getItem('guidebookId') || localStorage.getItem('guidebookId');
      if (storedId) {
        setGuidebookId(storedId);
        localStorage.setItem('guidebookId', storedId);
      }
    } catch { }
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
            } catch { }
          }
        } catch { }
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
            } catch { }
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
            } catch { }
          }
        }
      } catch { }
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
          } catch { }
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
              } catch { }
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
                  : 'See how your guidebook looks. Click around and navigate sections to experience it as your guests will.'}
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
              <p className="text-gray-600">Print and place in your rental. Guests can scan with their phone to view the guidebook on mobile.</p>
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
                <QRDownloadButton
                  targetUrl={
                    isActive && liveGuidebookUrl
                      ? liveGuidebookUrl
                      : (previewUrl || `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/preview/${guidebookId}`)
                  }
                  propertyName="guidebook"
                  className="mt-4"
                />
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
                    <span>Guests scan with their phone camera. No app needed</span>
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
