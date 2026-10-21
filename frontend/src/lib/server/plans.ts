/** Guidebook limits per plan (port of PLAN_CONFIGS in backend/app.py; `null` = unlimited). */
export const PLAN_GUIDEBOOK_LIMITS: Record<string, number | null> = {
  trial: 0,
  starter: 1,
  growth: 3,
  pro: 10,
  enterprise: null,
};
