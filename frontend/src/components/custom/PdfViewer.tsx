"use client";

import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  fileUrl: string | null;
  showControls?: boolean;
  enforcePdfAspect?: boolean; // when true, keep 8.5x11 aspect in the visible area
}

export default function PdfViewer({ fileUrl, showControls = true, enforcePdfAspect = false }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(600);
  const [boxHeight, setBoxHeight] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
  }

  function onDocumentLoadError(err: any) {
    console.error('PDF load error', err);
    setError('Failed to load PDF preview.');
  }

  function goToPrevPage() {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  }

  function goToNextPage() {
    setPageNumber((prevPageNumber) =>
      numPages ? Math.min(prevPageNumber + 1, numPages) : prevPageNumber
    );
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const updateWidth = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.min(rect.width - 24, 1200); // padding safety
        const finalWidth = Math.max(200, Math.floor(newWidth));
        setPageWidth(finalWidth);
        if (enforcePdfAspect) {
          // US Letter ratio 11 / 8.5 ≈ 1.294; keeps view like a PDF
          const ratio = 11 / 8.5;
          setBoxHeight(Math.round(finalWidth * ratio));
        } else {
          setBoxHeight(undefined);
        }
      };
      updateWidth();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [enforcePdfAspect]);

  useEffect(() => {
    // Reset when file changes
    setNumPages(null);
    setPageNumber(1);
    setError(null);
  }, [fileUrl]);

  if (!fileUrl) return <div className="p-4 text-sm text-gray-600">Loading...</div>;

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-gray-100">
      <div
        className={`flex-1 ${enforcePdfAspect ? 'overflow-hidden' : 'overflow-auto'} flex items-start justify-center p-3`}
        style={enforcePdfAspect && boxHeight ? { height: boxHeight } : undefined}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading="Loading PDF preview..."
        >
          {/* Use responsive width instead of fixed scale so it fits modal height */}
          <Page pageNumber={pageNumber} width={pageWidth} renderAnnotationLayer={false} renderTextLayer={false} />
        </Document>
      </div>
      {showControls && (
        <div className="flex items-center justify-center gap-4 p-3 bg-white border-t">
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="px-3 py-1.5 bg-gray-200 rounded disabled:opacity-50">
            Previous
          </button>
          <p className="text-sm text-gray-700">Page {pageNumber} of {numPages}</p>
          <button onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} className="px-3 py-1.5 bg-gray-200 rounded disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
