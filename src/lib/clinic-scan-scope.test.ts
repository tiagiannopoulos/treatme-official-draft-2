import { expect, test } from "bun:test";
import { verifiedClinicTreatmentSlugs } from "./clinic-scan-scope";

test("branded suggestions include only clinic-confirmed services", () => {
  expect(verifiedClinicTreatmentSlugs([
    { slug: "microneedling", verified: true },
    { slug: "laser", verified: false },
    { slug: "microneedling", verified: true },
    { slug: "", verified: true },
  ])).toEqual(["microneedling"]);
});

test("a clinic with no verified service never inherits the general catalogue", () => {
  expect(verifiedClinicTreatmentSlugs([{ slug: "fillers", verified: false }])).toEqual([]);
  expect(verifiedClinicTreatmentSlugs(null)).toEqual([]);
  expect(verifiedClinicTreatmentSlugs(undefined)).toEqual([]);
});
