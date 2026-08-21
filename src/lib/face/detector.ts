"use client";

import type { FaceDetector as MpFaceDetector } from "@mediapipe/tasks-vision";
import {
  FACE_DETECTOR_MODEL_URL,
  FACE_DETECTOR_WASM_CDN,
} from "@/lib/face/constants";

let detectorPromise: Promise<MpFaceDetector> | null = null;

/**
 * Lazily load MediaPipe FaceDetector (client-side only).
 * Reuses a singleton across hook instances within the same page session.
 */
export async function getFaceDetector(): Promise<MpFaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(FACE_DETECTOR_WASM_CDN);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_DETECTOR_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });
    })();
  }
  return detectorPromise;
}

/** Returns face count, or -1 when the video frame is not ready. */
export function countFacesInVideo(
  detector: MpFaceDetector,
  video: HTMLVideoElement,
  timestampMs: number,
): number {
  return sampleFacePresenceInVideo(detector, video, timestampMs).count;
}

export type FacePresenceSample = {
  count: number;
  avgConfidence: number | null;
};

/** Returns face count and average detector confidence when available. */
export function sampleFacePresenceInVideo(
  detector: MpFaceDetector,
  video: HTMLVideoElement,
  timestampMs: number,
): FacePresenceSample {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return { count: -1, avgConfidence: null };
  }
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    return { count: -1, avgConfidence: null };
  }
  const result = detector.detectForVideo(video, timestampMs);
  const scores = result.detections
    .map((detection) => detection.categories?.[0]?.score)
    .filter((score): score is number => typeof score === "number");
  const avgConfidence =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null;
  return {
    count: result.detections.length,
    avgConfidence,
  };
}

export async function releaseFaceDetector() {
  if (!detectorPromise) return;
  try {
    const detector = await detectorPromise;
    detector.close();
  } catch {
    // ignore teardown errors
  }
  detectorPromise = null;
}
