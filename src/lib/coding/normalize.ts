export function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

export function outputsMatch(actual: string, expected: string) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
