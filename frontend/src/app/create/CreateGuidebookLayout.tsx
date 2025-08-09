import React from "react";

interface CreateGuidebookLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export default function CreateGuidebookLayout({ sidebar, children }: CreateGuidebookLayoutProps) {
  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <div className="flex h-[90vh] w-[90vw] max-w-[1800px] rounded-2xl shadow-lg overflow-hidden bg-white/60">
        <aside className="w-56 flex-shrink-0 rounded-l-2xl shadow-lg bg-pink-500/95">{sidebar}</aside>
        <main className="flex-1 bg-gradient-to-br from-blue-50 via-pink-50 to-purple-100 p-10 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
