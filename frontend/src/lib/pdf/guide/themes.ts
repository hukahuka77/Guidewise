export type ThemeKey = "welcomebook" | "classic" | "minimal";

interface Theme {
  /** CSS custom properties */
  vars: Record<string, string>;
}

const serif = '"Playfair Display", Georgia, "Times New Roman", serif';
const sans = 'Inter, "Helvetica Neue", Arial, sans-serif';

export const THEMES: Record<ThemeKey, Theme> = {
  // Warm and friendly: cream pages, terracotta accents
  welcomebook: {
    vars: {
      "--page": "#FAF6F0", "--card": "#FFFFFF", "--ink": "#2B2622", "--muted": "#6F665D", "--line": "#E7DDD0",
      "--accent": "#B9743F", "--accent-soft": "#F3E6D8", "--on-accent": "#FFFFFF",
      "--head-font": serif, "--body-font": sans, "--head-weight": "700", "--radius": "12px",
    },
  },
  // Clean and traditional: white pages, navy accents
  classic: {
    vars: {
      "--page": "#FFFFFF", "--card": "#F6F8FB", "--ink": "#1B2430", "--muted": "#5B6674", "--line": "#DDE3EA",
      "--accent": "#1F3A5F", "--accent-soft": "#E4EBF4", "--on-accent": "#FFFFFF",
      "--head-font": serif, "--body-font": sans, "--head-weight": "700", "--radius": "8px",
    },
  },
  // Quiet and modern: black on white, hairlines
  minimal: {
    vars: {
      "--page": "#FFFFFF", "--card": "#FFFFFF", "--ink": "#111111", "--muted": "#666666", "--line": "#DADADA",
      "--accent": "#111111", "--accent-soft": "#F1F1F1", "--on-accent": "#FFFFFF",
      "--head-font": sans, "--body-font": sans, "--head-weight": "700", "--radius": "4px",
    },
  },
};

export const themeVars = (key: ThemeKey) =>
  Object.entries(THEMES[key].vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
