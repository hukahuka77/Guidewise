"use client";

import { useState } from "react";
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

  const getQrImageUrl = (url: string, size = 300) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const qrUrl = getQrImageUrl(targetUrl, 800);

      // Fetch the image as a blob to enable proper download
      const response = await fetch(qrUrl);
      const blob = await response.blob();

      // Create object URL and download
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${propertyName.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up object URL
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Failed to download QR code:', error);
      alert('Failed to download QR code. Please try again.');
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
