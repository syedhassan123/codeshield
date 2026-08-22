/**
 * Isolated code execution adapter.
 *
 * NEVER runs student code inside the Next.js process.
 * Supports:
 * - Judge0 CE / RapidAPI / self-hosted Judge0 (default)
 * - Self-hosted or authorized Piston instance
 *
 * Env:
 *   CODE_RUNNER_PROVIDER=judge0|piston
 *   JUDGE0_URL=https://ce.judge0.com
 *   JUDGE0_API_KEY= (optional RapidAPI / X-Auth-Token)
 *   JUDGE0_AUTH_HEADER=X-Auth-Token|X-RapidAPI-Key
 *   PISTON_URL=http://localhost:2000
 *   PISTON_API_KEY= (optional Authorization bearer)
 */

import { debugError, debugLog } from "@/lib/debug";
import {
  CODING_RUNNER_HTTP_TIMEOUT_MS,
} from "@/lib/coding/config";
import {
  clampRunnerOutput,
  sanitizeStudentExecutionMessage,
} from "@/lib/coding/security";
import type { CodingLanguage } from "@/types/assessment";

export type RunnerExecuteInput = {
  language: CodingLanguage;
  sourceCode: string;
  stdin: string;
  timeLimitMs: number;
  memoryLimitMb: number;
};

export type RunnerExecuteResult = {
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number | null;
  signal: string | null;
  timeMs: number;
  memoryKb: number | null;
  status:
    | "accepted"
    | "wrong_answer"
    | "runtime_error"
    | "compile_error"
    | "timeout"
    | "memory_limit"
    | "internal_error";
  message: string;
};

const JUDGE0_LANG: Record<CodingLanguage, number> = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
};

const PISTON_LANG: Record<
  CodingLanguage,
  { language: string; version: string; file: string }
> = {
  python: { language: "python", version: "3.10.0", file: "main.py" },
  javascript: { language: "javascript", version: "18.15.0", file: "main.js" },
  java: { language: "java", version: "15.0.2", file: "Main.java" },
  cpp: { language: "c++", version: "10.2.0", file: "main.cpp" },
};

function provider() {
  return (process.env.CODE_RUNNER_PROVIDER || "judge0").toLowerCase();
}

