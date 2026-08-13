/** Short-lived local playback tokens (dev / local storage provider). */
const localPlaybackTokens = new Map<
  string,
  { recordingId: string; expiresAt: number }
>();

export function storeLocalPlaybackToken(
  token: string,
  recordingId: string,
  ttlMs = 10 * 60 * 1000,
) {
  localPlaybackTokens.set(token, {
    recordingId,
    expiresAt: Date.now() + ttlMs,
  });
}

export function consumeLocalPlaybackToken(token: string, recordingId: string) {
  const entry = localPlaybackTokens.get(token);
  if (!entry) return false;
  if (entry.recordingId !== recordingId) return false;
  if (entry.expiresAt < Date.now()) {
    localPlaybackTokens.delete(token);
    return false;
  }
  return true;
}
