# Backlog

Work agreed but on hold (Oct 24, 2026). Pick these up in a later round.

- **Split the Google Maps key.** The browser key (in the page code) has 31 APIs and no website
  restriction. Make a browser key limited to guidewiseapp.com (Maps JavaScript + Places only) and a
  separate server key (Places only) in Vercel as `GOOGLE_API_KEY`. Add a Cloud billing budget alert.
- **CAPTCHA on guest sign-up.** Guest sessions are unlimited apart from Supabase's per-IP limit. Turning
  CAPTCHA on in Supabase applies to every auth call, so first add Cloudflare Turnstile to login, sign-up,
  password reset and guest start, and change the gift tool's server-side guest creation to the admin API.
- **Guidebooks of deleted users, and account deletion.** Guidebooks whose owner no longer exists in
  `auth.users` stay public (8 from 7 users on Oct 24). Add a delete-account flow that removes the user's
  guidebooks, hosts, properties, view rows and uploads, and decide what to do with the existing orphans.
- **Clean up abandoned guest and gift accounts.** Anonymous users (onboarding guests, gift owners) are
  only removed when claimed. Remove unclaimed ones and their guidebooks a while after their links expire
  (gift links last 30 days).
