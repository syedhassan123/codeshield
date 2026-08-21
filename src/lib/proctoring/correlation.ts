import type {
  EvidenceCategory,
  ProctoringCorrelationCluster,
  ProctoringEvidenceItem,
} from "@/lib/proctoring/types";

const CORRELATION_WINDOW_MS = 60_000;
const MIN_CLUSTER_EVENTS = 3;
const MIN_CLUSTER_CATEGORIES = 2;

/**
 * Identify short windows where multiple signal categories occur close together.
 * Correlation means "review this period" — not confirmed misconduct.
 */
export function findTemporalCorrelations(
  timeline: ProctoringEvidenceItem[],
): ProctoringCorrelationCluster[] {
  const reviewable = timeline.filter(
    (item) =>
      item.category !== "info" &&
      item.eventType !== "FACE_DETECTED" &&
      item.eventType !== "RECORDING_STARTED" &&
      item.eventType !== "RECORDING_STOPPED",
  );

  if (reviewable.length < MIN_CLUSTER_EVENTS) return [];

  const clusters: ProctoringCorrelationCluster[] = [];
  let i = 0;

  while (i < reviewable.length) {
    const windowStart = new Date(reviewable[i].timestamp).getTime();
    const windowEnd = windowStart + CORRELATION_WINDOW_MS;
    const bucket = [reviewable[i]];
    let j = i + 1;

    while (j < reviewable.length) {
      const ts = new Date(reviewable[j].timestamp).getTime();
      if (ts > windowEnd) break;
      bucket.push(reviewable[j]);
      j += 1;
    }

    const categories = [
      ...new Set(bucket.map((item) => item.category)),
    ] as EvidenceCategory[];

    if (
      bucket.length >= MIN_CLUSTER_EVENTS &&
      categories.length >= MIN_CLUSTER_CATEGORIES
    ) {
      const startTimestamp = bucket[0].timestamp;
      const endTimestamp = bucket[bucket.length - 1].timestamp;
      const durationSeconds = Math.max(
        1,
        Math.round(
          (new Date(endTimestamp).getTime() -
            new Date(startTimestamp).getTime()) /
            1000,
        ),
      );
      const eventTypes = [...new Set(bucket.map((item) => item.eventType))];
      const elevated =
        eventTypes.includes("MULTIPLE_FACES_DETECTED") ||
        (eventTypes.includes("TAB_SWITCH") &&
          eventTypes.some((type) => type.includes("FACE")));

      clusters.push({
        startTimestamp,
        endTimestamp,
        durationSeconds,
        eventTypes,
        categories,
        label: `${bucket.length} related signals across ${categories.join(", ")} within ${durationSeconds}s`,
        reviewPriority: elevated ? "elevated" : "normal",
      });
      i = j;
      continue;
    }

    i += 1;
  }

  return clusters;
}
