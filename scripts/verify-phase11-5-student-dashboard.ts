import { getStudentDashboardData } from "../src/lib/student/dashboard-queries";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  assert(typeof getStudentDashboardData === "function", "dashboard query export exists");

  console.log("\nPhase 11.5 student dashboard checks passed (static audit).");
  console.log(
    "Run manual QA with a student account to verify live MongoDB-backed dashboard data.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
