// Python/Jinja behaviours that the guidebook templates and helpers rely on (the templates were
// written for Jinja, and stored data includes Python-style values).

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Port of `_strip_surrogates`: drop unpaired surrogates (broken emoji halves). */
export function stripSurrogates(value: string): string {
  return value.replace(LONE_SURROGATE, "");
}

function encodeUtf8Component(value: string): string {
  // encodeURIComponent throws on lone surrogates; Python would also refuse them.
  return encodeURIComponent(value.replace(LONE_SURROGATE, "�")).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/** Python `urllib.parse.quote_plus(str(value))` (safe characters: letters, digits, `_.-~`). */
export function quotePlus(value: unknown): string {
  return encodeUtf8Component(String(value)).replace(/%20/g, "+");
}

/** Jinja's `urlencode` filter for a string: `quote(value, safe="/")`. */
export function jinjaUrlencode(value: unknown): string {
  if (value === undefined || value === null) return "";
  return encodeUtf8Component(String(value)).replace(/%2F/gi, "/");
}

/** Python `urllib.parse.urlencode(dict)`. */
export function urlencodeParams(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${quotePlus(k)}=${quotePlus(v)}`)
    .join("&");
}

/** Python `urllib.parse.unquote_plus`. */
export function unquotePlus(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value.replace(/\+/g, " ");
  }
}

const WORD_BEGINNING = /([-\s({[<]+)/;

/** Jinja's `title` filter. */
export function jinjaTitle(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .split(WORD_BEGINNING)
    .filter((item) => item !== "")
    .map((item) => item[0].toUpperCase() + item.slice(1).toLowerCase())
    .join("");
}

/** Jinja's HTML escaping (Markup.escape): & < > ' " only. */
export function jinjaEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&#34;");
}

/** Python truthiness for JSON-like values (`x or default`). */
export function pyTruthy(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/** Python `str(x or "")` for JSON-like values. */
export function strOrEmpty(value: unknown): string {
  return pyTruthy(value) ? String(value) : "";
}

/** Python `str.strip()` equivalent. */
export function strip(value: string): string {
  return value.trim();
}

/**
 * Minimal `ast.literal_eval` for the legacy "{'name': 'x', 'description': 'y'}" strings that
 * older versions of the app stored in rules. Supports dicts, lists, strings, numbers, None/True/False.
 * Throws on anything else, like literal_eval would.
 */
export function parsePythonLiteral(source: string): unknown {
  let i = 0;
  const peek = () => source[i];
  const skipWs = () => {
    while (i < source.length && /\s/.test(source[i])) i++;
  };
  const fail = (msg: string): never => {
    throw new Error(`literal parse error: ${msg}`);
  };

  const parseString = (): string => {
    const quote = source[i++];
    let out = "";
    while (i < source.length && source[i] !== quote) {
      if (source[i] === "\\") {
        i++;
        const c = source[i++];
        const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"' };
        out += c in map ? map[c] : "\\" + c;
      } else {
        out += source[i++];
      }
    }
    if (source[i] !== quote) fail("unterminated string");
    i++;
    return out;
  };

  const parseValue = (): unknown => {
    skipWs();
    const c = peek();
    if (c === "{") {
      i++;
      const obj: Record<string, unknown> = {};
      skipWs();
      if (peek() === "}") {
        i++;
        return obj;
      }
      for (;;) {
        skipWs();
        const key = parseValue();
        if (typeof key !== "string" && typeof key !== "number") fail("bad key");
        skipWs();
        if (source[i++] !== ":") fail("expected :");
        obj[String(key)] = parseValue();
        skipWs();
        if (peek() === ",") {
          i++;
          skipWs();
          if (peek() === "}") {
            i++;
            return obj;
          }
          continue;
        }
        if (source[i++] !== "}") fail("expected }");
        return obj;
      }
    }
    if (c === "[") {
      i++;
      const arr: unknown[] = [];
      skipWs();
      if (peek() === "]") {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(parseValue());
        skipWs();
        if (peek() === ",") {
          i++;
          skipWs();
          if (peek() === "]") {
            i++;
            return arr;
          }
          continue;
        }
        if (source[i++] !== "]") fail("expected ]");
        return arr;
      }
    }
    if (c === "'" || c === '"') return parseString();
    const rest = source.slice(i);
    const num = /^-?\d+(\.\d+)?/.exec(rest);
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    for (const [word, val] of [["None", null], ["True", true], ["False", false]] as const) {
      if (rest.startsWith(word)) {
        i += word.length;
        return val;
      }
    }
    return fail(`unexpected token at ${i}`);
  };

  const result = parseValue();
  skipWs();
  if (i !== source.length) fail("trailing data");
  return result;
}

/**
 * Jinja treats empty lists/dicts as false; JavaScript (and so Nunjucks) treats them as true.
 * Replace every nested empty array/object with `undefined` so `{% if x %}` keeps its Python meaning.
 */
export function withPythonTruthiness<T>(value: T): T {
  const convert = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.length === 0 ? undefined : v.map(convert);
    if (typeof v === "object" && v !== null) {
      const entries = Object.entries(v as Record<string, unknown>);
      return entries.length === 0 ? undefined : Object.fromEntries(entries.map(([k, val]) => [k, convert(val)]));
    }
    return v;
  };
  if (Array.isArray(value)) return value.map(convert) as unknown as T;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, val]) => [k, convert(val)]),
    ) as T;
  }
  return value;
}

