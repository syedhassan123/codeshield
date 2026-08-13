export const SECURITY_EVENT_TYPES = [
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "TAB_SWITCH",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export const SECURITY_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type SecuritySeverity = (typeof SECURITY_SEVERITIES)[number];

export const SECURITY_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type SecurityRiskLevel = (typeof SECURITY_RISK_LEVELS)[number];

/** Leave-style events that often fire together for one user action. */
export const LEAVE_SECURITY_EVENT_TYPES = [
  "TAB_SWITCH",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
] as const;
