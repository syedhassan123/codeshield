/** UX-only cooldown between proctoring alert tones (ms). */
export const PROCTORING_ALERT_AUDIO_COOLDOWN_MS = 30_000;

/** Wait before hiding warning after student returns to screen (ms). */
export const PROCTORING_HEAD_WARNING_DISMISS_MS = 1_500;

let audioContext: AudioContext | null = null;
let lastToneAt = 0;

export function unlockProctoringAlertAudio() {
  if (typeof window === "undefined") return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => {});
    }
  } catch {
    // Audio unavailable — visual warning still works.
  }
}

/**
 * Short non-aggressive alert tone. Rate-limited globally.
 * Returns true if a tone was played.
 */
export function playProctoringAlertTone(): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  if (now - lastToneAt < PROCTORING_ALERT_AUDIO_COOLDOWN_MS) {
    return false;
  }

  try {
    unlockProctoringAlertAudio();
    if (!audioContext) return false;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.07;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const start = audioContext.currentTime;
    gain.gain.setValueAtTime(0.07, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    oscillator.start(start);
    oscillator.stop(start + 0.2);

    lastToneAt = now;
    return true;
  } catch {
    return false;
  }
}

/** Test helper — reset module cooldown state. */
export function resetProctoringAlertAudioForTests() {
  lastToneAt = 0;
}
