import { describe, expect, it } from "vitest";
import { isPublicIp } from "../src/lib/server/ssrf";

describe("isPublicIp", () => {
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "151.101.1.1", "2606:4700::1111", "::ffff:8.8.8.8", "64:ff9b::808:808"]) expect(isPublicIp(ip)).toBe(true);
  });

  it("blocks private, local and reserved addresses, including IPv4 wrapped in IPv6", () => {
    for (const ip of [
      "10.0.0.1", "127.0.0.1", "0.0.0.0", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "198.18.0.1", "198.19.255.255", "192.0.0.1", "224.0.0.1",
      "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::127.0.0.1", "64:ff9b::a00:1",
    ]) expect(isPublicIp(ip), ip).toBe(false);
  });
});
