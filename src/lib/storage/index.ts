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
  };
}

async function createS3Provider(): Promise<StorageProvider> {
  const { S3Client, PutObjectCommand, GetObjectCommand } = await import(
    "@aws-sdk/client-s3"
  );
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

export function buildRecordingObjectKey(options: {
  attemptId: string;
  mimeType: string;
}) {
  const ext = options.mimeType.includes("mp4")
    ? "mp4"
    : options.mimeType.includes("webm")
      ? "webm"
      : "bin";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = randomBytes(4).toString("hex");
  return `exams/${options.attemptId}/${stamp}-${nonce}.${ext}`;
}

export async function readLocalRecordingFile(key: string) {
  const full = path.join(recordingsRoot(), key);
  return readFile(full);
}

export function mintLocalPlaybackToken() {
  return randomBytes(24).toString("hex");
}
