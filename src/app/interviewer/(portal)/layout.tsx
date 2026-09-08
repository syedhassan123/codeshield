import { requirePageRole } from "@/lib/safe-auth";

export default async function InterviewerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageRole(["interviewer"]);
  return children;
}
