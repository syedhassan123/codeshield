/**
 * Sample of the structured debug output.
 * Run: npx tsx scripts/demo-debug-log.ts
 */
import {
  createServerOp,
  logAuthOnce,
  logAuthorization,
  logMongoReused,
  maskId,
} from "../src/lib/debug";

async function main() {
  process.env.DEBUG_LOGS = "true";
  process.env.DEBUG_API_BODY = "true";

  const attemptId = "6a7b1234abcd9876543210db1";

  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "DETAIL",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  logAuthOnce(
    { id: "admin001user", email: "admin@codeshield.ai", role: "admin" },
  );
  logAuthorization({
    allowed: true,
    action: "view_attempt",
    resource: `attempt:${maskId(attemptId)}`,
    role: "admin",
  });
  logMongoReused();

  await op.runMongo("FIND_ATTEMPT", async () => {
    await new Promise((r) => setTimeout(r, 40));
    return { status: "submitted" };
  });
  await op.runMongo("FIND_RESULT", async () => {
    await new Promise((r) => setTimeout(r, 25));
    return { evaluationStatus: "pending", finalScore: 72 };
  });

  // Same object that would be returned to the client:
  op.respond({
    attempt: {
      id: attemptId,
      status: "submitted",
    },
    student: {
      id: "stu001",
      name: "Demo Student",
      email: "student@example.com",
    },
    result: {
      evaluationStatus: "pending",
      finalScore: 72,
      totalMarks: 100,
    },
    timeTaken: "42 min",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
