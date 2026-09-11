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
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabaseClient";
import {
  InlineMessage,
  LoadingState,
  PageHeader,
  SectionCard,
  emptyValue,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  type FieldErrors,
} from "../../design-system";
import { Badge, Button } from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import { toFriendlyError } from "../../i18n/errors";
import { useEffectiveTeacherId } from "../viewAs/ViewAsContext";
import {
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
  const { t } = useTranslation();
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
      setError(
        result.error
          ? toFriendlyError(result.error, "errors.load", "Error loading teacher profile")
          : t("teacher.profileNotFound"),
      );
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

    // validateTeacherDetails words its messages in English and for an admin;
    // here the same problems are told to the teacher, in their language.
    const messages: FieldErrors<TeacherField> = {};
    if (problems.fullName) messages.fullName = t("teacherPages.profile.fullNameRequired");
    if (problems.fullNameTh) messages.fullNameTh = t("teacherPages.profile.fullNameThRequired");
    if (problems.phone) {
      messages.phone = draft.phone.trim()
        ? t("person.phoneHint")
        : t("teacherPages.profile.phoneRequired");
    }
    if (problems.lineId) messages.lineId = t("teacherPages.profile.lineIdRequired");
    setFieldErrors(messages);

    if (hasErrors(messages)) {
      setError(t("teacherPages.common.fieldsNeedAttention", { count: Object.keys(messages).length }));
      focusField(FORM_ID, firstError(messages, TEACHER_FIELD_ORDER));
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const result = await saveTeacherProfile(profile.id, draft);
    setSaving(false);

    if (result.error) {
      setError(toFriendlyError(result.error, "errors.save", "Error saving teacher profile"));
      return;
    }

    setEditing(false);
    setDraft(null);
    setNotice(
      result.extended ? t("teacherPages.profile.saved") : t("teacherPages.profile.partlySaved"),
    );
    await load();
  };

  if (loading) return <LoadingState />;
  if (!profile) {
    return (
      <Stack>
        <PageHeader title={t("nav.myProfile")} />
        <InlineMessage tone="error">{error ?? t("teacher.profileNotFound")}</InlineMessage>
      </Stack>
    );
  }

  const fields: Array<[string, string]> = [
    [t("person.fullNameEnglish"), profile.full_name || emptyValue()],
    [t("person.fullNameThai"), profile.full_name_th || emptyValue()],
    [t("person.email"), profile.email || emptyValue()],
    [t("person.phone"), profile.phone || emptyValue()],
    [t("person.lineId"), profile.line_id || emptyValue()],
    [t("student.school"), schoolName ?? t("teacherPages.profile.schoolNotSet")],
    [t("teacher.assignedStudents"), String(studentCount)],
  ];

  return (
    <Stack>
      <PageHeader
        title={t("nav.myProfile")}
        subtitle={t("teacherPages.profile.subtitle")}
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
                {t("common.cancel")}
              </Button>
              <Button variant="primary" disabled={saving} onClick={() => void save()}>
                {saving ? t("common.saving") : t("common.saveChanges")}
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
              {t("teacherPages.profile.editDetails")}
            </Button>
          )
        }
      />

      {!extended && (
        <InlineMessage tone="warning">{t("teacherPages.profile.notSetUp")}</InlineMessage>
      )}
      {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      <SectionCard>
        <div className={styles.profileHeader}>
          <Avatar size={56} style={profileAvatarStyle(profile.id)}>
            {profileInitials(profile.full_name)}
          </Avatar>
          <div className={styles.profileIdentity}>
            <h2 className={styles.profileName}>
              {profile.full_name || t("teacherPages.common.unnamed")}
            </h2>
            <p className={styles.profileMeta}>
              {profile.email || t("person.noEmail")}
              {schoolName ? ` · ${schoolName}` : ""}
            </p>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Badge tone="info">{t("teacher.one")}</Badge>
          </span>
        </div>
      </SectionCard>

      <SectionCard title={t("teacherPages.profile.details")}>
        {editing && draft ? (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <TextInput
                label={t("person.fullNameEnglish")}
                id={fieldId(FORM_ID, "fullName")}
                error={fieldErrors.fullName}
                required
                value={draft.fullName}
                onChange={(event) => setField("fullName", event.currentTarget.value)}
              />
              <TextInput
                label={t("person.fullNameThai")}
                id={fieldId(FORM_ID, "fullNameTh")}
                error={fieldErrors.fullNameTh}
                required
                placeholder={t("teacherPages.profile.thaiNamePlaceholder")}
                value={draft.fullNameTh}
                onChange={(event) => setField("fullNameTh", event.currentTarget.value)}
              />
              <TextInput
                label={t("person.phone")}
                id={fieldId(FORM_ID, "phone")}
                error={fieldErrors.phone}
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="081 234 5678"
                value={draft.phone}
                onChange={(event) => setField("phone", event.currentTarget.value)}
              />
              <TextInput
                label={t("person.lineId")}
                id={fieldId(FORM_ID, "lineId")}
                error={fieldErrors.lineId}
                required
                placeholder={t("teacherPages.profile.lineIdPlaceholder")}
                value={draft.lineId}
                onChange={(event) => setField("lineId", event.currentTarget.value)}
              />
            </SimpleGrid>

            <InlineMessage tone="info">{t("teacherPages.profile.managedByUs")}</InlineMessage>
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
