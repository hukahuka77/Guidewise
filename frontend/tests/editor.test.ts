import { describe, expect, it } from "vitest";
import { insertInOrder } from "../src/components/sections/SidebarNav";

describe("showing a hidden section again", () => {
  it("puts a built-in section back at its usual place", () => {
    expect(insertInOrder(["welcome", "checkin", "food", "checkout"], "rules")).toEqual(["welcome", "checkin", "food", "rules", "checkout"]);
    expect(insertInOrder(["welcome", "food"], "checkin")).toEqual(["welcome", "checkin", "food"]);
  });

  it("respects a custom order the host already chose", () => {
    expect(insertInOrder(["checkout", "welcome", "food"], "property")).toEqual(["checkout", "welcome", "property", "food"]);
  });

  it("adds custom sections at the end and never duplicates", () => {
    expect(insertInOrder(["welcome", "rules"], "custom_pool")).toEqual(["welcome", "rules", "custom_pool"]);
    expect(insertInOrder(["welcome", "rules"], "rules")).toEqual(["welcome", "rules"]);
  });
});
