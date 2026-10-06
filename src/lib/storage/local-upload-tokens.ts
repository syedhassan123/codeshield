/** Short-lived tokens for local-provider direct browser PUT uploads. */
const localUploadTokens = new Map<
  string,
  { recordingId: string; userId: string; expiresAt: number }
>();

export function storeLocalUploadToken(
  token: string,
  recordingId: string,
  userId: string,
  ttlMs = 10 * 60 * 1000,
) {
  localUploadTokens.set(token, {
    recordingId,
    userId,
    expiresAt: Date.now() + ttlMs,
  });
}

export function consumeLocalUploadToken(
  token: string,
  recordingId: string,
  userId: string,
) {
  const entry = localUploadTokens.get(token);
  if (!entry) return false;
  if (entry.recordingId !== recordingId) return false;
  if (entry.userId !== userId) return false;
  if (entry.expiresAt < Date.now()) {
    localUploadTokens.delete(token);
    return false;
  }
  localUploadTokens.delete(token);
  return true;
}
