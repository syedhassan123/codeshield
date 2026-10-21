"use client";

import type { FaceLandmarker as MpFaceLandmarker } from "@mediapipe/tasks-vision";
import { FACE_DETECTOR_WASM_CDN } from "@/lib/face/constants";
import { estimateEyeGaze } from "@/lib/face/eye-gaze-estimator";
import { EYE_GAZE_EXPECTED_LANDMARK_COUNT } from "@/lib/face/eye-gaze-constants";
import { FACE_LANDMARKER_MODEL_URL } from "@/lib/face/head-pose-constants";
import {
  classifyHeadOrientation,
  headMonitoringAnglesFromFacialMatrix,
  type HeadOrientation,
  type HeadPoseAngles,
} from "@/lib/face/head-pose-orientation";
import type { EyeGazeEstimate } from "@/types/eye-gaze";

export type HeadPoseSample = {
  orientation: HeadOrientation;
  angles: HeadPoseAngles | null;
  faceCount: number;
  /** Same-frame geometric eye-gaze estimate (telemetry only). */
  eyeGaze: EyeGazeEstimate | null;
  landmarkCount: number;
};

let landmarkCountLogged = false;

let landmarkerPromise: Promise<MpFaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<MpFaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(FACE_DETECTOR_WASM_CDN);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return landmarkerPromise;
}

export function sampleHeadPoseFromVideo(
  landmarker: MpFaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): HeadPoseSample | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

  const result = landmarker.detectForVideo(video, timestampMs);
  const faceCount = result.faceLandmarks.length;

  if (faceCount !== 1) {
    return {
      orientation: "NORMAL",
      angles: null,
      faceCount,
      eyeGaze: null,
      landmarkCount: 0,
    };
  }

  const landmarks = result.faceLandmarks[0] ?? [];
  const landmarkCount = landmarks.length;

  if (
    process.env.NODE_ENV === "development" &&
    !landmarkCountLogged &&
    landmarkCount > 0
  ) {
    landmarkCountLogged = true;
    console.log(
      `[EYE-GAZE] landmarkCount expected=${EYE_GAZE_EXPECTED_LANDMARK_COUNT} actual=${landmarkCount}`,
    );
  }

  const matrix = result.facialTransformationMatrixes?.[0];
  const matrixData = matrix?.data;
  const angles =
    matrixData && matrixData.length >= 16
      ? headMonitoringAnglesFromFacialMatrix(
          Array.isArray(matrixData) ? matrixData : Array.from(matrixData),
        )
      : null;
  const orientation = angles ? classifyHeadOrientation(angles) : "NORMAL";

  const eyeGaze = estimateEyeGaze({
    landmarks,
    headYaw: angles?.yaw ?? null,
    headPitch: angles?.pitch ?? null,
  });

  return { orientation, angles, faceCount, eyeGaze, landmarkCount };
}

export async function releaseFaceLandmarker() {
  if (!landmarkerPromise) return;
  try {
    const landmarker = await landmarkerPromise;
    landmarker.close();
  } catch {
    // ignore teardown errors
  }
  landmarkerPromise = null;
}
