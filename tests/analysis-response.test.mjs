import assert from "node:assert/strict";
import { test } from "node:test";
import { IncompleteAnalysisError, parseAnalysisResponse } from "../src/lib/analysis-response.ts";
import { MARKER_KEYS } from "../src/lib/skin-analysis.ts";

const allowed = new Set(["hydrafacial", "chemical-peel", "ipl"]);

// Synthetic fixture for response validation only; not a clinical assessment.
function completeResponse() {
  return {
    skinType: "normal",
    fitzpatrick: "IV",
    skinAge: 41,
    markers: Object.fromEntries(
      MARKER_KEYS.map((key, index) => [
        key,
        {
          score: 50 + index,
          note: `synthetic ${key} finding for a validation test`,
          zones: ["forehead"],
          regions: [{ x: 0.4, y: 0.2, r: 0.03, intensity: 0.45 }],
        },
      ]),
    ),
    blurb: "this is synthetic test data for the response validator, not a real skin assessment.",
    strengths: ["synthetic strength"],
    weaknesses: ["synthetic concern"],
    recommendedTreatments: ["hydrafacial", "chemical-peel"],
    photoQuality: "fair",
    medicalFlag: "synthetic provider-review flag",
  };
}

test("complete responses keep their findings, quality and provider-review flag", () => {
  const raw = completeResponse();
  assert.deepEqual(parseAnalysisResponse(raw, allowed), raw);
});

test("empty or incomplete responses cannot turn into successful scans", () => {
  for (const raw of [undefined, null, {}, [], "{}", { markers: {} }]) {
    assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError);
  }
  for (const field of Object.keys(completeResponse())) {
    const raw = completeResponse();
    delete raw[field];
    assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError, field);
  }
});

test("every marker needs a real finite numeric score, without coercion or defaults", () => {
  for (const key of MARKER_KEYS) {
    const missingMarker = completeResponse();
    delete missingMarker.markers[key];
    assert.throws(() => parseAnalysisResponse(missingMarker, allowed), IncompleteAnalysisError);

    for (const score of [undefined, null, "62", NaN, Infinity, -1, 101]) {
      const raw = completeResponse();
      raw.markers[key].score = score;
      assert.throws(
        () => parseAnalysisResponse(raw, allowed),
        IncompleteAnalysisError,
        `${key}: ${score}`,
      );
    }
  }
});

test("empty notes and findings never receive canned observations", () => {
  for (const key of MARKER_KEYS) {
    for (const note of [undefined, "", "   "]) {
      const raw = completeResponse();
      raw.markers[key].note = note;
      assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError);
    }
  }
  for (const field of ["strengths", "weaknesses"]) {
    const raw = completeResponse();
    raw[field] = ["   "];
    assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError);
  }
  const raw = completeResponse();
  raw.blurb = " ".repeat(60);
  assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError);
});

test("invalid photo and skin attributes are rejected instead of guessed", () => {
  for (const [key, value] of [
    ["skinType", "unknown"],
    ["fitzpatrick", "unknown"],
    ["skinAge", null],
    ["skinAge", "30"],
    ["photoQuality", "unknown"],
  ]) {
    const raw = completeResponse();
    raw[key] = value;
    assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError);
  }
});

test("missing or invalid region measurements are not given invented coordinates", () => {
  for (const region of [
    { x: 0.5, y: 0.5 },
    { x: -1, y: 0.2, r: 0.1, intensity: 0.5 },
  ]) {
    const raw = completeResponse();
    raw.markers.redness.regions = [region];
    assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError);
  }
  const raw = completeResponse();
  raw.markers.redness.regions = [];
  raw.markers.redness.zones = [];
  assert.deepEqual(parseAnalysisResponse(raw, allowed).markers.redness.regions, []);
});

test("invalid or duplicate recommendations cannot trigger default procedures", () => {
  for (const slugs of [
    [],
    ["unknown-a", "unknown-b"],
    ["hydrafacial", "unknown"],
    ["ipl", "ipl"],
  ]) {
    const raw = completeResponse();
    raw.recommendedTreatments = slugs;
    assert.throws(() => parseAnalysisResponse(raw, allowed), IncompleteAnalysisError);
  }
});

test("unknown suggestions are removed only when enough valid unique suggestions remain", () => {
  const raw = completeResponse();
  raw.recommendedTreatments = ["ipl", "unknown", "chemical-peel", "ipl"];
  assert.deepEqual(parseAnalysisResponse(raw, allowed).recommendedTreatments, [
    "ipl",
    "chemical-peel",
  ]);
  assert.deepEqual(raw.recommendedTreatments, ["ipl", "unknown", "chemical-peel", "ipl"]);
});
