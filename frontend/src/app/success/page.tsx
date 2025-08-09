"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(() => import('@/components/custom/PdfViewer'), { 
  ssr: false 
});

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export default function SuccessPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [liveGuidebookUrl, setLiveGuidebookUrl] = useState<string | null>(null);
  const [guidebookId, setGuidebookId] = useState<string | null>(null);
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  const getTemplateFromPdfUrl = (): 'template_1' | 'template_2' | undefined => {
    if (!pdfUrl) return undefined;
    if (pdfUrl.includes('template=template_2')) return 'template_2';
    if (pdfUrl.includes('template=template_1')) return 'template_1';
    return undefined;
  };

  const getPdfPlaceholder = (templateKey?: 'template_1' | 'template_2') => {
    // Default to Standard placeholder
    if (templateKey === 'template_2') return '/images/PDF_Basic.png';
    return '/images/PDF_Standard.png';
  };

  const getUrlPlaceholder = (templateKey: 'template_1' | 'template_2') => {
    return templateKey === 'template_1' ? '/images/URL_Generic1.png' : '/images/URL_Generic2.png';
  };

  useEffect(() => {
    const liveUrl = sessionStorage.getItem('liveGuidebookUrl');
    setLiveGuidebookUrl(liveUrl);
    const storedId = sessionStorage.getItem('guidebookId');
    if (storedId) setGuidebookId(storedId);
  }, []);

  const handleDownload = (templateKey?: 'template_1' | 'template_2') => {
    // Build a URL that forces download on the server via ?download=1
    if (!guidebookId) return;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const tplParam = templateKey ? `&template=${templateKey}` : '';
    const url = `${apiBase}/api/guidebook/${guidebookId}/pdf?download=1${tplParam}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'guidebook.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buildPdfUrl = async (templateKey?: 'template_1' | 'template_2') => {
    if (!guidebookId) return null;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const tplParam = templateKey ? `?template=${templateKey}` : '';
    const url = `${apiBase}/api/guidebook/${guidebookId}/pdf${tplParam}`;
    setPdfUrl(url);
    return url;
  };

  const PdfCard = ({ label, templateKey }: { label: string; templateKey?: 'template_1' | 'template_2' }) => (
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

  const TemplateCard = ({ label, templateKey }: { label: string; templateKey: 'template_1' | 'template_2' }) => (
    <div className="border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
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
          } catch (e: any) {
            setTemplateMessage(e.message || 'Failed to select template');
          } finally {
            setIsUpdatingTemplate(false);
          }
        }}>Use Template</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800">Success!</h1>
          <p className="text-lg text-gray-600 mt-2">Your guidebook has been generated.</p>
        </div>

        {/* PDF Templates Section */}
        <section className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">PDF Templates</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Preview a compact PDF. Click to open a larger preview.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <PdfCard label="Standard PDF" templateKey="template_1" />
            <PdfCard label="Basic PDF" templateKey="template_2" />
          </div>
        </section>

        {/* URL Templates Section */}
        <section className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-semibold">URL Templates</h2>
            {liveGuidebookUrl && (
              <Link href={liveGuidebookUrl} target="_blank">
                <Button variant="outline">View Live Guidebook</Button>
              </Link>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4">Choose how your public guidebook looks. You can change this anytime.</p>
          {templateMessage && (
            <div className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{templateMessage}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <TemplateCard label="Template 1" templateKey="template_1" />
            <TemplateCard label="Template 2" templateKey="template_2" />
          </div>
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
