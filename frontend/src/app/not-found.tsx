import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAF8F3]">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold text-gray-800">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700">Page Not Found</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <div className="pt-4">
          <Link href="/dashboard">
            <Button className="bg-[oklch(0.6923_0.22_21.05)] hover:opacity-90">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
