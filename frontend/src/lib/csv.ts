/** Parse CSV text (RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

/** One CSV line; fields with commas, quotes or line breaks are quoted. */
export function toCsvLine(values: string[]): string {
  return values.map((v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",");
}

/** Drop tracking parameters (utm_*, fbclid, gclid) from a link; anything unparseable is returned trimmed. */
export function stripTracking(link: string): string {
  const value = link.trim();
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "fbclid" || key === "gclid") url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value;
  }
}
