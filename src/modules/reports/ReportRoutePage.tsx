// src/modules/reports/ReportRoutePage.tsx
//
// A term report as a route of its own — /admin/reports/new,
// /admin/reports/:reportId/edit, and the same two under /teacher.
//
// All four were separate files with separate ideas of the same form. What
// actually differs between them is two things: whether there is a report id in
// the URL, and where "back" goes. Both are read here; everything else is
// ReportForm.
//
// A report is normally written from the student's page, in a drawer over the
// record. This route is the direct link — a bookmark, an email, a browser
// back-button — and it has to work on its own.

import React, { useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormPage } from "../../design-system";
import { ReportForm } from "./ReportForm";
import type { EntityFormHandle } from "../admin/entityForm";

export interface ReportRoutePageProps {
  /** Decides where cancelling and saving return to. */
  area: "admin" | "teacher";
}

export const ReportRoutePage: React.FC<ReportRoutePageProps> = ({ area }) => {
  const navigate = useNavigate();
  const params = useParams<{ reportId?: string }>();
  const [searchParams] = useSearchParams();
  const form = useRef<EntityFormHandle>(null);
  const [, setSaving] = useState(false);

  const reportId = params.reportId ?? null;
  const studentId = searchParams.get("studentId");
  const editing = Boolean(reportId);

  /** Back to the student when we know which one, otherwise to the list. */
  const back = (id: string | null) =>
    id ? `/${area}/students/${id}` : area === "admin" ? "/admin/reports" : "/teacher/students";

  return (
    <FormPage
      title={editing ? "Edit report" : "Add report"}
      subtitle={
        editing
          ? "Update this term report. The donor comment is sent to the sponsor as written."
          : "Record how this student is doing this term. The donor comment is sent to the sponsor as written."
      }
    >
      <ReportForm
        ref={form}
        showActions
        reportId={reportId}
        studentId={studentId}
        lockStudent={Boolean(studentId) && !editing}
        onSavingChange={setSaving}
        onCancel={() => navigate(back(studentId))}
        onSaved={(report) => navigate(back(report.studentId ?? studentId))}
      />
    </FormPage>
  );
};

export default ReportRoutePage;
