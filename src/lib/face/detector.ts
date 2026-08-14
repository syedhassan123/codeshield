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
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return -1;
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return -1;
  const result = detector.detectForVideo(video, timestampMs);
  return result.detections.length;
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
