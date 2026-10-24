// Sending email through Resend's HTTP API. Mail comes from the mail. subdomain (keeps sending reputation
// apart from the main domain's inbox) with replies going to the real inbox.

export const EMAIL_FROM = "Guidewise <hello@mail.guidewiseapp.com>";
export const EMAIL_REPLY_TO = "hello@guidewiseapp.com";
const RESEND_URL = "https://api.resend.com/emails";

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/** Send one email; throws with Resend's reason when it's refused. Returns Resend's message id. */
export async function sendEmail(email: Email): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      reply_to: EMAIL_REPLY_TO,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      ...(email.text ? { text: email.text } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${String(body.message ?? "refused").slice(0, 200)}`);
  return body.id ?? "";
}

/** Escape text for HTML email bodies. */
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
