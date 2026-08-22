/**
 * Phase 12 — Coding execution & security hardening checks.
 * Run: npx tsx --env-file=.env.local scripts/verify-phase12-coding.ts
 */
import fs from "node:fs";
import path from "node:path";
import { CODING_LANGUAGES } from "../src/types/assessment";
import { CODING_RUNTIME_VERSIONS } from "../src/lib/coding/config";
import {
  assertValidCodingSource,
  clampRunnerOutput,
  clampStdin,
  sanitizeStudentExecutionMessage,
} from "../src/lib/coding/security";
import { normalizeOutput, outputsMatch } from "../src/lib/coding/normalize";
import { evaluateAgainstTests } from "../src/lib/coding/evaluate";
import {
  executeInSandbox,
  type RunnerExecuteInput,
  type RunnerExecuteResult,
} from "../src/lib/coding/runner";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function testNormalization() {
  assert(normalizeOutput("5\r\n") === "5", "normalize CRLF trailing newline");
  assert(outputsMatch("5\n", "5"), "outputsMatch trims trailing newline");
  assert(!outputsMatch("5", "6"), "outputsMatch rejects wrong answer");
}

function testSecurityHelpers() {
  assertValidCodingSource("print(1)");
  let threw = false;
  try {
    assertValidCodingSource("");
  } catch {
    threw = true;
  }
  assert(threw, "empty source rejected");

  threw = false;
  try {
    assertValidCodingSource("x".repeat(100_001));
  } catch {
    threw = true;
  }
  assert(threw, "oversized source rejected");

  assert(clampStdin("abc").length === 3, "clampStdin passes small input");
  assert(
    clampRunnerOutput("a".repeat(70_000)).includes("truncated"),
    "clampRunnerOutput truncates large stdout",
  );

  const sanitized = sanitizeStudentExecutionMessage(
    "Error at /Users/student/app MONGODB_URI=mongodb://secret",
  );
  assert(!sanitized.includes("mongodb://"), "sanitize removes mongo URI");
  assert(!sanitized.includes("/Users/"), "sanitize removes filesystem paths");
}

function testStaticArchitecture() {
  const runnerSrc = read("src/lib/coding/runner.ts");
  assert(!runnerSrc.includes("child_process"), "runner does not use child_process");
  assert(!runnerSrc.includes("eval("), "runner does not use eval");
  assert(runnerSrc.includes("enable_network: false"), "Judge0 network disabled");

  const actionsSrc = read("src/lib/actions/coding.ts");
  assert(actionsSrc.includes("requireStudent"), "coding actions require student");
  assert(actionsSrc.includes("getOwnedAttempt"), "attempt ownership enforced");
  assert(actionsSrc.includes("loadCodingContext"), "loadCodingContext validates access");
  assert(
    actionsSrc.includes('kind: "submit"') && actionsSrc.includes("finalized: true"),
    "submit uses finalized submit records",
  );
  assert(actionsSrc.includes("revealOutputs: false"), "submit evaluation hides outputs");

  const evaluateSrc = read("src/lib/coding/evaluate.ts");
  assert(
    evaluateSrc.includes("compile_error"),
    "compile errors short-circuit remaining tests",
  );

  const panelSrc = read("src/components/exam/exam-coding-panel.tsx");
  assert(panelSrc.includes("runInflight"), "UI guards duplicate run execution");
  assert(panelSrc.includes("submitInflight"), "UI guards duplicate submit execution");
}

function testLanguagesConfigured() {
  for (const lang of CODING_LANGUAGES) {
    assert(CODING_RUNTIME_VERSIONS[lang], `runtime version documented for ${lang}`);
  }
}

async function mockExecute(
  input: RunnerExecuteInput,
): Promise<RunnerExecuteResult> {
  if (input.sourceCode.includes("COMPILE_FAIL")) {
    return {
      stdout: "",
      stderr: "syntax error",
      compileOutput: "syntax error",
      exitCode: 1,
      signal: null,
      timeMs: 1,
      memoryKb: null,
      status: "compile_error",
      message: "Compilation error.",
    };
  }
  if (input.sourceCode.includes("INFINITE")) {
    return {
      stdout: "",
      stderr: "",
      compileOutput: "",
      exitCode: null,
      signal: "SIGKILL",
      timeMs: 3000,
      memoryKb: null,
      status: "timeout",
      message: "Time limit exceeded.",
    };
  }
  if (input.sourceCode.includes("RUNTIME")) {
    return {
      stdout: "",
      stderr: "Traceback",
      compileOutput: "",
      exitCode: 1,
      signal: null,
      timeMs: 2,
      memoryKb: null,
      status: "runtime_error",
      message: "Runtime error.",
    };
  }
  const parts = input.stdin.trim().split(/\s+/).map(Number);
  const sum = parts.reduce((a, b) => a + b, 0);
  return {
    stdout: String(sum),
    stderr: "",
    compileOutput: "",
    exitCode: 0,
    signal: null,
    timeMs: 5,
    memoryKb: 128,
    status: "accepted",
    message: "",
  };
}

