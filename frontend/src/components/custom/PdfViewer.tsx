"use client";

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  fileUrl: string | null;
}

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function goToPrevPage() {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  }

  function goToNextPage() {
    setPageNumber((prevPageNumber) =>
      numPages ? Math.min(prevPageNumber + 1, numPages) : prevPageNumber
    );
  }

  if (!fileUrl) {
    return <div>Loading...</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col items-center bg-gray-100">
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading="Loading PDF preview..."
      >
        <Page pageNumber={pageNumber} scale={1.5} />
      </Document>
      <div className="flex items-center justify-center p-4 bg-white w-full">
        <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="px-4 py-2 mr-4 bg-gray-300 rounded disabled:opacity-50">
          Previous
        </button>
        <p>
          Page {pageNumber} of {numPages}
        </p>
        <button onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} className="px-4 py-2 ml-4 bg-gray-300 rounded disabled:opacity-50">
          Next
        </button>
      </div>
    </div>
  );
}
