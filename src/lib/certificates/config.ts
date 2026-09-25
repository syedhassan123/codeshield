/**
 * Global fallback pass threshold (percent) used when an Assessment does not
 * define its own `passThreshold`. Configurable via env so ops can tune it
 * without a code change, but requires no setup — defaults to 60%.
 */
export const DEFAULT_CERTIFICATE_PASS_THRESHOLD_PERCENT = (() => {
  const raw = process.env.CERTIFICATE_DEFAULT_PASS_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) return parsed;
  return 60;
})();

/**
 * Single source of truth for "what passing percent issues a certificate".
 * Resolution order: assessment-level override, then the global default.
 * Do not duplicate this logic elsewhere — always resolve through here.
 */
export function resolvePassThreshold(
  assessmentThreshold?: number | null,
): number {
  if (
    typeof assessmentThreshold === "number" &&
    Number.isFinite(assessmentThreshold) &&
    assessmentThreshold >= 0 &&
    assessmentThreshold <= 100
  ) {
    return assessmentThreshold;
  }
  return DEFAULT_CERTIFICATE_PASS_THRESHOLD_PERCENT;
}
