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

  useEffect(() => {
    const pdfUrl = sessionStorage.getItem('guidebookUrl');
    setDownloadUrl(pdfUrl);

    const liveUrl = sessionStorage.getItem('liveGuidebookUrl');
    setLiveGuidebookUrl(liveUrl);
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl w-full bg-white p-8 rounded-xl shadow-lg space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800">Success!</h1>
          <p className="text-lg text-gray-600 mt-2">Your guidebook has been generated.</p>
        </div>

        {downloadUrl ? (
          <>
            <div className="space-y-4">
              <PdfViewer fileUrl={downloadUrl} />
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <Button
                onClick={handleDownload}
                className="bg-primary text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-primary/90 transition-transform transform hover:scale-105"
              >
                Download PDF
              </Button>
              {liveGuidebookUrl && (
                <Link href={liveGuidebookUrl} passHref target="_blank">
                  <Button
                    variant="outline"
                    className="font-bold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
                  >
                    View Live Guidebook
                  </Button>
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="text-center">
            <p className="text-gray-600 mb-4">No guidebook URL found. You can create a new one.</p>
            <Link href="/create">
              <Button variant="outline">Create Another Guidebook</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
