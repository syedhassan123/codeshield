/**
 * Eye-gaze estimator constants.
 * INITIAL / UNVALIDATED — not production-calibrated thresholds.
 * Kept separate from head-pose warning timing constants.
 */

/** Expected Face Landmarker landmark count (468 mesh + 10 iris). */
export const EYE_GAZE_EXPECTED_LANDMARK_COUNT = 478;

/** Minimum eye width (normalized image units) before geometry is unusable. */
export const EYE_GAZE_MIN_EYE_WIDTH = 0.012;

/** Minimum eye height (normalized image units) before geometry is unusable. */
export const EYE_GAZE_MIN_EYE_HEIGHT = 0.004;

/**
 * Wide CENTER band for horizontal fused ratio (image-space).
 * INITIAL / UNVALIDATED — intentionally tolerant for screen scanning.
 */
export const EYE_GAZE_HORIZONTAL_CENTER_MIN = 0.35;
export const EYE_GAZE_HORIZONTAL_CENTER_MAX = 0.65;

/**
 * Vertical fused ratio above this → DOWN (image y increases downward).
 * INITIAL / UNVALIDATED.
 */
export const EYE_GAZE_DOWN_THRESHOLD = 0.68;

/** Heuristic confidence below this → force UNKNOWN. INITIAL / UNVALIDATED. */
export const EYE_GAZE_MIN_CONFIDENCE = 0.35;

/**
 * Absolute difference between left/right eye horizontal ratios that forces UNKNOWN.
 * INITIAL / UNVALIDATED.
 */
export const EYE_GAZE_EYE_DISAGREE_MAX = 0.22;

/**
 * |head yaw| (degrees) above which confidence is reduced / often UNKNOWN.
 * INITIAL / UNVALIDATED — reuses head monitoring angle units, not warning timers.
 */
export const EYE_GAZE_EXTREME_YAW_DEG = 35;

/** |head pitch| (degrees) extreme gate. INITIAL / UNVALIDATED. */
export const EYE_GAZE_EXTREME_PITCH_DEG = 30;

/** Soft confidence penalty starts above this |yaw|. INITIAL / UNVALIDATED. */
export const EYE_GAZE_SOFT_YAW_DEG = 18;

/**
 * Rolling window size for temporal smoothing (~500ms cadence → ~2–3s).
 * INITIAL / UNVALIDATED.
 */
export const EYE_GAZE_SMOOTH_WINDOW = 5;

/** Minimum agreeing samples in the window to change stable direction. */
export const EYE_GAZE_SMOOTH_MIN_AGREEMENT = 3;

/** Minimum landmark visibility when the field is present. */
export const EYE_GAZE_MIN_VISIBILITY = 0.4;

/**
 * First eye-gaze warning after a sustained stable away episode (ms).
 * Independent of head-pose HEAD_WARNING_THRESHOLD_MS.
 */
export const EYE_GAZE_WARNING_THRESHOLD_MS = 5_000;

/**
 * Prolonged eye-gaze warning after a sustained stable away episode (ms).
 * Independent of head-pose HEAD_PROLONGED_THRESHOLD_MS.
 */
export const EYE_GAZE_PROLONGED_THRESHOLD_MS = 10_000;

/** Client cooldown between persisted eye-gaze observation events (ms). */
export const EYE_GAZE_EVENT_COOLDOWN_MS = 5_000;
