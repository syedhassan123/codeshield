import { executeInSandbox } from "@/lib/coding/runner";
import { outputsMatch } from "@/lib/coding/normalize";
import { clampStdin } from "@/lib/coding/security";
import { debugLog } from "@/lib/debug";
import type { CodingLanguage } from "@/types/assessment";

export type EvalTestCase = {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  weight?: number;
};

export type CaseEvalResult = {
  index: number;
  passed: boolean;
  status: string;
  timeMs: number;
  message: string;
  /** Only populated for visible runs when safe. */
  stdout?: string;
  weight: number;
};

export type CodingEvalStatus =
  | "accepted"
  | "partial"
  | "wrong_answer"
  | "error"
  | "timeout"
  | "failed";

function mapSubmissionStatus(options: {
  results: CaseEvalResult[];
  passedTests: number;
  totalTests: number;
}): CodingEvalStatus {
  const statuses = options.results.map((r) => r.status);
  if (statuses.some((s) => s === "compile_error")) return "error";
  if (statuses.some((s) => s === "timeout")) return "timeout";
  if (statuses.some((s) => s === "runtime_error" || s === "memory_limit")) {
    return "failed";
  }
  if (options.passedTests === options.totalTests) return "accepted";
  if (options.passedTests === 0) return "wrong_answer";
  return "partial";
}

function skipRemainingCases(
  results: CaseEvalResult[],
  startIndex: number,
  total: number,
  reason: string,
  status: string,
) {
  for (let i = startIndex; i < total; i++) {
    results.push({
      index: i + 1,
      passed: false,
      status,
      timeMs: 0,
      message: reason,
      weight: 1,
    });
  }
}

export async function evaluateAgainstTests(options: {
  language: CodingLanguage;
  sourceCode: string;
  tests: EvalTestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  revealOutputs: boolean;
  maxScore: number;
  /** Test hook only — defaults to isolated sandbox executor. */
  execute?: typeof executeInSandbox;
}) {
  const { tests, maxScore } = options;
  const runInSandbox = options.execute ?? executeInSandbox;
  const totalWeight =
    tests.reduce((sum, t) => sum + (t.weight && t.weight > 0 ? t.weight : 1), 0) ||
    1;

  const results: CaseEvalResult[] = [];
  let passedWeight = 0;
  let totalTime = 0;
  let stoppedEarly = false;

  for (let i = 0; i < tests.length; i++) {
    if (stoppedEarly) break;

    const test = tests[i];
    const weight = test.weight && test.weight > 0 ? test.weight : 1;
    const run = await runInSandbox({
      language: options.language,
      sourceCode: options.sourceCode,
      stdin: clampStdin(test.input),
      timeLimitMs: options.timeLimitMs,
      memoryLimitMb: options.memoryLimitMb,
    });

    totalTime += run.timeMs;
    const passed =
      run.status === "accepted" &&
      outputsMatch(run.stdout, test.expectedOutput);

    if (passed) passedWeight += weight;

    const message = passed
      ? "Passed"
      : run.message ||
        (run.status === "accepted" ? "Wrong answer" : run.status.replace("_", " "));

    results.push({
      index: i + 1,
      passed,
      status: passed ? "passed" : run.status,
      timeMs: run.timeMs,
      message,
      stdout: options.revealOutputs ? run.stdout.slice(0, 4000) : undefined,
      weight,
    });

    if (run.status === "compile_error") {
      skipRemainingCases(
        results,
        i + 1,
        tests.length,
        "Skipped after compilation error.",
        "compile_error",
      );
      stoppedEarly = true;
    }
  }

  const score = Math.round((passedWeight / totalWeight) * maxScore);
  const passedTests = results.filter((r) => r.passed).length;

  debugLog("TEST-CASE", `${passedTests}/${tests.length} passed`, {
    score,
    maxScore,
    revealOutputs: options.revealOutputs,
  });
  debugLog("SCORE", "coding_calculated", { score, maxScore });

  return {
    results,
    passedTests,
    totalTests: tests.length,
    score,
    maxScore,
    executionTimeMs: totalTime,
    status: mapSubmissionStatus({
      results,
      passedTests,
      totalTests: tests.length,
    }),
  };
}
