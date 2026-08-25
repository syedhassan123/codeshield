import mongoose from "mongoose";
import { ExamRecording } from "@/models/ExamRecording";

/**
 * When an attempt is closed, leftover RECORDING/UPLOADING rows must not stay
 * active indefinitely. READY rows are never touched.
 */
export async function abandonIncompleteRecordings(
  attemptId: mongoose.Types.ObjectId,
): Promise<number> {
  const result = await ExamRecording.updateMany(
    {
      attemptId,
      status: { $in: ["RECORDING", "UPLOADING"] },
    },
    {
      $set: {
        status: "FAILED",
        endedAt: new Date(),
        errorMessage: "Attempt closed before recording upload completed.",
      },
    },
  );
  return result.modifiedCount ?? 0;
}
