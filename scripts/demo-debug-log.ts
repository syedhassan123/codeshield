/**
 * Prints a sample of the structured debug output (no network / DB).
 * Run: npx tsx scripts/demo-debug-log.ts
 */
import {
  beginRequestLog,
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

  beginRequestLog({
    label: `GET /admin/results/${maskId(attemptId)}`,
    source: "SERVER-COMPONENT",
  });

  logAuthOnce(
    { id: "admin001user", email: "admin@codeshield.ai", role: "admin" },
    "Session retrieved",
  );
  logAuthorization({
    allowed: true,
    action: "access_page",
    role: "admin",
    resource: "roles:admin",
  });

  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "DETAIL",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  op.auth({ id: "admin001user", email: "admin@codeshield.ai", role: "admin" });
  op.allowed({
    action: "view_attempt",
    resource: `attempt:${maskId(attemptId)}`,
    role: "admin",
  });
  logMongoReused();

  await op.runMongo("load attempt", async () => {
    await new Promise((r) => setTimeout(r, 40));
    return { status: "submitted" };
  });
  await op.runMongo("load result", async () => {
    await new Promise((r) => setTimeout(r, 25));
    return { evaluationStatus: "pending", finalScore: 72 };
  });

  op.summary({
    attemptId: maskId(attemptId),
    status: "submitted",
    hasResult: true,
    result: "SUCCESS",
  });
  op.success(
    { attemptId: maskId(attemptId) },
    {
      success: true,
      data: {
        attemptId: maskId(attemptId),
        status: "submitted",
        hasResult: true,
        evaluationStatus: "pending",
        finalScore: 72,
      },
    },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
