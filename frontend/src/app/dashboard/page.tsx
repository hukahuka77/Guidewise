"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ExternalLink, LayoutGrid, List, MoreHorizontal, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/ui/spinner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import QRDownloadButton from "@/components/custom/QRDownloadButton";
import { absoluteUrl } from "@/lib/publicUrl";
import { offerUpgrade, throwApiError } from "@/lib/upgrade";
import { notify } from "@/lib/dialog";
import { cacheGet, cacheSet } from "@/lib/cache";
import { claimGuestGuidebooks, isGuestSession } from "@/lib/guest";
import { useDialog } from "@/hooks/useDialog";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

type GuidebookItem = {
  id: string;
  property_name?: string | null;
  template_key?: string | null;
  created_time?: string | null;
  last_modified_time?: string | null;
  cover_image_url?: string | null;
  public_slug?: string | null;
};

// Map internal template keys to human-friendly display names
const TEMPLATE_DISPLAY_NAMES: Record<string, string> = {
  template_signature: "Signature",
  template_original: "Guidewise Classic",
  template_generic: "Lifestyle",
  template_lifestyle: "Lifestyle",
  template_welcomebook: "Welcoming",
};

// Derive a resized cover thumbnail URL using Supabase's image transformation endpoint
function getCoverThumbUrl(coverUrl: string | null | undefined): string | null {
  if (!coverUrl || !SUPABASE_URL) return coverUrl || null;

  const marker = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/`;
  const idx = coverUrl.indexOf(marker);
  if (idx === -1) return coverUrl; // not a Supabase public URL; return as-is

  const rest = coverUrl.substring(idx + marker.length); // "bucket/path/to/file.jpg"
  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) return coverUrl;

  const bucket = rest.substring(0, firstSlash);
  const path = rest.substring(firstSlash + 1);
  if (!bucket || !path) return coverUrl;

  // Encode each path segment but preserve slashes so Supabase can resolve the object
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/render/image/public/${bucket}/${encodedPath}`;
  // Reasonable thumbnail size + compression for dashboard cards
  return `${base}?width=600&height=300&quality=75`;
}

type ViewMode = "table" | "cards";
const VIEW_KEY = "guidewise-dashboard-view";

const styleName = (key?: string | null) => TEMPLATE_DISPLAY_NAMES[key || "template_signature"] || "Signature";
const updatedLabel = (gb: GuidebookItem) => {
  const when = gb.last_modified_time || gb.created_time;
  return when ? new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
};

/** The less common actions for a guidebook, behind a "…" button. */
function RowMenu({ items, busy = false }: { items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[]; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={busy ? "Working…" : "More actions"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy}
        onClick={() => setOpen((o) => !o)}
        className={ICON_BUTTON}
      >
        {busy ? <Spinner size={16} colorClass="text-[#db2777]" /> : <MoreHorizontal className="size-4" />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl bg-white py-1.5 shadow-[0_20px_40px_-16px_rgba(60,40,30,0.35)] ring-1 ring-black/5">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`block w-full px-4 py-2 text-left text-sm disabled:opacity-50 ${item.danger ? "text-red-700 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STYLE_CHIP: Record<string, string> = {
  Signature: "bg-[#fbeee6] text-[#8e4226]",
  Lifestyle: "bg-sky-50 text-sky-800",
  Welcoming: "bg-[#f1ede7] text-[#5b524c]",
};

function StyleChip({ templateKey }: { templateKey?: string | null }) {
  const name = styleName(templateKey);
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STYLE_CHIP[name] || "bg-gray-100 text-gray-700"}`}>{name}</span>;
}

function Cover({ url, className }: { url?: string | null; className: string }) {
  return (
    <span className={`block overflow-hidden bg-gradient-to-br from-[#fbeee6] to-[#f3ede7] ${className}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getCoverThumbUrl(url) || url} alt="" className="h-full w-full object-cover" />
      )}
    </span>
  );
}

