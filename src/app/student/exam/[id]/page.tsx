import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Mic, Wifi } from "lucide-react";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { createServerOp, maskId } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { displayType, serializeAssessment } from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { Button } from "@/components/ui/button";

export default async function ExamGatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "STUDENT_EXAM_GATE",
    source: "SERVER-COMPONENT",
    resourceId: id,
  });

  const session = await requirePageRole(["student"]);
  op.auth(session.user);
  await connectDB();
  const studentId = new mongoose.Types.ObjectId(session.user.id);

  const identity = mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { code: id }] }
    : { code: id };

  const doc = await op.runMongo("student assessment access lookup", () =>
    Assessment.findOne({
      $and: [
        identity,
        { status: "published" },
        {
          $or: [
            { visibility: "all" },
            { visibility: "assigned", assignedStudentIds: studentId },
          ],
        },
      ],
    }),
  );

  if (!doc) {
    op.fail("not_found_or_not_visible", { resourceId: maskId(id) });
    notFound();
  }

  const assessment = serializeAssessment(doc, {
    questionCount: doc.questionIds?.length ?? 0,
  });
  op.success({ resourceId: maskId(String(doc._id)), code: doc.code });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="relative card-soft p-8 max-w-lg w-full shadow-elevated">
        <h1 className="font-display font-bold text-2xl">{assessment.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {displayType(assessment.type)} · {assessment.durationMin} min ·{" "}
          {assessment.questionCount} questions
        </p>
        {assessment.description && (
          <p className="text-sm text-muted-foreground mt-3">
            {assessment.description}
          </p>
        )}

        <div className="mt-6">
          <h2 className="font-semibold mb-3">Secure exam environment</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(assessment.instructions
              ? assessment.instructions.split("\n").filter(Boolean)
              : [
                  "You will be monitored by AI proctoring (face, eye, behavior)",
                  "Tab switching, copy/paste, right-click and dev tools are disabled",
                  "Violations may auto-submit your exam",
                  "Stay in full-screen until you finish",
                ]
            ).map((line) => (
              <li key={line}>• {line.replace(/^•\s*/, "")}</li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Camera, label: "Camera" },
            { icon: Mic, label: "Microphone" },
            { icon: Wifi, label: "Network" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border p-3 text-center"
            >
              <item.icon className="w-5 h-5 mx-auto text-primary" />
              <div className="text-[11px] font-semibold mt-2">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/student">Cancel</Link>
          </Button>
          <Button className="flex-1" disabled>
            I Agree · Start Exam
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Exam session delivery comes in a later phase.
        </p>
      </div>
    </div>
  );
}
