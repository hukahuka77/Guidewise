import React from "react";

interface CreateGuidebookLayoutProps {
  /** Sticky bar under the site header: back link, title, save state and actions. */
  topbar?: React.ReactNode;
  /** Section navigation: a column from md up, a scrollable strip above the form on phones. */
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Live preview column (shown from the xl breakpoint up). */
  preview?: React.ReactNode;
}

/** The guidebook editor: navigation | form | live preview, on the Guidewise cream background. */
export default function CreateGuidebookLayout({ topbar, sidebar, children, preview }: CreateGuidebookLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-56px)] w-full bg-[#F8F5F1]">
      {topbar}
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:flex-row md:gap-8 md:py-8 lg:px-6">
        <aside className="md:w-56 md:shrink-0 lg:w-60">
          <div className="md:sticky md:top-[152px]">{sidebar}</div>
        </aside>
        <main className="min-w-0 flex-1 pb-16">{children}</main>
        {preview && (
          <aside className="hidden w-[360px] shrink-0 xl:block">
            <div className="sticky top-[152px]">{preview}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
