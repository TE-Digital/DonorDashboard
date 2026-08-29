// src/modules/admin/AdminReportFormPage.tsx
//
// Edit a report, as a route of its own.
//
// The fields, the validation, the attachments and the save all live in the
// reports module, so the admin and teacher screens cannot drift apart — they
// were five near-identical files before, and they did.

import React from "react";
import { ReportRoutePage } from "../reports";

export const AdminReportFormPage: React.FC = () => <ReportRoutePage area="admin" />;

export default AdminReportFormPage;