function Banner({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-100">
      <p>{children}</p>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

const EDIT_BUTTON =
  "inline-flex h-9 items-center justify-center rounded-full bg-[#1f1a17] px-4 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#3a312b] hover:no-underline";
const ICON_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#5b524c] ring-1 ring-[#1f1a17]/12 transition-colors hover:bg-[#faf7f4] hover:text-[#1f1a17]";

export default function DashboardPage() {
  const [items, setItems] = useState<GuidebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<'free'|'starter'|'power'|'pro'|''>('');
  const [usage, setUsage] = useState<{ viewsUsed: number; viewsLimit: number | null }>({ viewsUsed: 0, viewsLimit: null });
  // Table by default; the card view is a choice we remember
  const [view, setView] = useState<ViewMode>("table");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "cards") setView("cards");
    } catch { }
  }, []);
  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch { }
  };

  // UI state
  const [qrModalFor, setQrModalFor] = useState<string | null>(null); // guidebook id
  const qrDialogRef = useRef<HTMLDivElement>(null);
  useDialog(qrModalFor !== null, () => setQrModalFor(null), qrDialogRef);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null); // guidebook id being downloaded

  // Check for update success message
  useEffect(() => {
    if (searchParams.get('updated') === 'true') {
      setUpdateSuccess(true);
      // Clear the URL parameter
      router.replace('/dashboard');
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setUpdateSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Serve from cache immediately if available
      const cached = cacheGet<GuidebookItem[]>("dashboard:guidebooks");
      if (cached && !cancelled) {
        setItems(cached);
        setLoading(false);
      }

      if (!supabase) {
        if (!cached) setError("Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (!token) {
        router.push("/login");
        return;
      }
      if (isGuestSession(data.session)) {
        router.push("/signup?save=1");
        return;
      }
      // Guidebooks built as a guest before signing up join the account first
      await claimGuestGuidebooks();
      try {
        // Fetch plan and limits from billing summary
        try {
          const token2 = (await supabase.auth.getSession()).data.session?.access_token || null;
          if (token2) {
            const r = await fetch(`/api/billing/summary`, { headers: { Authorization: `Bearer ${token2}` } });
            if (r.ok) {
              const j = await r.json();
              const userPlan = j?.plan || 'free';
              if (!cancelled) {
                setPlan(userPlan);
                setUsage({ viewsUsed: j?.views_used ?? 0, viewsLimit: j?.views_limit ?? null });
              }
            }
          }
        } catch {}

        const res = await fetch(`/api/guidebooks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load guidebooks (${res.status})`);
        const json = await res.json();
        const newItems = Array.isArray(json.items) ? json.items : [];
        if (!cancelled) {
          setItems(newItems);
          cacheSet("dashboard:guidebooks", newItems, 5 * 60_000);
          if (!cached) setLoading(false);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load guidebooks";
        if (!cancelled) {
          if (!cached) setError(msg);
        }
      } finally {
        if (!cancelled && !cached) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Show success banner after Stripe payment redirect
  useEffect(() => {
    const upgraded = searchParams?.get('upgraded');
    if (upgraded !== '1') return;

    // Show success message
    setSyncSuccess(true);

    // Clear profile cache to force refresh on next visit
    cacheSet("profile:user", null, 0);

    // Remove the ?upgraded=1 param from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('upgraded');
      window.history.replaceState({}, '', url.toString());
    }

    // Hide success message after 8 seconds
    const timer = setTimeout(() => {
      setSyncSuccess(false);
    }, 8000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const getQrTargetUrl = (id: string) => absoluteUrl(`/guidebook/${id}`);
  const getQrImageUrl = (url: string, size = 300) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  // Download print PDF with loading state
  const downloadPrintPdf = async (id: string, propertyName: string) => {
    setDownloadingPdf(id);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token || null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/guidebook/${id}/print-pdf?download=1`, {
        headers,
      });

      if (!res.ok) await throwApiError(res, 'Failed to generate PDF');

      // Create blob and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${propertyName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF download error:', e);
      if (!offerUpgrade(e)) notify("Couldn't create the PDF", e instanceof Error && e.message ? e.message : 'Please try again.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const menuFor = (gb: GuidebookItem, name: string, viewUrl: string | null) => [
    ...(viewUrl ? [{ label: "View guidebook", onSelect: () => window.open(viewUrl, "_blank", "noopener") }] : []),
    { label: "QR code", onSelect: () => setQrModalFor(gb.id) },
    { label: downloadingPdf === gb.id ? "Creating PDF…" : "Download PDF version", onSelect: () => downloadPrintPdf(gb.id, name), disabled: downloadingPdf === gb.id },
    { label: "Delete", onSelect: () => setDeleteId(gb.id), danger: true },
  ];

  const freeViews = plan && usage.viewsLimit !== null;
  const viewsShare = freeViews && usage.viewsLimit ? Math.min(1, usage.viewsUsed / usage.viewsLimit) : 0;
  const viewsOut = freeViews && usage.viewsLimit !== null && usage.viewsUsed >= usage.viewsLimit;
  const planName = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "";

  return (
    <div className="space-y-6">
      {syncSuccess && (
        <Banner>
          <strong className="font-semibold">Payment successful!</strong> Your subscription is being activated. Refresh in a moment to see your new plan.
        </Banner>
      )}
      {updateSuccess && (
        <Banner onClose={() => setUpdateSuccess(false)}>
          <strong className="font-semibold">Guidebook updated.</strong>
        </Banner>
      )}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#1f1a17] sm:text-4xl">Your guidebooks</h1>
          <p className="mt-1.5 text-[#5b524c]">Edit, share and print the guides your guests open.</p>
        </div>
        <div className="flex items-center gap-2">
          {plan !== "pro" && plan !== "" && (
            <Link href="/pricing" className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-[#1f1a17] no-underline ring-1 ring-[#1f1a17]/15 transition-colors hover:bg-white hover:no-underline">
              Upgrade
            </Link>
          )}
          <Link href="/onboarding" className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-5 text-sm font-semibold text-white no-underline shadow-[0_10px_24px_-12px_rgba(219,39,119,0.7)] transition-transform hover:-translate-y-0.5 hover:no-underline">
            <Plus className="h-4 w-4" /> New guidebook
          </Link>
        </div>
      </header>

      {plan && (freeViews ? (
        <section aria-label="Guest views" className="flex flex-col gap-4 rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 sm:justify-start">
              <p className="text-sm font-medium text-[#1f1a17]">Guest views this month</p>
              <p className={`text-sm font-semibold ${viewsOut ? "text-red-600" : viewsShare >= 0.8 ? "text-amber-700" : "text-[#1f1a17]"}`}>
                {usage.viewsUsed} of {usage.viewsLimit}
              </p>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#f3ede7] sm:max-w-md">
              <div
                className={`h-full rounded-full ${viewsOut ? "bg-red-500" : viewsShare >= 0.8 ? "bg-amber-500" : "bg-gradient-to-r from-[#db2777] to-[#f97316]"}`}
                style={{ width: `${Math.max(viewsShare * 100, usage.viewsUsed ? 3 : 0)}%` }}
              />
            </div>
            {viewsOut && <p className="mt-2 text-sm text-red-700">Your guidebooks are paused for guests until next month or until you upgrade.</p>}
          </div>
          <Link href="/pricing" className="shrink-0 text-sm font-semibold text-[#be185d] no-underline hover:underline">
            Get unlimited views
          </Link>
        </section>
      ) : (
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-[#5b524c] ring-1 ring-black/5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Unlimited guest views on the {planName} plan
        </p>
      ))}

      {loading && (
        <div className="flex items-center gap-3 rounded-3xl bg-white p-6 text-[#5b524c] ring-1 ring-black/5">
          <Spinner size={20} colorClass="text-[#db2777]" />
          <span>Loading your guidebooks…</span>
        </div>
      )}
      {!loading && error && <div className="rounded-3xl bg-white p-6 text-red-700 ring-1 ring-red-100">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <section className="flex flex-col items-center rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-black/5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf0f5] text-[#db2777]">
            <BookOpen className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-[#1f1a17]">Build your first guidebook</h2>
          <p className="mt-2 max-w-sm text-[#5b524c]">Paste your Airbnb or VRBO link and Guidewise fills in Wi-Fi, check-in, house rules and places nearby.</p>
          <Link href="/onboarding" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#db2777] to-[#f97316] px-6 text-sm font-semibold text-white no-underline shadow-[0_10px_24px_-12px_rgba(219,39,119,0.7)] hover:no-underline">
            <Plus className="h-4 w-4" /> New guidebook
          </Link>
        </section>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#8a7f77]">{items.length} {items.length === 1 ? "guidebook" : "guidebooks"}</p>
          <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-black/5" role="radiogroup" aria-label="Display as">
            {([["table", "Table", List], ["cards", "Cards", LayoutGrid]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={view === key}
                onClick={() => changeView(key)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${view === key ? "bg-[#1f1a17] text-white" : "text-[#5b524c] hover:text-[#1f1a17]"}`}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && view === "table" && (
        <div className="rounded-3xl bg-white shadow-[0_20px_40px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-[#f0eae4] text-xs uppercase tracking-wide text-[#8a7f77]">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-medium">Property</th>
                <th scope="col" className="hidden w-36 px-4 py-3.5 font-medium md:table-cell">Style</th>
                <th scope="col" className="hidden w-36 px-4 py-3.5 font-medium sm:table-cell">Updated</th>
                <th scope="col" className="w-[120px] px-3 py-3.5 text-right font-medium sm:w-[190px] sm:px-5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3eee9]">
              {items.map((gb) => {
                const viewUrl = gb.public_slug ? `/g/${gb.public_slug}` : null;
                const name = gb.property_name || "Untitled Property";
                return (
                  <tr key={gb.id} className="transition-colors hover:bg-[#fcfaf8]">
                    <td className="px-5 py-3.5">
                      <Link href={`/edit/${gb.id}`} className="flex min-w-0 items-center gap-3 no-underline hover:no-underline">
                        <Cover url={gb.cover_image_url} className="hidden h-11 w-16 shrink-0 rounded-xl sm:block" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[#1f1a17]" title={name}>{name}</span>
                          <span className="block truncate text-xs text-[#8a7f77] sm:hidden">{updatedLabel(gb)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3.5 md:table-cell"><StyleChip templateKey={gb.template_key} /></td>
                    <td className="hidden px-4 py-3.5 text-[#5b524c] sm:table-cell">{updatedLabel(gb)}</td>
                    <td className="px-3 py-3.5 sm:px-5">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/edit/${gb.id}`} className={EDIT_BUTTON}>Edit</Link>
                        {viewUrl && (
                          <Link href={viewUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${name}`} title="View guidebook" className={`${ICON_BUTTON} hidden sm:flex`}>
                            <ExternalLink className="size-4" />
                          </Link>
                        )}
                        <RowMenu items={menuFor(gb, name, viewUrl)} busy={downloadingPdf === gb.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && items.length > 0 && view === "cards" && (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.slice(0, visibleCount).map((gb) => {
            const viewUrl = gb.public_slug ? `/g/${gb.public_slug}` : null;
            const name = gb.property_name || "Untitled Property";
            return (
              <li key={gb.id} className="group relative rounded-3xl bg-white p-3 shadow-[0_20px_40px_-30px_rgba(60,40,30,0.35)] ring-1 ring-black/5 transition-shadow hover:shadow-[0_24px_48px_-28px_rgba(60,40,30,0.45)]">
                <Link href={`/edit/${gb.id}`} className="block no-underline hover:no-underline">
                  <Cover url={gb.cover_image_url} className="aspect-[16/10] w-full rounded-2xl" />
                </Link>
                <div className="px-2 pb-1 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[#1f1a17]" title={name}>{name}</h3>
                      {updatedLabel(gb) && <p className="text-xs text-[#8a7f77]">Updated {updatedLabel(gb)}</p>}
                    </div>
                    <StyleChip templateKey={gb.template_key} />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link href={`/edit/${gb.id}`} className={`${EDIT_BUTTON} flex-1`}>Edit</Link>
                    {viewUrl && (
                      <Link href={viewUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${name}`} title="View guidebook" className={ICON_BUTTON}>
                        <ExternalLink className="size-4" />
                      </Link>
                    )}
                    <RowMenu items={menuFor(gb, name, viewUrl)} busy={downloadingPdf === gb.id} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && view === "cards" && items.length > visibleCount && (
        <div className="flex justify-center">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-full bg-white px-6 text-sm font-semibold text-[#1f1a17] ring-1 ring-[#1f1a17]/15 hover:bg-[#faf7f4]"
            onClick={() => setVisibleCount((prev) => Math.min(items.length, prev + 6))}
          >
            Load more
          </button>
        </div>
      )}

      {qrModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQrModalFor(null)}>
          <div ref={qrDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Guidebook QR code" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl outline-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1f1a17]">QR code</h3>
              <button type="button" onClick={() => setQrModalFor(null)} aria-label="Close" className={ICON_BUTTON}>
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-[#5b524c]">Print it for the fridge or the front door. It always opens the live guidebook.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getQrImageUrl(getQrTargetUrl(qrModalFor), 400)} alt="Guidebook QR code" className="mx-auto mt-5 h-[240px] w-[240px] rounded-2xl bg-white p-3 ring-1 ring-black/5" />
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href={getQrTargetUrl(qrModalFor)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-[#1f1a17] no-underline ring-1 ring-[#1f1a17]/15 hover:bg-[#faf7f4] hover:no-underline">
                <ExternalLink className="size-4" /> Open guidebook
              </Link>
              <QRDownloadButton targetUrl={getQrTargetUrl(qrModalFor)} propertyName={items.find((gb) => gb.id === qrModalFor)?.property_name || "guidebook"} className="h-10 rounded-full px-4" />
            </div>
          </div>
        </div>
      )}

        <ConfirmModal
          open={!!deleteId}
          title="Delete guidebook?"
          description={"This will permanently delete this guidebook and its data. This action cannot be undone."}
          confirmLabel={deleteLoading ? "Deleting…" : "Delete"}
          cancelLabel="Cancel"
          destructive
          onCancel={() => {
            if (deleteLoading) return;
            setDeleteId(null);
          }}
          onConfirm={async () => {
            if (!deleteId || deleteLoading) return;
            setDeleteLoading(true);
            try {
              const token = (await supabase?.auth.getSession())?.data.session?.access_token || null;
              if (!token) {
                setDeleteLoading(false);
                notify("Couldn't delete the guidebook", "Your session has expired. Log in again and retry.");
                return;
              }

              const res = await fetch(`/api/guidebooks/${deleteId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (!res.ok) {
                console.error('Delete failed', await res.text());
                setDeleteLoading(false);
                notify("Couldn't delete the guidebook", "Please try again.");
                return;
              }

              setItems(prev => prev.filter(item => item.id !== deleteId));
              cacheSet("dashboard:guidebooks", null, 0);
              setDeleteId(null);
            } catch (e) {
              console.error('Delete guidebook error:', e);
              notify("Couldn't delete the guidebook", "Please try again.");
            } finally {
              setDeleteLoading(false);
            }
          }}
        />

      {downloadingPdf && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-[#1f1a17] py-3 pl-4 pr-5 text-sm text-white shadow-[0_20px_40px_-12px_rgba(31,26,23,0.5)]">
            <Spinner size={18} colorClass="text-[#f9a8d4]" />
            <span>
              <span className="font-semibold">Creating your PDF…</span>
              <span className="text-white/70"> this takes a few seconds.</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
