/**
 * the one switch. flip to "api" once the real endpoint is live.
 * nothing outside src/lib/skinAnalysis may read this.
 */
export const ANALYSIS_PROVIDER: "mock" | "api" = "mock";

/** endpoint the api provider will call once it exists */
export const ANALYSIS_ENDPOINT = "/api/public/analyze";

/** confidence floor for a concern to be trusted downstream */
export const MIN_CONFIDENCE = 0.7;

/** how long the analysis animation runs, ms */
export const ANALYSIS_MIN_MS = 3400;

/** hidden dev override: force a specific concern set */
export const DEV_FORCE_KEY = "treatme.dev.forceConcerns";
