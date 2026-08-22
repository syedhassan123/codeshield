import type { CodingLanguage } from "@/types/assessment";

/** Max student source length (must match server action schema). */
export const CODING_MAX_SOURCE_CHARS = 100_000;

/** Max stdin bytes per test case sent to the runner. */
export const CODING_MAX_STDIN_CHARS = 64_000;

/** Max stdout/stderr captured per execution (chars). */
export const CODING_MAX_OUTPUT_CHARS = 65_536;

/** Wall-clock timeout for runner HTTP calls (ms), plus per-test CPU limit. */
export const CODING_RUNNER_HTTP_TIMEOUT_MS = 45_000;

/** Minimum gap between Run requests for the same attempt/question (ms). */
export const CODING_RUN_COOLDOWN_MS = 750;

/** Pinned runtime versions — avoid "latest" drift across environments. */
export const CODING_RUNTIME_VERSIONS: Record<CodingLanguage, string> = {
  python: "3.10+ (Judge0 id 71 / Piston 3.10.0)",
  javascript: "Node 18+ (Judge0 id 63 / Piston 18.15.0)",
  java: "OpenJDK 15 (Judge0 id 62 / Piston 15.0.2)",
  cpp: "GCC 10 (Judge0 id 54 / Piston 10.2.0)",
};
