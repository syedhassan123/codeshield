import { ActionError } from "@/lib/auth-guards";
import {
  CODING_MAX_OUTPUT_CHARS,
  CODING_MAX_SOURCE_CHARS,
  CODING_MAX_STDIN_CHARS,
} from "@/lib/coding/config";

const SENSITIVE_PATTERNS = [
  /mongodb(\+srv)?:\/\/[^\s'"]+/gi,
  /MONGODB_URI[^\s'"]*/gi,
  /AUTH_SECRET[^\s'"]*/gi,
  /DATABASE_URL[^\s'"]*/gi,
  /\/Users\/[^\s'"]+/gi,
  /\/home\/[^\s'"]+/gi,
  /C:\\Users\\[^\s'"]+/gi,
  /node_modules[^\s'"]*/gi,
  /\.env(\.local)?[^\s'"]*/gi,
  /docker daemon[^\n]*/gi,
  /spawn ENOENT[^\n]*/gi,
];

/** Reject oversized or malformed source before it reaches the runner. */
export function assertValidCodingSource(sourceCode: string) {
  if (!sourceCode.trim()) {
    throw new ActionError("Source code is empty.");
  }
  if (sourceCode.length > CODING_MAX_SOURCE_CHARS) {
    throw new ActionError(
      `Source code exceeds ${CODING_MAX_SOURCE_CHARS.toLocaleString()} characters.`,
    );
  }
  if (sourceCode.includes("\0")) {
    throw new ActionError("Source code contains invalid characters.");
  }
}

export function clampStdin(stdin: string) {
  if (stdin.length <= CODING_MAX_STDIN_CHARS) return stdin;
  return stdin.slice(0, CODING_MAX_STDIN_CHARS);
}

export function clampRunnerOutput(value: string) {
  if (value.length <= CODING_MAX_OUTPUT_CHARS) return value;
  return `${value.slice(0, CODING_MAX_OUTPUT_CHARS)}\n… (output truncated)`;
}

/** Strip infrastructure details from messages shown to students. */
export function sanitizeStudentExecutionMessage(raw: string) {
  let message = raw.slice(0, 500).trim();
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, "[redacted]");
  }
  return message || "Execution failed.";
}
