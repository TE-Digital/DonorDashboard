// src/modules/admin/AdminStudentDetailPage.tsx
//
// Editing one student.
//
// The same fields, in the same three groups, as the add-student form — because
// they come from the same file. StudentFields owns them; this screen owns
// loading the record, saving it, and the two things that only exist once a
// student does: their scholarships and their reports.
//
// One difference from the add form, and it is a real one: the photo uploads the
// moment it is chosen. The storage path is keyed by the student's id, and here
// the id exists, so there is nothing to wait for and no reason to make somebody
// press Save to see their own change.

import React, { useCallback, useEffect, useState } from "react";
import { Anchor, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FormBody,
  FormError,
  FormFooter,
  FormPage,
  FormSection,
  InlineMessage,
  LoadingState,
  StatusBadge,
} from "../../design-system";
import { Button, Icon } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { ReportList } from "../reports";
import { logEvent } from "./studentEvents";
import { SchoolFormDrawer } from "./SchoolFormDrawer";
import { StudentFields } from "./StudentFields";
import { TeacherFormDrawer } from "./TeacherFormDrawer";
import type { CreatedSchool } from "./SchoolForm";
import {
  EMPTY_STUDENT_DETAILS,
  loadGrantTypeOptions,
  loadSchoolOptions,
  loadStudentRecord,
  loadTeacherOptions,
  photoProblem,
  studentPhotoUrl,
  toStudentDetails,
  toStudentRow,
  uploadStudentPhoto,
  validateStudentDetails,
  type Option,
  type SchoolOption,
  type StudentDetailsInput,
  type StudentRecord,
  type TeacherOption,
} from "./studentProfile";
import styles from "./AdminDirectory.module.scss";

interface ScholarshipRow {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null;
  currency: string | null;
  status: string | null;
  grant_type_name: string | null;
}

const asDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : "—";

