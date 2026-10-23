import { parsePythonLiteral, pyTruthy, strOrEmpty } from "./pyCompat";

export interface Rule {
  name: string;
  description: string;
}

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Normalize house rules: they arrive as proper dicts,
 * nested dicts from an old bug, "Name: details" strings or python-dict-looking strings.
 */
export function normalizeRules(rawRules: unknown): Rule[] {
  const out: Rule[] = [];
  if (!Array.isArray(rawRules)) return out;
  for (const r of rawRules) {
    if (!pyTruthy(r)) continue;

    if (isDict(r)) {
      const nameVal = r.name;
      const descVal = r.description;
      let name: string;
      let desc: string;
      if (isDict(nameVal) && ("name" in nameVal || "description" in nameVal)) {
        name = strOrEmpty(nameVal.name).trim();
        desc = (strOrEmpty(nameVal.description) || strOrEmpty(descVal)).trim();
      } else {
        name = strOrEmpty(nameVal).trim();
        desc = strOrEmpty(descVal).trim();
      }
      if (name || desc) out.push({ name, description: desc });
      continue;
    }

    if (typeof r === "string") {
      const s = r.trim();
      if (s.startsWith("{") && s.endsWith("}")) {
        try {
          const parsed = parsePythonLiteral(s);
          if (isDict(parsed)) {
            const name = strOrEmpty(parsed.name).trim();
            const desc = strOrEmpty(parsed.description).trim();
            if (name || desc) {
              out.push({ name, description: desc });
              continue;
            }
          }
        } catch {
          // fall through to the colon split, like the Python version
        }
      }
      if (s.includes(":")) {
        const idx = s.indexOf(":");
        const name = s.slice(0, idx).trim();
        const desc = s.slice(idx + 1).trim();
        out.push({ name: name || s, description: desc });
      } else {
        out.push({ name: s, description: "" });
      }
    }
  }
  return out;
}

/** Port of `rules_as_text`: "Name: description" lines for plain-text consumers (PDFs). */
export function rulesAsText(rawRules: unknown): string[] {
  return normalizeRules(rawRules).map((rule) =>
    rule.name && rule.description ? `${rule.name}: ${rule.description}` : rule.name || rule.description,
  );
}
