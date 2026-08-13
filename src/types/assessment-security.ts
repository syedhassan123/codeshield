export const DEFAULT_ASSESSMENT_SECURITY = {
  requireCamera: false,
  requireFullscreen: true,
  blockCopyPaste: true,
  monitorTabSwitching: true,
} as const;

export type AssessmentSecuritySettings = {
  requireCamera: boolean;
  requireFullscreen: boolean;
  blockCopyPaste: boolean;
  monitorTabSwitching: boolean;
};

/** Normalize legacy assessments that predate security settings. */
export function normalizeAssessmentSecurity(
  raw?: Partial<AssessmentSecuritySettings> | null,
): AssessmentSecuritySettings {
  return {
    requireCamera: raw?.requireCamera ?? DEFAULT_ASSESSMENT_SECURITY.requireCamera,
    requireFullscreen:
      raw?.requireFullscreen ?? DEFAULT_ASSESSMENT_SECURITY.requireFullscreen,
    blockCopyPaste:
      raw?.blockCopyPaste ?? DEFAULT_ASSESSMENT_SECURITY.blockCopyPaste,
    monitorTabSwitching:
      raw?.monitorTabSwitching ??
      DEFAULT_ASSESSMENT_SECURITY.monitorTabSwitching,
  };
}
