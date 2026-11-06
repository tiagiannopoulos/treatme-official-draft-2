import { describe, expect, test } from "bun:test";
import { isTreatMeStaff } from "./workspace.functions";
describe("TreatMe staff access", () => {
  test("only exact configured user IDs match", () => {
    expect(isTreatMeStaff("staff-1", "staff-1, staff-2")).toBe(true);
    expect(isTreatMeStaff("staff", "staff-1, staff-2")).toBe(false);
    expect(isTreatMeStaff("staff-1", "")).toBe(false);
    expect(isTreatMeStaff("", "")).toBe(false);
  });
});