export const AdminStudentDetailPage: React.FC = () => {
  // Both /students/:studentId/edit and the older /students/:id shape.
  const params = useParams<{ studentId?: string; id?: string }>();
  const studentId = params.studentId ?? params.id ?? "";
  const navigate = useNavigate();

  const [details, setDetails] = useState<StudentDetailsInput>(EMPTY_STUDENT_DETAILS);
  const [studentName, setStudentName] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [grantTypes, setGrantTypes] = useState<Option[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);

  const [schoolDrawerOpen, setSchoolDrawerOpen] = useState(false);
  const [teacherDrawerOpen, setTeacherDrawerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const read = await loadStudentRecord(studentId);

    if (read.error || !read.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const record = read.data;
    setDetails(toStudentDetails(record));
    setStudentName(record.name ?? "");
    setPhotoPath(record.profile_photo_path ?? null);

    const [schoolOptions, teacherOptions, grantOptions, awards] = await Promise.all([
      // The student's own school is kept in the list even if it has closed.
      loadSchoolOptions(record.school_id),
      loadTeacherOptions(),
      loadGrantTypeOptions(),
      supabase
        .from("scholarship_awards")
        .select("id, period_start, period_end, amount_for_period, currency, status, grant_types(name)")
        .eq("student_id", studentId)
        .order("period_start", { ascending: false }),
    ]);

    setSchools(schoolOptions);
    setTeachers(teacherOptions);
    setGrantTypes(grantOptions);
    setScholarships(
      ((awards.data ?? []) as any[]).map((award) => ({
        id: award.id,
        period_start: award.period_start ?? null,
        period_end: award.period_end ?? null,
        amount_for_period: award.amount_for_period ?? null,
        currency: award.currency ?? null,
        status: award.status ?? null,
        grant_type_name: award.grant_types?.name ?? null,
      })),
    );

    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const choosePhoto = async (file: File) => {
    const problem = photoProblem(file);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setUploadingPhoto(true);
    const result = await uploadStudentPhoto(studentId, file);
    setUploadingPhoto(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setPhotoPath(result.path);
    await logEvent(studentId, "photo_updated", "Record photo replaced");
    notifications.show({
      title: "Photo updated",
      message: "The new photo is on this student's record.",
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
  };

  const save = async () => {
    setError(null);

    const problem = validateStudentDetails(details);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);

    const scholarshipLabel = details.grantTypeId
      ? grantTypes.find((grant) => grant.value === details.grantTypeId)?.label ?? null
      : null;

    const { error: updateError } = await supabase
      .from("students")
      .update(toStudentRow(details, scholarshipLabel))
      .eq("id", studentId);

    setSaving(false);

    if (updateError) {
      console.error("Error saving student", updateError);
      setError("The student did not save. Check your connection, then try again.");
      return;
    }

    await logEvent(studentId, "student_updated", `${details.name.trim()}'s details were updated.`);

    notifications.show({
      title: "Student saved",
      message: `${details.name.trim()} is up to date.`,
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });

    navigate(`/admin/students/${studentId}`);
  };

  const remove = async () => {
    setDeleting(true);
    const { error: deleteError } = await supabase.from("students").delete().eq("id", studentId);
    setDeleting(false);
    setConfirmingDelete(false);

    if (deleteError) {
      console.error("Error deleting student", deleteError);
      setError(
        "This student could not be deleted. They may still have scholarships or reports attached.",
      );
      return;
    }

    navigate("/admin/students");
  };

  if (loading) return <LoadingState />;

  if (notFound) {
    return (
      <FormPage title="Student not found" subtitle="This record may have been deleted.">
        <Button variant="secondary" onClick={() => navigate("/admin/students")}>
          Back to students
        </Button>
      </FormPage>
    );
  }

  return (
    <FormPage
      title="Edit student"
      subtitle={`Update ${studentName || "this student"}'s record. Everything here is the same as the add-student form.`}
    >
      <FormBody
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <LoadingState variant="overlay" visible={saving || deleting} />
        <FormError>{error}</FormError>

        <StudentFields
          details={details}
          onChange={setDetails}
          schools={schools}
          teachers={teachers}
          grantTypes={grantTypes}
          onAddSchool={() => setSchoolDrawerOpen(true)}
          onAddTeacher={() => setTeacherDrawerOpen(true)}
          photoUrl={studentPhotoUrl(photoPath)}
          photoBusy={uploadingPhoto}
          onChoosePhoto={(file) => void choosePhoto(file)}
          photoHint={
            uploadingPhoto
              ? "Uploading…"
              : "JPG, PNG or WebP up to 5 MB. A new photo replaces the old one as soon as you choose it."
          }
          disabled={saving || deleting}
        />

        <FormFooter
          left={
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => navigate(`/admin/students/${studentId}`)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                disabled={saving || deleting}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete student
              </Button>
            </>
          }
        >
          <Button variant="primary" type="submit" disabled={saving || deleting}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </FormFooter>
      </FormBody>

      {/* Two things that only exist once a student does. Neither is part of the
          form above, so neither is inside it. */}
      <FormSection
        title="Scholarships"
        actions={
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => navigate(`/admin/scholarships/new?studentId=${studentId}`)}
          >
            Add scholarship
          </Button>
        }
      >
        {scholarships.length === 0 ? (
          <InlineMessage tone="info">No scholarship is recorded for this student yet.</InlineMessage>
        ) : (
          <div className={styles.detailSimpleList}>
            {scholarships.map((award) => (
              <div key={award.id} className={styles.detailListRow}>
                <div>
                  <Anchor component={Link} to={`/admin/scholarships/${award.id}/edit`} size="sm">
                    {award.grant_type_name || "Scholarship"}
                  </Anchor>
                  <span className={styles.detailActivityWhen}>
                    {asDate(award.period_start)} – {asDate(award.period_end)}
                  </span>
                </div>
                <div className={styles.detailListMeta}>
                  <span>
                    {award.amount_for_period == null
                      ? "—"
                      : `${award.amount_for_period.toLocaleString()} ${award.currency ?? "THB"}`}
                  </span>
                  <StatusBadge kind="scholarship" value={award.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title="Reports">
        <ReportList studentId={studentId} studentName={studentName} />
      </FormSection>

      <SchoolFormDrawer
        opened={schoolDrawerOpen}
        onClose={() => setSchoolDrawerOpen(false)}
        onCreated={(school: CreatedSchool) => {
          setSchools((current) =>
            [...current, { value: school.id, label: school.name, is_active: true }].sort((a, b) =>
              a.label.localeCompare(b.label),
            ),
          );
          setDetails((current) => ({ ...current, schoolId: school.id }));
          setSchoolDrawerOpen(false);
        }}
      />

      <TeacherFormDrawer
        opened={teacherDrawerOpen}
        onClose={() => setTeacherDrawerOpen(false)}
        defaultSchoolId={details.schoolId}
        onCreated={(teacher) => {
          setTeachers((current) =>
            [
              ...current,
              { value: teacher.id, label: teacher.fullName, schoolId: teacher.schoolId },
            ].sort((a, b) => a.label.localeCompare(b.label)),
          );
          setDetails((current) => ({ ...current, teacherProfileId: teacher.id }));
          setTeacherDrawerOpen(false);
        }}
      />

      <Modal
        opened={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this student?"
        size="sm"
      >
        <Text size="sm" style={{ textWrap: "pretty" }}>
          {studentName || "This student"} is removed from the system permanently, along with the
          link to their school, their teacher and their donor. This cannot be undone.
        </Text>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void remove()} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete student"}
          </Button>
        </div>
      </Modal>
    </FormPage>
  );
};

export default AdminStudentDetailPage;
