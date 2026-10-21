import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type HTTPRequest } from "puppeteer-core";
import { resolvesToPublicIp } from "@/lib/server/ssrf";

// HTML -> PDF with headless Chromium (replaces WeasyPrint). On Vercel it runs the @sparticuz/chromium
// build; set PDF_CHROMIUM_PATH to use a locally installed Chrome instead (e.g. for development).

const IMAGE_WAIT_MS = 15_000;
const RENDER_TIMEOUT_MS = 25_000;

async function launch(): Promise<Browser> {
  const local = process.env.PDF_CHROMIUM_PATH;
  return puppeteer.launch({
    args: local ? ["--no-sandbox", "--disable-gpu"] : chromium.args,
    executablePath: local || (await chromium.executablePath()),
    headless: "shell",
  });
}

const hostSafety = new Map<string, boolean>();
async function hostIsSafe(host: string): Promise<boolean> {
  const cached = hostSafety.get(host);
  if (cached !== undefined) return cached;
  const safe = await resolvesToPublicIp(host);
  hostSafety.set(host, safe);
  return safe;
}

/** Only public http(s) resources (images, fonts) may load; the guidebook content is user-controlled. */
export async function isRequestAllowed(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === "data:" || rawUrl === "about:blank") return true;
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return hostIsSafe(url.hostname.replace(/^\[|\]$/g, ""));
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request: HTTPRequest) => {
      void isRequestAllowed(request.url()).then(
        (ok) => (ok ? request.continue() : request.abort("blockedbyclient")),
        () => request.abort("failed"),
      );
    });
    // "load" waits for images; if one never finishes, print what has loaded rather than failing
    await page.setContent(html, { waitUntil: "load", timeout: IMAGE_WAIT_MS }).catch((error: unknown) => {
      if (!(error instanceof Error && error.name === "TimeoutError")) throw error;
    });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: RENDER_TIMEOUT_MS });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
