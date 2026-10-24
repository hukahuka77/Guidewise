import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Shared guards for server-side fetching of user-influenced URLs.

export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 192 && b === 0 && ip.split(".")[2] === "0") return false;
    if (a >= 224) return false;
    return true;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return false;
  if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9")) return false;
  if (v6.startsWith("fea") || v6.startsWith("feb")) return false;
  // IPv4 carried inside IPv6 (mapped "::ffff:", NAT64 "64:ff9b::"), dotted or as two hex groups
  for (const prefix of ["::ffff:", "64:ff9b::"]) {
    if (v6.startsWith(prefix)) return isPublicIp(embeddedIpv4(v6.slice(prefix.length)));
  }
  return true;
}

function embeddedIpv4(tail: string): string {
  if (isIP(tail) === 4) return tail;
  const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
  if (!m) return "0.0.0.0"; // unparseable: treat as private
  const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

export async function resolvesToPublicIp(host: string): Promise<boolean> {
  try {
    const infos = await lookup(host, { all: true });
    return infos.length > 0 && infos.every((i) => isPublicIp(i.address));
  } catch {
    return false;
  }
}
