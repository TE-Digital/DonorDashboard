import React from "react";
import { AdminStudentDetailPage } from "./AdminStudentDetailPage";

export const AdminCreateStudentPage: React.FC = () => {
  // AdminStudentDetailPage will see there is no :studentId param
  // and treat this as "new student" (insert mode).
  return <AdminStudentDetailPage />;
};

export default AdminCreateStudentPage;
