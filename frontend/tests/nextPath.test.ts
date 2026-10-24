import { describe, expect, it } from "vitest";
import { loginPath, safeNextPath } from "../src/lib/nextPath";

describe("safeNextPath", () => {
  it("keeps paths on this site, with their query", () => {
    expect(safeNextPath("/dashboard/billing")).toBe("/dashboard/billing");
    expect(safeNextPath("/edit/12?new=true")).toBe("/edit/12?new=true");
    expect(safeNextPath("/")).toBe("/");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "/\t/evil.com", "/\n/evil.com", "", null, undefined]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it("refuses the login and signup pages, which would loop", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/signup?plan=pro")).toBeNull();
    expect(safeNextPath("/loginhelp")).toBe("/loginhelp");
  });
});

describe("loginPath", () => {
  it("adds the page to come back to", () => {
    expect(loginPath("/edit/12?new=true")).toBe("/login?next=%2Fedit%2F12%3Fnew%3Dtrue");
    expect(loginPath("//evil.com")).toBe("/login");
  });
});
