import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export type StorageProviderName = "local" | "s3";

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type StorageProvider = {
  name: StorageProviderName;
  putObject: (input: PutObjectInput) => Promise<{ key: string }>;
  /** Returns a time-limited URL the browser can use to play/download. */
  getSignedReadUrl: (key: string, expiresInSeconds?: number) => Promise<string>;
  /** Time-limited PUT URL for direct browser uploads (S3 only). */
  getSignedPutUrl?: (
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ) => Promise<string>;
  /** Returns object size when present, else null. */
  headObject?: (key: string) => Promise<{ contentLength: number } | null>;
};

function recordingsRoot() {
  return (
    process.env.RECORDINGS_DIR ||
    path.join(process.cwd(), ".data", "recordings")
  );
}

function createLocalProvider(): StorageProvider {
  return {
    name: "local",
    async putObject({ key, body }) {
      const full = path.join(recordingsRoot(), key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      return { key };
    },
    async getSignedReadUrl(key: string) {
      // Local provider uses an authenticated Next.js route + opaque token.
      // Token is minted by the caller (recording action) — here we only validate path.
      const full = path.join(recordingsRoot(), key);
      await access(full);
      return key;
    },
    async headObject(key: string) {
      try {
        const { stat } = await import("fs/promises");
        const full = path.join(recordingsRoot(), key);
        const info = await stat(full);
        return { contentLength: info.size };
      } catch {
        return null;
      }
    },
  };
}

async function createS3Provider(): Promise<StorageProvider> {
  const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
  } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 storage selected but S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are missing.",
    );
  }

  const client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    name: "s3",
    async putObject({ key, body, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key };
    },
    async getSignedReadUrl(key: string, expiresInSeconds = 600) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    },
    async getSignedPutUrl(key, contentType, expiresInSeconds = 600) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn: expiresInSeconds },
      );
    },
    async headObject(key: string) {
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return { contentLength: Number(result.ContentLength ?? 0) };
      } catch {
        return null;
      }
    },
  };
}

let cached: StorageProvider | null = null;

export async function getStorageProvider(): Promise<StorageProvider> {
  if (cached) return cached;
  const mode = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
  if (mode === "s3") {
    cached = await createS3Provider();
  } else {
    cached = createLocalProvider();
  }
  return cached;
}

function recordingExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  return "bin";
}

export function buildRecordingObjectKey(options: {
  attemptId: string;
  mimeType: string;
}) {
  const ext = recordingExtension(options.mimeType);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = randomBytes(4).toString("hex");
  return `exams/${options.attemptId}/${stamp}-${nonce}.${ext}`;
}

export function buildInterviewRecordingObjectKey(options: {
  interviewId: string;
  mimeType: string;
}) {
  const ext = recordingExtension(options.mimeType);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = randomBytes(4).toString("hex");
  return `interviews/${options.interviewId}/${stamp}-${nonce}.${ext}`;
}

export async function readLocalRecordingFile(key: string) {
  const full = path.join(recordingsRoot(), key);
  return readFile(full);
}

export async function localRecordingFileExists(key: string) {
  try {
    await access(path.join(recordingsRoot(), key));
    return true;
  } catch {
    return false;
  }
}

export function mintLocalPlaybackToken() {
  return randomBytes(24).toString("hex");
}
