import Link from "next/link";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import {
  displayDifficulty,
  displayType,
  serializeAssessment,
} from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default async function StudentAssessmentsPage() {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "STUDENT_PAGE_LIST",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["student"]);
  op.auth(session.user);
  await connectDB();

  const studentId = new mongoose.Types.ObjectId(session.user.id);
  const docs = await op.runMongo("fetching published assessments for student", () =>
    Assessment.find({
      status: "published",
      $or: [
        { visibility: "all" },
        { visibility: "assigned", assignedStudentIds: studentId },
      ],
    }).sort({ publishedAt: -1, updatedAt: -1 }),
  );

  const sessionUser = session.user;
  op.allowed({ action: "list_published_assessments", role: sessionUser.role });

  const assessments = op.respond({
    assessments: docs.map((doc) =>
      serializeAssessment(doc, {
        questionCount: doc.questionIds?.length ?? 0,
      }),
    ),
  }).assessments;

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Pick an assessment to begin."
      />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {assessments.map((a) => (
          <div key={a.id} className="card-soft p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-primary-soft text-primary">
                {displayDifficulty(a.difficulty)}
              </span>
              <span className="text-xs text-muted-foreground">{a.category}</span>
            </div>
            <h3 className="font-display font-bold text-lg">{a.title}</h3>
            {a.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {a.description}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2 mb-1">
              {displayType(a.type)} · {a.durationMin} m · {a.questionCount}{" "}
              questions · {a.totalMarks} marks
            </p>
            <p className="text-[11px] text-success font-semibold mb-4">
              Available · Published
            </p>
            <Button asChild className="mt-auto" size="sm">
              <Link href={`/student/exam/${a.id}`}>Start Assessment</Link>
            </Button>
          </div>
        ))}
        {!assessments.length && (
          <div className="card-soft p-8 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
            No published assessments available right now.
          </div>
        )}
      </div>
    </div>
  );
}