export async function executeInSandbox(
  input: RunnerExecuteInput,
): Promise<RunnerExecuteResult> {
  const startedAt = Date.now();

  if (!input.sourceCode.trim()) {
    return {
      stdout: "",
      stderr: "",
      compileOutput: "",
      exitCode: null,
      signal: null,
      timeMs: 0,
      memoryKb: null,
      status: "internal_error",
      message: "Source code is empty.",
    };
  }

  try {
    const result =
      provider() === "piston"
        ? await executePiston(input)
        : await executeJudge0(input);

    debugLog("CODE-RUNNER", "execute", {
      provider: provider(),
      language: input.language,
      status: result.status,
      timeMs: result.timeMs || Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    debugError("CODE_RUNNER_FAILED", error, {
      provider: provider(),
      language: input.language,
      duration: `${Date.now() - startedAt}ms`,
    });
    return {
      stdout: "",
      stderr: "",
      compileOutput: "",
      exitCode: null,
      signal: null,
      timeMs: 0,
      memoryKb: null,
      status: "internal_error",
      message:
        "Code runner is unavailable. Configure JUDGE0_URL or a self-hosted Piston instance.",
    };
  }
}

async function executeJudge0(
  input: RunnerExecuteInput,
): Promise<RunnerExecuteResult> {
  const base = (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(
    /\/$/,
    "",
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.JUDGE0_API_KEY;
  if (apiKey) {
    const headerName = process.env.JUDGE0_AUTH_HEADER || "X-Auth-Token";
    headers[headerName] = apiKey;
    if (headerName === "X-RapidAPI-Key") {
      headers["X-RapidAPI-Host"] =
        process.env.JUDGE0_RAPIDAPI_HOST || "judge0-ce.p.rapidapi.com";
    }
  }

  const cpuLimit = Math.max(1, Math.ceil(input.timeLimitMs / 1000));
  const body = {
    source_code: input.sourceCode,
    language_id: JUDGE0_LANG[input.language],
    stdin: input.stdin,
    cpu_time_limit: cpuLimit,
    wall_time_limit: cpuLimit + 1,
    memory_limit: Math.max(20480, input.memoryLimitMb * 1024),
    max_output_size: 65536,
    enable_network: false,
  };

  const url = `${base}/submissions?base64_encoded=false&wait=true`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    CODING_RUNNER_HTTP_TIMEOUT_MS + input.timeLimitMs,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Judge0 HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    message?: string | null;
    time?: string | null;
    memory?: number | null;
    status?: { id?: number; description?: string };
  };

  const statusId = data.status?.id ?? 13;
  const timeMs = Math.round(Number(data.time || 0) * 1000);
  const stdout = clampRunnerOutput(data.stdout || "");
  const stderr = clampRunnerOutput(data.stderr || "");
  const compileOutput = clampRunnerOutput(data.compile_output || "");

  // Judge0 status ids: 3 accepted, 4 wrong answer, 5 TLE, 6 CE, 7+ RE, 13 IE, etc.
  let status: RunnerExecuteResult["status"] = "internal_error";
  if (statusId === 3) status = "accepted";
  else if (statusId === 4) status = "wrong_answer";
  else if (statusId === 5) status = "timeout";
  else if (statusId === 6) status = "compile_error";
  else if (statusId === 7 || statusId === 8 || statusId === 9 || statusId === 10 || statusId === 11 || statusId === 12)
    status = "runtime_error";
  else if (String(data.status?.description || "").toLowerCase().includes("memory"))
    status = "memory_limit";

  return {
    stdout,
    stderr,
    compileOutput,
    exitCode: statusId === 3 ? 0 : statusId,
    signal: null,
    timeMs,
    memoryKb: data.memory ?? null,
    status,
    message: safeRunnerMessage(status, data.message || data.status?.description || ""),
  };
}

async function executePiston(
  input: RunnerExecuteInput,
): Promise<RunnerExecuteResult> {
  const base = (process.env.PISTON_URL || "http://localhost:2000").replace(
    /\/$/,
    "",
  );
  const meta = PISTON_LANG[input.language];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.PISTON_API_KEY) {
    headers.Authorization = `Bearer ${process.env.PISTON_API_KEY}`;
  }

  const res = await fetchWithTimeout(
    `${base}/api/v2/execute`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        language: meta.language,
        version: meta.version,
        files: [{ name: meta.file, content: input.sourceCode }],
        stdin: input.stdin,
        run_timeout: input.timeLimitMs,
        run_memory_limit: input.memoryLimitMb * 1024 * 1024,
      }),
    },
    CODING_RUNNER_HTTP_TIMEOUT_MS + input.timeLimitMs,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Piston HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    run?: {
      stdout?: string;
      stderr?: string;
      code?: number | null;
      signal?: string | null;
      output?: string;
    };
    compile?: {
      stdout?: string;
      stderr?: string;
      code?: number | null;
      signal?: string | null;
    };
  };

  const compileFail =
    data.compile &&
    ((data.compile.code != null && data.compile.code !== 0) ||
      Boolean(data.compile.signal));
  if (compileFail) {
    return {
      stdout: "",
      stderr: data.compile?.stderr || "",
      compileOutput: data.compile?.stderr || data.compile?.stdout || "",
      exitCode: data.compile?.code ?? null,
      signal: data.compile?.signal ?? null,
      timeMs: 0,
      memoryKb: null,
      status: "compile_error",
      message: "Compilation failed.",
    };
  }

  const run = data.run || {};
  const signal = run.signal || null;
  const code = run.code ?? null;
  let status: RunnerExecuteResult["status"] = "accepted";
  if (signal === "SIGKILL" || signal === "SIGXCPU") status = "timeout";
  else if (signal) status = "runtime_error";
  else if (code != null && code !== 0) status = "runtime_error";

  return {
    stdout: clampRunnerOutput(run.stdout || ""),
    stderr: clampRunnerOutput(run.stderr || ""),
    compileOutput: "",
    exitCode: code,
    signal,
    timeMs: 0,
    memoryKb: null,
    status,
    message: safeRunnerMessage(status, run.stderr || ""),
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Code runner request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function safeRunnerMessage(
  status: RunnerExecuteResult["status"],
  raw: string,
) {
  const trimmed = sanitizeStudentExecutionMessage(raw);
  switch (status) {
    case "timeout":
      return "Time limit exceeded.";
    case "memory_limit":
      return "Memory limit exceeded.";
    case "compile_error":
      return trimmed || "Compilation error.";
    case "runtime_error":
      return trimmed || "Runtime error.";
    case "internal_error":
      return "Execution is temporarily unavailable. Try again shortly.";
    default:
      return "";
  }
}
