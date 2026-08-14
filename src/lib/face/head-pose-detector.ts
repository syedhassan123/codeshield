"use client";

import type { FaceLandmarker as MpFaceLandmarker } from "@mediapipe/tasks-vision";
import { FACE_DETECTOR_WASM_CDN } from "@/lib/face/constants";
import { FACE_LANDMARKER_MODEL_URL } from "@/lib/face/head-pose-constants";
import {
  anglesFromFacialMatrix,
  classifyHeadOrientation,
  type HeadOrientation,
  type HeadPoseAngles,
} from "@/lib/face/head-pose-orientation";

export type HeadPoseSample = {
  orientation: HeadOrientation;
  angles: HeadPoseAngles | null;
  faceCount: number;
};

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
    return { orientation: "NORMAL", angles: null, faceCount };
  }

  const matrix = result.facialTransformationMatrixes?.[0];
  const angles = matrix?.data ? anglesFromFacialMatrix(matrix.data) : null;
  const orientation = angles ? classifyHeadOrientation(angles) : "NORMAL";

  return { orientation, angles, faceCount };
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