async function testEvaluateWithMockedRunner() {
  let callCount = 0;
  const countingExecute: typeof executeInSandbox = async (input) => {
    callCount += 1;
    return mockExecute(input);
  };

  const passEval = await evaluateAgainstTests({
    language: "python",
    sourceCode: "print(sum)",
    tests: [
      { input: "2 3", expectedOutput: "5", weight: 1 },
      { input: "1 1", expectedOutput: "2", weight: 1 },
    ],
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    revealOutputs: true,
    maxScore: 10,
    execute: countingExecute,
  });
  assert(passEval.passedTests === 2, "correct code passes all tests");
  assert(passEval.score === 10, "full score on all pass");
  assert(passEval.status === "accepted", "status accepted when all pass");

  const failEval = await evaluateAgainstTests({
    language: "python",
    sourceCode: "print(sum)",
    tests: [{ input: "2 3", expectedOutput: "99", weight: 1 }],
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    revealOutputs: false,
    maxScore: 10,
    execute: countingExecute,
  });
  assert(failEval.passedTests === 0, "wrong output fails");
  assert(failEval.status === "wrong_answer", "wrong answer status");

  callCount = 0;
  const compileEval = await evaluateAgainstTests({
    language: "python",
    sourceCode: "COMPILE_FAIL",
    tests: [
      { input: "1", expectedOutput: "1", weight: 1 },
      { input: "2", expectedOutput: "2", weight: 1 },
    ],
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    revealOutputs: false,
    maxScore: 10,
    execute: countingExecute,
  });
  assert(compileEval.status === "error", "compile error maps to error status");
  assert(compileEval.results.length === 2, "remaining tests marked after compile fail");
  assert(callCount === 1, "compile error stops extra sandbox calls after first");

  const timeoutEval = await evaluateAgainstTests({
    language: "python",
    sourceCode: "INFINITE",
    tests: [{ input: "", expectedOutput: "", weight: 1 }],
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    revealOutputs: false,
    maxScore: 5,
    execute: countingExecute,
  });
  assert(timeoutEval.status === "timeout", "timeout status propagated");

  const runtimeEval = await evaluateAgainstTests({
    language: "python",
    sourceCode: "RUNTIME",
    tests: [{ input: "", expectedOutput: "", weight: 1 }],
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    revealOutputs: false,
    maxScore: 5,
    execute: countingExecute,
  });
  assert(runtimeEval.status === "failed", "runtime error maps to failed status");
}

async function testLiveRunnerOptional() {
  if (process.env.PHASE12_LIVE_RUNNER !== "1") {
    console.log(
      "SKIP: live runner integration (set PHASE12_LIVE_RUNNER=1 to enable)",
    );
    return;
  }

  const add = await executeInSandbox({
    language: "python",
    sourceCode: "a,b=map(int,input().split()); print(a+b)",
    stdin: "2 3\n",
    timeLimitMs: 3000,
    memoryLimitMb: 256,
  });
  assert(add.status === "accepted", "live runner executes simple python");
  assert(outputsMatch(add.stdout, "5"), "live runner stdout correct");

  const loop = await executeInSandbox({
    language: "python",
    sourceCode: "while True: pass",
    stdin: "",
    timeLimitMs: 1000,
    memoryLimitMb: 128,
  });
  assert(loop.status === "timeout", "live runner times out infinite loop");
}

async function main() {
  testNormalization();
  testSecurityHelpers();
  testStaticArchitecture();
  testLanguagesConfigured();
  await testEvaluateWithMockedRunner();
  await testLiveRunnerOptional();

  console.log("\nPhase 12 coding execution & security checks passed.");
  console.log(
    "Production: use self-hosted Judge0 or Piston — never execute student code in Next.js.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
