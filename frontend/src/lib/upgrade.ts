/** Error from the API that the user can resolve by upgrading their plan. */
export class UpgradeRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpgradeRequiredError";
  }
}

/** Read `{ error, upgrade }` from a failed API response; throws UpgradeRequiredError for plan limits. */
export async function throwApiError(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; upgrade?: boolean };
  const message = body.error || fallback;
  if (res.status === 403 && body.upgrade) throw new UpgradeRequiredError(message);
  throw new Error(message);
}

/** Offer the pricing page when an action needs a higher plan. Returns true if it handled the error. */
export function offerUpgrade(error: unknown): boolean {
  if (!(error instanceof UpgradeRequiredError)) return false;
  if (typeof window !== "undefined" && window.confirm(`${error.message}\n\nView plans?`)) {
    window.location.href = "/pricing";
  }
  return true;
}
