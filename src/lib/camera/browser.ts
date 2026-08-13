/**
 * Browser camera helpers (no AI).
 * Microphone is intentionally not requested in Phase 7.
 */

export type CameraDeviceOption = {
  deviceId: string;
  label: string;
};

export function pickSupportedRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export async function listVideoInputDevices(): Promise<CameraDeviceOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error("This browser does not support camera device listing.");
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${i + 1}`,
    }));
}

export async function openCameraStream(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support camera access.");
  }
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}

export function classifyCameraError(error: unknown): {
  code: "PERMISSION_DENIED" | "UNAVAILABLE" | "UNSUPPORTED" | "UNKNOWN";
  message: string;
} {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: string }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      code: "PERMISSION_DENIED",
      message:
        "Camera access was denied. Please allow camera permission and try again.",
    };
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  ) {
    return {
      code: "UNAVAILABLE",
      message:
        "No usable camera was found. Connect a webcam and try again.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      code: "UNAVAILABLE",
      message:
        "Camera is busy or unavailable. Close other apps using the camera and retry.",
    };
  }
  if (error instanceof Error && /does not support/i.test(error.message)) {
    return { code: "UNSUPPORTED", message: error.message };
  }
  return {
    code: "UNKNOWN",
    message:
      error instanceof Error
        ? error.message
        : "Camera could not be started. Please try again.",
  };
}
