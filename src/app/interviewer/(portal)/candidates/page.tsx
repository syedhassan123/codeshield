import { PageHeader } from "@/components/ui/page-header";
import { connectDB } from "@/lib/db";
import { listInterviewerCandidates } from "@/lib/interviewer/queries";
import { requirePageRole } from "@/lib/safe-auth";

export default async function InterviewerCandidatesPage() {
  const session = await requirePageRole(["interviewer"]);

  let candidates: Awaited<ReturnType<typeof listInterviewerCandidates>> = [];
  let loadError = false;

  try {
    await connectDB();
    candidates = await listInterviewerCandidates(session.user.id);
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader title="Assigned Candidates" />

      {loadError && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Unable to load candidates. Please try again.
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="card-soft p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No assigned candidates yet.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="card-soft p-4 flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
                {candidate.initials}
              </div>
              <div>
                <div className="font-semibold text-sm">{candidate.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {candidate.course}
                </div>
                <div className="text-xs font-semibold mt-1">
                  {candidate.linkedScorePercent == null
                    ? "—"
                    : `${candidate.linkedScorePercent} %`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
