import { describe, expect, it } from "vitest";
import { taipeiDay, usable } from "../focus-server";

describe("focus prefetch", () => {
  it("uses Taipei date", () => {
    expect(taipeiDay(new Date("2026-11-01T17:00:00Z"))).toBe("2026-11-02");
  });
  it("ready drill is usable when unused or served today", () => {
    expect(usable({ served_on: null }, "2026-11-02")).toBe(true);
    expect(usable({ served_on: "2026-11-02" }, "2026-11-02")).toBe(true);
    expect(usable({ served_on: "2026-11-01" }, "2026-11-02")).toBe(false);
    expect(usable(null, "2026-11-02")).toBe(false);
  });
});
