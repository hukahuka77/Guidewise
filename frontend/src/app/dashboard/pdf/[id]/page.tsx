/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const PdfViewer = dynamic(() => import("@/components/custom/PdfViewer"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type TemplateKey = "template_pdf_original" | "template_pdf_basic" | "template_pdf_mobile" | "template_pdf_qr";

export default function GuidebookPdfPage() {
  const params = useParams();
  const guidebookId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  const [includeQrInPdf, setIncludeQrInPdf] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);

  const liveGuidebookUrl = useMemo(() => {
    if (!guidebookId) return null;
    return `${API_BASE}/guidebook/${guidebookId}`;
  }, [guidebookId]);

  const getPdfPlaceholder = (templateKey?: TemplateKey) => {
    if (templateKey === "template_pdf_basic") return "/images/PDF_Basic.png";
    if (templateKey === "template_pdf_mobile") return "/images/PDF_Mobile.png";
    if (templateKey === "template_pdf_qr") return "/images/PDF_Standard.png";
    return "/images/PDF_Standard.png";
  };

  const getQrTargetUrl = () => liveGuidebookUrl;

  const handleDownload = (templateKey?: TemplateKey) => {
    if (!guidebookId) return;
    const tplParam = templateKey ? `&template=${templateKey}` : "";
    const forceQr = templateKey === "template_pdf_qr";
    const qr = (forceQr || includeQrInPdf) && getQrTargetUrl() ? getQrTargetUrl() : null;
    const qrParams = qr ? `&include_qr=1&qr_url=${encodeURIComponent(qr)}` : "";
    const url = `${API_BASE}/api/guidebook/${guidebookId}/pdf?download=1${tplParam}${qrParams}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = "guidebook.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buildPdfUrl = async (templateKey?: TemplateKey) => {
    if (!guidebookId) return null;
    const hasTemplate = Boolean(templateKey);
    const tplParam = templateKey ? `?template=${templateKey}` : "";
    const forceQr = templateKey === "template_pdf_qr";
    const qr = (forceQr || includeQrInPdf) && getQrTargetUrl() ? getQrTargetUrl() : null;
    const qrParams = qr ? `${hasTemplate ? "&" : "?"}include_qr=1&qr_url=${encodeURIComponent(qr)}` : "";
    const url = `${API_BASE}/api/guidebook/${guidebookId}/pdf${tplParam}${qrParams}`;
    setPdfUrl(url);
    return url;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <h1 className="text-3xl font-bold text-gray-800">PDF Templates</h1>
            <p className="text-gray-600 mt-1">Preview or download your guidebook as a PDF</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
            {liveGuidebookUrl && (
              <Link href={liveGuidebookUrl} target="_blank"><Button variant="outline">View Live Guidebook</Button></Link>
            )}
          </div>
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Standard PDF */}
            <div className="group relative border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
              <div className="aspect-[8.5/11] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
                <img src={getPdfPlaceholder("template_pdf_original")} alt="Standard PDF placeholder" className="object-contain w-full h-full" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Standard PDF</h3>
                  <p className="text-sm text-gray-500">Preview or download</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white text-pink-600 border border-pink-500 hover:bg-pink-50"
                    onClick={async () => { await buildPdfUrl("template_pdf_original"); setPdfModalOpen(true); }}
                  >
                    Preview
                  </Button>
                  <Button size="sm" onClick={() => handleDownload("template_pdf_original")} disabled={!guidebookId}>Download</Button>
                </div>
              </div>
            </div>

            {/* Basic PDF */}
            <div className="group relative border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
              <div className="aspect-[8.5/11] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
                <img src={getPdfPlaceholder("template_pdf_basic")} alt="Basic PDF placeholder" className="object-contain w-full h-full" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Basic PDF</h3>
                  <p className="text-sm text-gray-500">Preview or download</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white text-pink-600 border border-pink-500 hover:bg-pink-50"
                    onClick={async () => { await buildPdfUrl("template_pdf_basic"); setPdfModalOpen(true); }}
                  >
                    Preview
                  </Button>
                  <Button size="sm" onClick={() => handleDownload("template_pdf_basic")} disabled={!guidebookId}>Download</Button>
                </div>
              </div>
            </div>

            {/* Mobile PDF */}
            <div className="group relative border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
              <div className="aspect-[8.5/11] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
                <img src={getPdfPlaceholder("template_pdf_mobile")} alt="Mobile PDF placeholder" className="object-contain w-full h-full" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Mobile PDF</h3>
                  <p className="text-sm text-gray-500">Interactive menu, sized for phones</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white text-pink-600 border border-pink-500 hover:bg-pink-50"
                    onClick={async () => { await buildPdfUrl("template_pdf_mobile"); setPdfModalOpen(true); }}
                  >
                    Preview
                  </Button>
                  <Button size="sm" onClick={() => handleDownload("template_pdf_mobile")} disabled={!guidebookId}>Download</Button>
                </div>
              </div>
            </div>

            {/* QR Poster */}
            <div className="group relative border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
              <div className="aspect-[8.5/11] w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
                <img src={getPdfPlaceholder("template_pdf_qr")} alt="QR Poster placeholder" className="object-contain w-full h-full" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">QR Poster</h3>
                  <p className="text-sm text-gray-500">Large QR with property title</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white text-pink-600 border border-pink-500 hover:bg-pink-50"
                    onClick={async () => { await buildPdfUrl("template_pdf_qr"); setPdfModalOpen(true); }}
                  >
                    Preview
                  </Button>
                  <Button size="sm" onClick={() => handleDownload("template_pdf_qr")} disabled={!guidebookId}>Download</Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Public URL section removed as requested */}

        {/* PDF Modal */}
        {isPdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPdfModalOpen(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] max-w-5xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-3 border-b shrink-0">
                <h3 className="font-semibold">PDF Preview</h3>
                <div className="flex gap-2">
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
      </div>
    </div>
  );
}
