import type { AdminReportRow } from "@/lib/admin/queries";
import { buildCsv, escapeCsvCell } from "@/lib/admin/format";

export function buildAttemptReportCsv(rows: AdminReportRow[]) {
  return buildCsv(
    [
      "Attempt ID",
      "Student",
      "Email",
      "Assessment",
      "Status",
      "Evaluation",
      "Score",
      "Total Marks",
      "Violations",
      "Risk Level",
      "Started At",
      "Submitted At",
    ],
    rows.map((row) => [
      row.attemptId,
      row.studentName,
      row.studentEmail,
      row.assessmentTitle,
      row.status,
      row.evaluationStatus,
      row.finalScore ?? "",
      row.totalMarks,
      row.violationCount,
      row.riskLevel,
      row.startedAt,
      row.submittedAt ?? "",
    ]),
  );
}

export function buildAttemptReportPrintHtml(
  rows: AdminReportRow[],
  title: string,
) {
  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeCsvCell(row.studentName)}</td>
          <td>${escapeCsvCell(row.assessmentTitle)}</td>
          <td>${escapeCsvCell(row.status)}</td>
          <td>${escapeCsvCell(row.evaluationStatus)}</td>
          <td>${row.finalScore ?? "—"} / ${row.totalMarks}</td>
          <td>${row.violationCount}</td>
          <td>${row.riskLevel}</td>
          <td>${row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeCsvCell(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; padding: 32px; }
      h1 { font-size: 22px; margin-bottom: 8px; }
      p { color: #6b7280; margin-top: 0; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>${escapeCsvCell(title)}</h1>
    <p>Generated ${new Date().toLocaleString()} · ${rows.length} record(s)</p>
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Assessment</th>
          <th>Status</th>
          <th>Evaluation</th>
          <th>Score</th>
          <th>Violations</th>
          <th>Risk</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="8">No records found.</td></tr>`}
      </tbody>
    </table>
  </body>
</html>`;
}
