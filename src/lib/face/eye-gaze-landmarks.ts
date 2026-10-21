/**
 * MediaPipe Face Landmarker / Face Mesh landmark indices used for eye gaze.
 * Confirmed against MediaPipe FACE_LANDMARKS_* connection topology
 * (iris rings 468–477; eye contours including corners).
 *
 * Naming follows MediaPipe subject-relative left/right (subject's anatomy),
 * not the viewer's left/right on a mirrored selfie.
 */

/** Subject's right eye (image often appears on the left under selfie mirror). */
export const RIGHT_EYE = {
  outer: 33,
  inner: 133,
  upper: 159,
  lower: 145,
  irisCenter: 468,
  irisRing: [469, 470, 471, 472] as const,
} as const;

/** Subject's left eye. */
export const LEFT_EYE = {
  outer: 263,
  inner: 362,
  upper: 386,
  lower: 374,
  irisCenter: 473,
  irisRing: [474, 475, 476, 477] as const,
} as const;

export const EYE_GAZE_REQUIRED_INDICES = [
  RIGHT_EYE.outer,
  RIGHT_EYE.inner,
  RIGHT_EYE.upper,
  RIGHT_EYE.lower,
  RIGHT_EYE.irisCenter,
  ...RIGHT_EYE.irisRing,
  LEFT_EYE.outer,
  LEFT_EYE.inner,
  LEFT_EYE.upper,
  LEFT_EYE.lower,
  LEFT_EYE.irisCenter,
  ...LEFT_EYE.irisRing,
] as const;
