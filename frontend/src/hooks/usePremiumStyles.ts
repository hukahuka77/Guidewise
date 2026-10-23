import { useEffect, useState } from 'react';

/**
 * Whether the signed-in account's plan includes the premium guidebook styles. Guests and anyone
 * whose plan can't be read get false (Signature only); the server enforces the same rule.
 */
export function usePremiumStyles(accessToken: string | null, isGuest: boolean): boolean {
  const [premium, setPremium] = useState(false);
  useEffect(() => {
    if (!accessToken || isGuest) {
      setPremium(false);
      return;
    }
    let cancelled = false;
    fetch('/api/billing/summary', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setPremium(Boolean(data?.features?.premium_styles));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);
  return premium;
}
