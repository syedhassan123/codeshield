export const DEFAULT_ASSESSMENT_SECURITY = {
  requireCamera: false,
  requireFullscreen: true,
  blockCopyPaste: true,
  monitorTabSwitching: true,
  requireFaceDetection: false,
  requireHeadMonitoring: false,
} as const;

export type AssessmentSecuritySettings = {
  requireCamera: boolean;
  requireFullscreen: boolean;
  blockCopyPaste: boolean;
  monitorTabSwitching: boolean;
  requireFaceDetection: boolean;
  requireHeadMonitoring: boolean;
};

/** Normalize legacy assessments that predate security settings. */
export function normalizeAssessmentSecurity(
  raw?: Partial<AssessmentSecuritySettings> | null,
): AssessmentSecuritySettings {
  const requireHeadMonitoring =
    raw?.requireHeadMonitoring ??
    DEFAULT_ASSESSMENT_SECURITY.requireHeadMonitoring;
  const requireFaceDetection =
    requireHeadMonitoring
      ? true
      : (raw?.requireFaceDetection ??
        DEFAULT_ASSESSMENT_SECURITY.requireFaceDetection);
  const requireCamera =
    raw?.requireCamera ?? DEFAULT_ASSESSMENT_SECURITY.requireCamera;

  return {
    requireCamera: requireFaceDetection ? true : requireCamera,
    requireFullscreen:
      raw?.requireFullscreen ?? DEFAULT_ASSESSMENT_SECURITY.requireFullscreen,
    blockCopyPaste:
      raw?.blockCopyPaste ?? DEFAULT_ASSESSMENT_SECURITY.blockCopyPaste,
    monitorTabSwitching:
      raw?.monitorTabSwitching ??
      DEFAULT_ASSESSMENT_SECURITY.monitorTabSwitching,
    requireFaceDetection,
    requireHeadMonitoring,
  };
}
