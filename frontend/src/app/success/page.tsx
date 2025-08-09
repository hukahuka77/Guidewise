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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [liveGuidebookUrl, setLiveGuidebookUrl] = useState<string | null>(null);
  const [guidebookId, setGuidebookId] = useState<string | null>(null);
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  useEffect(() => {
    const pdfUrl = sessionStorage.getItem('guidebookUrl');
    setDownloadUrl(pdfUrl);

    const liveUrl = sessionStorage.getItem('liveGuidebookUrl');
    setLiveGuidebookUrl(liveUrl);
    if (liveUrl) {
      const match = liveUrl.match(/\/guidebook\/([^/?#]+)/);
      if (match && match[1]) setGuidebookId(match[1]);
    }
  }, []);

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'guidebook.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const PdfCard = () => (
    <div className="group relative border rounded-xl p-4 bg-white shadow hover:shadow-lg transition cursor-pointer" onClick={() => setPdfModalOpen(true)}>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        {downloadUrl ? (
          <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full h-full">
              <PdfViewer fileUrl={downloadUrl} />
            </div>
          </div>
        ) : (
          <div className="text-gray-400">No PDF</div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Standard PDF</h3>
          <p className="text-sm text-gray-500">Click to preview larger</p>
        </div>
        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>Download</Button>
      </div>
    </div>
  );

  const TemplateCard = ({ label, templateKey }: { label: string; templateKey: 'template_1' | 'template_2' }) => (
    <div className="border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <span className="text-gray-600 font-medium">{label}</span>
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
            {downloadUrl && (
              <Button onClick={handleDownload}>Download PDF</Button>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4">Preview a compact PDF. Click to open a larger preview.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <PdfCard />
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
            <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] max-w-5xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-semibold">PDF Preview</h3>
                <div className="flex gap-2">
                  {downloadUrl && <Button size="sm" onClick={handleDownload}>Download</Button>}
                  <Button size="sm" variant="outline" onClick={() => setPdfModalOpen(false)}>Close</Button>
                </div>
              </div>
              <div className="w-full h-full">
                {downloadUrl ? (
                  <PdfViewer fileUrl={downloadUrl} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">No PDF available</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fallback when nothing in storage */}
        {!downloadUrl && !liveGuidebookUrl && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No guidebook found in this session.</p>
            <Link href="/create"><Button variant="outline">Create Another Guidebook</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
