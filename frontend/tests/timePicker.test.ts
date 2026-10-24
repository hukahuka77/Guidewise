import { describe, expect, it } from "vitest";
import { formatTime, parseTime } from "../src/components/editor/TimePicker";

describe("time picker", () => {
  it("reads the ways hosts type times", () => {
    expect(parseTime("4pm")).toBe("16:00");
    expect(parseTime("4:30 p.m.")).toBe("16:30");
    expect(parseTime("11 am")).toBe("11:00");
    expect(parseTime("11")).toBe("11:00");
    expect(parseTime("4")).toBe("16:00"); // a bare 1-7 means afternoon
    expect(parseTime("16:30")).toBe("16:30");
    expect(parseTime("1630")).toBe("16:30");
    expect(parseTime("12am")).toBe("00:00");
    expect(parseTime("12pm")).toBe("12:00");
    expect(parseTime("noon")).toBe("12:00");
    expect(parseTime("08:00")).toBe("08:00");
  });

  it("refuses what isn't a time", () => {
    for (const bad of ["", "soon", "25:00", "4:75", "13pm", "0am"]) expect(parseTime(bad)).toBeNull();
  });

  it("shows times the way guests read them", () => {
    expect(formatTime("16:00")).toBe("4:00 PM");
    expect(formatTime("00:30")).toBe("12:30 AM");
    expect(formatTime("")).toBe("");
  });
});
