"use client";

import { useState } from "react";
import { notify } from "@/lib/dialog";
import { qrPngDataUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";

interface QRDownloadButtonProps {
  targetUrl: string;
  propertyName?: string;
  variant?: "default" | "outline";
  className?: string;
}

export default function QRDownloadButton({
  targetUrl,
  propertyName = "guidebook",
  variant = "default",
  className = ""
}: QRDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.href = await qrPngDataUrl(targetUrl, 800);
      link.download = `${propertyName.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download QR code:', error);
      notify('Couldn\'t download the QR code', 'Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={downloading}
      variant={variant}
      className={className}
    >
      {downloading ? 'Downloading...' : 'Download QR Code'}
    </Button>
  );
}
