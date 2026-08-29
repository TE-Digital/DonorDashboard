// src/modules/teacher/TeacherNewReportPage.tsx
//
// Add report, for a teacher.
//
// The fields, the validation, the attachments and the save all live in the
// reports module, so the admin and teacher screens cannot drift apart — they
// were five near-identical files before, and they did.

import React from "react";
import { ReportRoutePage } from "../reports";

export const TeacherNewReportPage: React.FC = () => <ReportRoutePage area="teacher" />;

export default TeacherNewReportPage;
