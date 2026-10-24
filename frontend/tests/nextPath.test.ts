import { describe, expect, it } from "vitest";
import { loginPath, rememberNextPath, safeNextPath, takeRememberedNextPath } from "../src/lib/nextPath";

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

describe("remembering where to go across a Google sign-in", () => {
  it("keeps one safe path and hands it back once", () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    rememberNextPath("/edit/12");
    expect(takeRememberedNextPath()).toBe("/edit/12");
    expect(takeRememberedNextPath()).toBeNull();
    rememberNextPath("//evil.com");
    expect(takeRememberedNextPath()).toBeNull();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(takeRememberedNextPath()).toBeNull(); // no storage: the usual page
  });
});
