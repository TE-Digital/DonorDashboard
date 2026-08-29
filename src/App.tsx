import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { WelcomeSetPasswordPage } from "./modules/auth/WelcomeSetPasswordPage";
import { ProtectedRoute, RoleRoute } from "./modules/auth/ProtectedRoute";
import { AppShellLayout } from "./layout/AppShellLayout";
import { useAuth } from "./modules/auth/AuthContext";
import { useViewAs } from "./modules/viewAs/ViewAsContext";

import { LoginPage } from "./modules/auth/LoginPage";
import { ResetPasswordPage } from "./modules/auth/ResetPasswordPage";
import { DesignSystemPage } from "./modules/designsystem/DesignSystemPage";
import { GrantsConsolePage } from "./modules/designsystem/GrantsConsolePage";

import { AdminDashboardPage } from "./modules/admin/AdminDashboardPage";
import { AdminTeachersPage } from "./modules/admin/AdminTeachersPage";
import { AdminUsersRolesPage } from "./modules/admin/AdminUsersRolesPage";
import { AdminCreateUserPage } from "./modules/admin/AdminCreateUserPage";
import { AdminBrandingPage } from "./modules/admin/AdminBrandingPage";
import { AdminStudentsPage } from "./modules/admin/AdminStudentsPage";
import { AdminCreateStudentPage } from "./modules/admin/AdminCreateStudentPage";
import { AdminStudentDetailPage } from "./modules/admin/AdminStudentDetailPage";
import { AdminStudentOverviewPage } from "./modules/admin/AdminStudentOverviewPage";
import { AdminTeacherStudentsPage } from "./modules/admin/AdminTeacherStudentsPage";
import { AdminCreateTeacherPage } from "./modules/admin/AdminCreateTeacherPage";
import { AdminTeacherOverviewPage } from "./modules/admin/AdminTeacherOverviewPage";
import { AdminSchoolsPage } from "./modules/admin/AdminSchoolsPage";
import { AdminCreateSchoolPage } from "./modules/admin/AdminCreateSchoolPage";
import { AdminEditSchoolPage } from "./modules/admin/AdminEditSchoolPage";
import { AdminSchoolDetailPage } from "./modules/admin/AdminSchoolDetailPage";
import { AdminDonorsPage } from "./modules/admin/AdminDonorsPage";
import { AdminCreateDonorPage } from "./modules/admin/AdminCreateDonorPage";
import { AdminEditDonorPage } from "./modules/admin/AdminEditDonorPage";
import { AdminScholarshipsPage } from "./modules/admin/AdminScholarshipsPage";
import { AdminCreateScholarshipPage } from "./modules/admin/AdminCreateScholarshipPage";
import { AdminEditScholarshipPage } from "./modules/admin/AdminEditScholarshipPage";
import { AdminCreateGrantTypePage } from "./modules/admin/AdminCreateGrantTypePage";
import { AdminEditGrantTypePage } from "./modules/admin/AdminEditGrantTypePage";
import { AdminGrantTypesOverviewPage } from "./modules/admin/AdminGrantTypesOverviewPage";
import { AdminContactRequestsPage } from "./modules/admin/AdminContactRequestsPage";
import  AdminReportsPage  from "./modules/admin/AdminReportsPage";
import AdminReportsBetaPage from "./modules/admin/AdminReportsBetaPage";

import { AdminReportFormPage } from "./modules/admin/AdminReportFormPage";
import { AdminNewReportPage } from "./modules/admin/AdminNewReportPage";

import { TeacherDashboardPage } from "./modules/teacher/TeacherDashboardPage";
import { TeacherStudentsPage } from "./modules/teacher/TeacherStudentsPage";
import { TeacherProfilePage } from "./modules/teacher/TeacherProfilePage";
import { TeacherStudentDetailPage } from "./modules/teacher/TeacherStudentDetailPage";
import { TeacherNewReportPage } from "./modules/teacher/TeacherNewReportPage";
import { TeacherEditReportPage } from "./modules/teacher/TeacherEditReportPage";

import { DonorDashboardPage } from "./modules/donor/DonorDashboardPage";
import { DonorStudentDetailPage } from "./modules/donor/DonorStudentDetailPage";
import { DonorRenewPage } from "./modules/donor/DonorRenewPage";

import { ProfilePage } from "./modules/profile/ProfilePage";

