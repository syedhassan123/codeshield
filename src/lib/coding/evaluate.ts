import { executeInSandbox } from "@/lib/coding/runner";
import { outputsMatch } from "@/lib/coding/normalize";
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

export async function evaluateAgainstTests(options: {
  language: CodingLanguage;
  sourceCode: string;
  tests: EvalTestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  revealOutputs: boolean;
  maxScore: number;
}) {
  const { tests, maxScore } = options;
  const totalWeight =
    tests.reduce((sum, t) => sum + (t.weight && t.weight > 0 ? t.weight : 1), 0) ||
    1;

  const results: CaseEvalResult[] = [];
  let passedWeight = 0;
  let totalTime = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const weight = test.weight && test.weight > 0 ? test.weight : 1;
    const run = await executeInSandbox({
      language: options.language,
      sourceCode: options.sourceCode,
      stdin: test.input,
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
    status:
      passedTests === tests.length
        ? ("accepted" as const)
        : passedTests === 0
          ? ("wrong_answer" as const)
          : ("partial" as const),
  };
}
