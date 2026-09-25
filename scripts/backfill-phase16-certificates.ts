/**
 * One-time backfill: issue Phase 16 certificates for Results that already
 * completed (evaluationStatus === "completed", passing score) before this
 * phase shipped. Uses the same idempotent issuance path as live traffic,
 * so it is safe to re-run.
 *
 * Run: npx tsx --env-file=.env.local scripts/backfill-phase16-certificates.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { backfillMissingCertificates } from "../src/lib/certificates/issue";
import { Result } from "../src/models/Result";

async function main() {
  await connectDB();
  const { scanned, issued } = await backfillMissingCertificates(Result);
  console.log(
    `Scanned ${scanned} completed Result(s); issued ${issued} new certificate(s).`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
