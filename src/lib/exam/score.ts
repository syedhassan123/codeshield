import type { AnswerEvalStatus, EvaluationStatus } from "@/types/exam";
import { debugLog } from "@/lib/debug";

export type ScoreQuestionInput = {
  type: string;
  points: number;
  awardedPoints: number;
  evalStatus: AnswerEvalStatus | string;
};

export function recalculateResultScores(questions: ScoreQuestionInput[]) {
  debugLog("SCORE", "recalculating...");

  let objectiveScore = 0;
  let objectiveMaxMarks = 0;
  let subjectiveScore = 0;
  let subjectiveMaxMarks = 0;
  let codingScore = 0;
  let codingMaxMarks = 0;
  let pendingManualCount = 0;

  for (const q of questions) {
    const points = q.points ?? 0;
    const awarded = q.awardedPoints ?? 0;

    if (q.type === "mcq") {
      objectiveMaxMarks += points;
      objectiveScore += awarded;
      continue;
    }

    if (q.type === "coding") {
      codingMaxMarks += points;
      if (q.evalStatus === "pending_evaluation") {
        pendingManualCount += 1;
      } else {
        codingScore += awarded;
      }
      continue;
    }

    subjectiveMaxMarks += points;
    if (q.evalStatus === "pending_evaluation") {
      pendingManualCount += 1;
    } else {
      subjectiveScore += awarded;
    }
  }

  const finalScore = objectiveScore + subjectiveScore + codingScore;
  const totalMarks = objectiveMaxMarks + subjectiveMaxMarks + codingMaxMarks;
  const evaluationStatus: EvaluationStatus =
    pendingManualCount > 0 ? "pending" : "completed";

  debugLog("SCORE", "completed", {
    objectiveScore,
    subjectiveScore,
    codingScore,
    finalScore,
    evaluationStatus: evaluationStatus.toUpperCase(),
  });

  return {
    objectiveScore,
    objectiveMaxMarks,
    subjectiveScore,
    subjectiveMaxMarks,
    codingScore,
    codingMaxMarks,
    subjectivePendingCount: pendingManualCount,
    finalScore,
    totalMarks,
    evaluationStatus,
  };
}
