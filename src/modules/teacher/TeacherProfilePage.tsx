// src/modules/teacher/TeacherProfilePage.tsx
//
// The teacher's own record, in the teacher product.
//
// Read by default, editable for the things a teacher legitimately keeps current
// about themselves — their name in both languages, phone and LINE ID. The school
// they represent is set by an admin, so it is shown and not offered as a field.
//
// Reads and writes go through teacherProfile.ts, which degrades to the base
// columns when the teacher-profile migration has not been applied and says so.

import React, { useCallback, useEffect, useState } from "react";
import { Avatar, SimpleGrid, Stack, TextInput } from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import {
  InlineMessage,
  LoadingState,
  PageHeader,
  SectionCard,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  type FieldErrors,
} from "../../design-system";
import { Badge, Button } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import { useEffectiveTeacherId } from "../viewAs/ViewAsContext";
import {
  TEACHER_FIELDS_PENDING_NOTE,
  TEACHER_FIELD_ORDER,
  loadTeacherProfile,
  saveTeacherProfile,
  validateTeacherDetails,
  type TeacherField,
  type TeacherDetailsInput,
  type TeacherProfile,
} from "../admin/teacherProfile";
import styles from "./TeacherHome.module.scss";

/** Namespaces this form's field ids. */
const FORM_ID = "teacher-self";

const toDetails = (profile: TeacherProfile): TeacherDetailsInput => ({
  fullName: profile.full_name ?? "",
  fullNameTh: profile.full_name_th ?? "",
  email: profile.email ?? "",
  phone: profile.phone ?? "",
  lineId: profile.line_id ?? "",
  schoolId: profile.school_id ?? null,
  notes: profile.notes ?? "",
});

export const TeacherProfilePage: React.FC = () => {
  const teacherId = useEffectiveTeacherId();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [extended, setExtended] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TeacherDetailsInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<TeacherField>>({});

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    setError(null);

    const result = await loadTeacherProfile(teacherId);
    setExtended(result.extended);

    if (result.error || !result.profile) {
      setError(result.error ?? "Profile not found.");
      setLoading(false);
      return;
    }
    setProfile(result.profile);

    const [{ count }, schoolResult] = await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("responsible_teacher_id", teacherId),
      result.profile.school_id
        ? supabase.from("schools").select("name").eq("id", result.profile.school_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setStudentCount(count ?? 0);
    setSchoolName((schoolResult.data as { name?: string } | null)?.name ?? null);
    setLoading(false);
  }, [teacherId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <K extends keyof TeacherDetailsInput>(key: K, value: TeacherDetailsInput[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!profile || !draft) return;

    // The same rules the admin form applies to the same row. A teacher's own
    // screen used to require only the English name, so the record a teacher
    // saved was allowed to be less complete than the one an admin saved.
    // Email and school are read-only here, so they are not asked for again.
    const problems = validateTeacherDetails(draft, { requireSchool: false });
    delete problems.email;
    setFieldErrors(problems);

    if (hasErrors(problems)) {
      setError(errorSummary(problems));
      focusField(FORM_ID, firstError(problems, TEACHER_FIELD_ORDER));
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const result = await saveTeacherProfile(profile.id, draft);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setEditing(false);
    setDraft(null);
    setNotice(result.extended ? "Your details were saved." : TEACHER_FIELDS_PENDING_NOTE);
    await load();
  };

  if (loading) return <LoadingState />;
  if (!profile) {
    return (
      <Stack>
        <PageHeader title="My profile" />
        <InlineMessage tone="error">{error ?? "Profile not found."}</InlineMessage>
      </Stack>
    );
  }

  const fields: Array<[string, string]> = [
    ["Full name (English)", profile.full_name || "—"],
    ["Full name (Thai)", profile.full_name_th || "—"],
    ["Email address", profile.email || "—"],
    ["Phone number", profile.phone || "—"],
    ["LINE ID", profile.line_id || "—"],
    ["School", schoolName ?? "Not set by an administrator yet"],
    ["Students assigned", String(studentCount)],
  ];

  return (
    <Stack>
      <PageHeader
        title="My profile"
        subtitle="Your contact details, as the office and the schools see them."
        actions={
          editing ? (
            <>
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              icon="pencil"
              onClick={() => {
                setNotice(null);
                setDraft(toDetails(profile));
                setEditing(true);
              }}
            >
              Edit details
            </Button>
          )
        }
      />

      {!extended && <InlineMessage tone="warning">{TEACHER_FIELDS_PENDING_NOTE}</InlineMessage>}
      {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      <SectionCard>
        <div className={styles.profileHeader}>
          <Avatar size={56} style={profileAvatarStyle(profile.id)}>
            {profileInitials(profile.full_name)}
          </Avatar>
          <div className={styles.profileIdentity}>
            <h2 className={styles.profileName}>{profile.full_name || "(no name)"}</h2>
            <p className={styles.profileMeta}>
              {profile.email || "No email recorded"}
              {schoolName ? ` · ${schoolName}` : ""}
            </p>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Badge tone="info">Teacher</Badge>
          </span>
        </div>
      </SectionCard>

      <SectionCard title="Details">
        {editing && draft ? (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <TextInput
                label="Full name (English)"
                id={fieldId(FORM_ID, "fullName")}
                error={fieldErrors.fullName}
                required
                value={draft.fullName}
                onChange={(event) => setField("fullName", event.currentTarget.value)}
              />
              <TextInput
                label="Full name (Thai)"
                id={fieldId(FORM_ID, "fullNameTh")}
                error={fieldErrors.fullNameTh}
                required
                placeholder="เช่น อารยา สุขใจ"
                value={draft.fullNameTh}
                onChange={(event) => setField("fullNameTh", event.currentTarget.value)}
              />
              <TextInput
                label="Phone number"
                id={fieldId(FORM_ID, "phone")}
                error={fieldErrors.phone}
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08x xxx xxxx"
                value={draft.phone}
                onChange={(event) => setField("phone", event.currentTarget.value)}
              />
              <TextInput
                label="LINE ID"
                id={fieldId(FORM_ID, "lineId")}
                error={fieldErrors.lineId}
                required
                placeholder="@your-line-id"
                value={draft.lineId}
                onChange={(event) => setField("lineId", event.currentTarget.value)}
              />
            </SimpleGrid>

            <InlineMessage tone="info">
              Your email address and the school you represent are managed by the office. Ask an
              administrator to change either one.
            </InlineMessage>
          </Stack>
        ) : (
          <div className={styles.fieldGrid}>
            {fields.map(([label, value]) => (
              <div key={label}>
                <span className={styles.fieldLabel}>{label}</span>
                <span className={styles.fieldValue}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </Stack>
  );
};

export default TeacherProfilePage;
