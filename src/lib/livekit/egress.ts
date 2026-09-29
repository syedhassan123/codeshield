import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EgressStatus,
  RoomServiceClient,
  S3Upload,
} from "livekit-server-sdk";
import {
  getLiveKitConfig,
  getLiveKitHttpHost,
  isLiveKitConfigured,
} from "@/lib/livekit/config";

export function isInterviewEgressConfigured() {
  return Boolean(
    isLiveKitConfigured() &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

export function createInterviewEgressClient() {
  const { apiKey, apiSecret } = getLiveKitConfig();
  return new EgressClient(getLiveKitHttpHost(), apiKey, apiSecret);
}

export function createInterviewRoomServiceClient() {
  const { apiKey, apiSecret } = getLiveKitConfig();
  return new RoomServiceClient(getLiveKitHttpHost(), apiKey, apiSecret);
}

export function buildInterviewEgressFileOutput(filepath: string) {
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secret = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKey || !secret) {
    throw new Error("Interview egress storage is not configured.");
  }

  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey,
        secret,
        bucket,
        region: process.env.S3_REGION || "auto",
        endpoint: process.env.S3_ENDPOINT || "",
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      }),
    },
  });
}

export function isEgressComplete(status: EgressStatus | undefined) {
  return status === EgressStatus.EGRESS_COMPLETE;
}

export function isEgressFailed(status: EgressStatus | undefined) {
  return (
    status === EgressStatus.EGRESS_FAILED ||
    status === EgressStatus.EGRESS_ABORTED ||
    status === EgressStatus.EGRESS_LIMIT_REACHED
  );
}