const HomeRedirect: React.FC = () => {
  const { role, loading } = useAuth();
  // A chosen view wins over the account's primary role, so landing on "/" while
  // previewing the teacher product does not silently bounce back to the console.
  const { viewRole, availableRoles } = useViewAs();

  if (loading) return null;

  if (availableRoles.includes(viewRole)) return <Navigate to={`/${viewRole}/dashboard`} replace />;

  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role === "teacher") return <Navigate to="/teacher/dashboard" replace />;
  if (role === "donor") return <Navigate to="/donor/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Lumen design system: the grants console is the reference screen, the
          token/component catalogue lives one level down. */}
      <Route path="/design-system" element={<GrantsConsolePage />} />
      <Route path="/design-system/reference" element={<DesignSystemPage />} />
 	<Route path="/welcome" element={<WelcomeSetPasswordPage />} />

      {/* Auth-protected area */}
      <Route element={<ProtectedRoute />}>
        {/* Common shell for all authenticated routes */}
        <Route element={<AppShellLayout />}>
          {/* role-based home redirect */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Profile for all roles */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* ---------- ADMIN AREA ---------- */}
          <Route path="/admin" element={<RoleRoute allowed={["admin"]} />}>
            <Route path="dashboard" element={<AdminDashboardPage />} />

            {/* Students */}
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="students/new" element={<AdminCreateStudentPage />} />
            <Route
              path="students/:studentId"
              element={<AdminStudentOverviewPage />}
            />
            <Route
              path="students/:studentId/edit"
              element={<AdminStudentDetailPage />}
            />

            {/* Teacher / student mapping */}
            <Route path="teachers/new" element={<AdminCreateTeacherPage />} />
            <Route path="teachers/:teacherId" element={<AdminTeacherOverviewPage />} />
            <Route
              path="teachers/:teacherUserId/students"
              element={<AdminTeacherStudentsPage />}
            />

            {/* Teachers & users */}
            <Route path="teachers" element={<AdminTeachersPage />} />
            <Route path="users" element={<AdminUsersRolesPage />} />
            <Route path="users/new" element={<AdminCreateUserPage />} />

            {/* Schools */}
            <Route path="schools" element={<AdminSchoolsPage />} />
            <Route path="schools/new" element={<AdminCreateSchoolPage />} />
            <Route
              path="schools/:schoolId"
              element={<AdminSchoolDetailPage />}
            />
            <Route
              path="schools/:schoolId/edit"
              element={<AdminEditSchoolPage />}
            />

            {/* Donors */}
            <Route path="donors" element={<AdminDonorsPage />} />
            <Route path="donors/new" element={<AdminCreateDonorPage />} />
            <Route
              path="donors/:donorId/edit"
              element={<AdminEditDonorPage />}
            />
{/* Contact & renewal requests */}
<Route
  path="contact-requests"
  element={<AdminContactRequestsPage />}
/>


            {/* Scholarships */}
            <Route path="scholarships" element={<AdminScholarshipsPage />} />
            <Route
              path="scholarships/new"
              element={<AdminCreateScholarshipPage />}
            />
            <Route
              path="scholarships/:scholarshipId/edit"
              element={<AdminEditScholarshipPage />}
            />

<Route path="reports" element={<AdminReportsPage />} />
            <Route path="reports-beta" element={<AdminReportsBetaPage />} />

            {/* Grant / scholarship types */}
            <Route
              path="grant-types"
              element={<AdminGrantTypesOverviewPage />}
            />
            <Route
              path="grant-types/new"
              element={<AdminCreateGrantTypePage />}
            />
            <Route
              path="grant-types/edit/:id"
              element={<AdminEditGrantTypePage />}
            />

            {/* Reports / term updates (ADMIN) */}
            <Route path="reports/new" element={<AdminNewReportPage />} />
            <Route
              path="reports/:reportId/edit"
              element={<AdminReportFormPage />}
            />

            {/* Branding */}
            <Route path="branding" element={<AdminBrandingPage />} />
          </Route>

          {/* ---------- TEACHER AREA ---------- */}
          <Route path="/teacher" element={<RoleRoute allowed={["teacher"]} />}>
            <Route path="dashboard" element={<TeacherDashboardPage />} />
            <Route path="profile" element={<TeacherProfilePage />} />
            <Route path="students" element={<TeacherStudentsPage />} />
		<Route path="students/new" element={<AdminCreateStudentPage />} />
            <Route
              path="students/:studentId"
              element={<TeacherStudentDetailPage />}
            />
            <Route path="reports/new" element={<TeacherNewReportPage />} />
            <Route
              path="reports/:reportId/edit"
              element={<TeacherEditReportPage />}
            />
          </Route>

          {/* ---------- DONOR AREA ---------- */}
          <Route path="/donor" element={<RoleRoute allowed={["donor"]} />}>
            <Route path="dashboard" element={<DonorDashboardPage />} />
	            <Route path="renew" element={<DonorRenewPage />} />
            <Route
              path="students/:studentId"
              element={<DonorStudentDetailPage />}
            />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
