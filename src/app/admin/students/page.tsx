import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { mockStudents } from "@/lib/mock-data";
import { initials } from "@/lib/utils";

export default function AdminStudentsPage() {
  return (
    <div>
      <PageHeader
        title="Students"
        description={`${mockStudents.length} students enrolled`}
        actions={
          <Button size="sm">
            <UserPlus className="w-4 h-4" /> Invite Student
          </Button>
        }
      />

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Student</th>
              <th className="text-left py-3 px-4">Course</th>
              <th className="text-left py-3 px-4">Assessments</th>
              <th className="text-left py-3 px-4">Avg Score</th>
              <th className="text-left py-3 px-4">Violations</th>
              <th className="text-left py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockStudents.map((s) => (
              <tr key={s.email} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full gradient-primary text-white text-xs font-bold flex items-center justify-center">
                      {initials(s.name)}
                    </div>
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground">{s.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">{s.course}</td>
                <td className="py-3 px-4">{s.assessments}</td>
                <td className="py-3 px-4">{s.avgScore} %</td>
                <td className="py-3 px-4">
                  {s.violations === 0 ? "Clean" : s.violations}
                </td>
                <td className="py-3 px-4 capitalize">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
