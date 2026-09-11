// src/modules/teacher/TeacherStudentDetailPage.tsx
import React, { useEffect, useState } from "react";
import {
  Anchor,
  Avatar,
  Button,
  Card,
  Center,
  Divider,
  FileInput,
  Grid,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabaseClient";
import { ReportList } from "../reports";
import { asRow } from "../../lib/supabaseRelations";
import { toFriendlyError } from "../../i18n/errors";
import {
  InlineMessage,
  LoadingState,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  isPhone,
  type FieldErrors,
} from "../../design-system";
import { gradeOptions } from "../admin/schoolProfile";

/** Namespaces this form's field ids. */
const FORM_ID = "teacher-student-edit";

type StudentEditField = "name" | "schoolId" | "guardian" | "phone";
const STUDENT_EDIT_ORDER: readonly StudentEditField[] = ["name", "schoolId", "guardian", "phone"];

type StudentContact = {
  phone: string | null;
  guardian: string | null;
  address: string | null;
  line_or_whatsapp: string | null;
};

type StudentDetail = {
  id: string;
  name: string | null;
  nickname: string | null;
  grade_level: string | null;
  village: string | null;
  bio: string | null;
  monthly_support_expected: number | null;
  contact: StudentContact | null;
  birthdate: string | null;
  school_id: string | null;
  profile_photo_path: string | null;
  school?: {
    id: string;
    name: string | null;
  } | null;
};

type SchoolOption = {
  value: string;
  label: string;
};

type ReportRow = {
  id: string;
  report_date: string | null;
  grade: string | null; // short grade label
  grade_text: string | null;
  info: string | null;
};

export const TeacherStudentDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { studentId } = useParams<{ studentId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);

  // profile photo
  const [profilePhotoPath, setProfilePhotoPath] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // 
  // editable fields
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<StudentEditField>>({});
  const [nickname, setNickname] = useState("");
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);
  const [village, setVillage] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>("");
  const [monthlySupport, setMonthlySupport] = useState<string>("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [contactPhone, setContactPhone] = useState("");
  const [contactGuardian, setContactGuardian] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactLineOrWhatsApp, setContactLineOrWhatsApp] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!studentId) {
        setError(t("errors.missingStudentId"));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        // Load student
        const { data, error: studentError } = await supabase
          .from("students")
          .select(
            `
            id,
            name,
            nickname,
            grade_level,
            profile_photo_path,
            village,
            bio,
            monthly_support_expected,
            contact,
            birthdate,
            school_id,
            school:schools ( id, name )
          `
          )
          .eq("id", studentId)
          .maybeSingle();

        if (studentError) {
          setError(toFriendlyError(studentError, "errors.load", "Error loading student"));
          setLoading(false);
          return;
        }

        if (!data) {
          setError(t("teacherPages.studentDetail.notFound"));
          setLoading(false);
          return;
        }

        const s = asRow<StudentDetail>(data);
        setStudent(s);

        // populate form fields
        setName(s.name ?? "");
        setNickname(s.nickname ?? "");
        setGradeLevel(s.grade_level);
        setVillage(s.village);
        setBio(s.bio);
        setMonthlySupport(
          s.monthly_support_expected != null
            ? String(s.monthly_support_expected)
            : ""
        );
        setProfilePhotoPath(s.profile_photo_path ?? null);
        setSchoolId(s.school_id);

        if (s.birthdate) {
          const d = new Date(s.birthdate);
          if (!Number.isNaN(d.getTime())) {
            setBirthdate(d);
          }
        }

        const c = (s.contact ?? {}) as StudentContact;
        setContactPhone(c.phone ?? "");
        setContactGuardian(c.guardian ?? "");
        setContactAddress(c.address ?? "");
        setContactLineOrWhatsApp(c.line_or_whatsapp ?? "");

        // Load schools for dropdown
        const { data: schoolRows, error: schoolsError } = await supabase
          .from("schools")
          .select("id, name")
          .order("name", { ascending: true });

        if (schoolsError) {
          console.error("Error loading schools", schoolsError);
        } else {
          setSchools(
            (schoolRows ?? []).map((row: any) => ({
              value: row.id as string,
              label: (row.name as string) || t("teacherPages.common.unnamedSchool"),
            }))
          );
        }

        // Load reports for this student
        const { data: reportRows, error: reportError } = await supabase
          .from("term_updates")
          .select(
            `
            id,
            report_date,
            grade,
            grade_text,
            info
          `
          )
          .eq("student_id", studentId)
          .order("report_date", { ascending: false });

        if (reportError) {
          console.error("Error loading reports for student", reportError);
        } else {
          setReports((reportRows ?? []) as ReportRow[]);
        }
      } catch (err: unknown) {
        setError(toFriendlyError(err, "errors.load", "Unexpected error loading student detail"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentId]);

  // ---------- derive public URL for photo ----------
  useEffect(() => {
    if (profilePhotoPath) {
      const { data } = supabase.storage
        .from("student-profiles")
        .getPublicUrl(profilePhotoPath);
      setProfilePhotoUrl(data.publicUrl);
    } else {
      setProfilePhotoUrl(null);
    }
  }, [profilePhotoPath]);

  // ---------- upload new photo ----------
  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    if (!studentId) return;

    setUploadingPhoto(true);
    setError(null);
    setMessage(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${studentId}.${fileExt}`;
      const filePath = `students/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("student-profiles")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        setError(t("person.photoFailed"));
        return;
      }

      const { error: updatePhotoError } = await supabase
        .from("students")
        .update({ profile_photo_path: filePath })
        .eq("id", studentId);

      if (updatePhotoError) {
        console.error(updatePhotoError);
        setError(t("teacherPages.studentDetail.photoLinkFailed"));
        return;
      }

      setProfilePhotoPath(filePath);
      setMessage(t("person.photoUpdated"));
    } catch (e) {
      console.error(e);
      setError(t("person.photoFailed"));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    // The same rules the admin form applies to the same row — including the
    // school, which this screen used to treat as optional, so a teacher could
    // save a student the admin form would have refused.
    const trimmedName = name.trim();
    const problems: FieldErrors<StudentEditField> = {};
    if (!trimmedName) problems.name = t("teacherPages.studentDetail.nameRequired");
    if (!contactGuardian.trim()) problems.guardian = t("student.guardianRequired");
    if (!contactPhone.trim()) {
      problems.phone = t("student.phoneRequired");
    } else if (!isPhone(contactPhone)) {
      problems.phone = t("person.phoneHint");
    }
    if (!schoolId) problems.schoolId = t("teacherPages.studentDetail.schoolRequired");
    setFieldErrors(problems);

    if (hasErrors(problems)) {
      setError(t("teacherPages.common.fieldsNeedAttention", { count: Object.keys(problems).length }));
      focusField(FORM_ID, firstError(problems, STUDENT_EDIT_ORDER));
      setSaving(false);
      return;
    }

    const contact: StudentContact = {
      phone: contactPhone.trim() || null,
      guardian: contactGuardian.trim() || null,
      address: contactAddress.trim() || null,
      line_or_whatsapp: contactLineOrWhatsApp.trim() || null,
    };

    const monthly =
      monthlySupport.trim() !== ""
        ? Number(monthlySupport.replace(",", "."))
        : null;

    const updatePayload: Partial<StudentDetail> & {
      contact: StudentContact;
      birthdate: string | null;
    } = {
      name: trimmedName,
      nickname: nickname.trim() || null,
      grade_level: gradeLevel || null,
      village: village || null,
      bio: bio || null,
      monthly_support_expected: monthly,
      contact,
      birthdate: birthdate ? birthdate.toISOString().slice(0, 10) : null,
      school_id: schoolId || null,
    };

    const { data, error: updateError } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId)
      .select()
      .single();

    setSaving(false);

    if (updateError) {
      setError(toFriendlyError(updateError, "errors.save", "Error updating student"));
      return;
    }

    if (!data) {
      setError(t("teacherPages.studentDetail.saveDenied"));
      return;
    }

    setStudent((prev) =>
      prev ? ({ ...prev, ...data } as StudentDetail) : (data as StudentDetail)
    );

    setMessage(t("teacherPages.studentDetail.saved", { name: trimmedName }));
  };

  if (loading) {
    return (
      <LoadingState />
    );
  }

  if (error && !student) {
    return (
      <Center mih="60vh">
        <Stack align="center">
          <Title order={3}>{t("teacherPages.studentDetail.title")}</Title>
          <InlineMessage tone="error">
            {error}
          </InlineMessage>
        </Stack>
      </Center>
    );
  }

  if (!student) {
    return (
      <Center mih="60vh">
        <Text>{t("teacherPages.studentDetail.notFound")}</Text>
      </Center>
    );
  }

  const displayName = student.name || t("teacherPages.common.unnamed");

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={3}>{t("teacherPages.studentDetail.title")}</Title>
      </Group>

      <Card withBorder component="form" onSubmit={handleSaveStudent}>
        <Stack gap="sm">
          {error && (
            <InlineMessage tone="error">
              {error}
            </InlineMessage>
          )}

          {message && (
            <InlineMessage tone="success">
              {message}
            </InlineMessage>
          )}

          <Grid gutter="md">
            {/* LEFT COLUMN: Photo */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="sm">
                <Text fw={500} size="sm" id={`${FORM_ID}-photo`}>
                  {t("teacherPages.studentDetail.photo")}
                </Text>
                <Divider />

                <Group>
                  <Avatar
                    size={96}
                    radius="xl"
                    src={profilePhotoUrl ?? undefined}
                    alt={t("teacherPages.studentDetail.photoAlt", { name: displayName })}
                  />
                </Group>

                {/* The heading above names this field, so no second visible label (R9). */}
                <FileInput
                  aria-labelledby={`${FORM_ID}-photo`}
                  placeholder={t("teacherPages.studentDetail.choosePhoto")}
                  value={profilePhotoFile}
                  onChange={setProfilePhotoFile}
                  accept="image/*"
                  disabled={uploadingPhoto}
                />
                <Button variant="default"
                  size="xs"
                  mt="xs"
                  onClick={() => handlePhotoUpload(profilePhotoFile)}
                  loading={uploadingPhoto}
                  disabled={!profilePhotoFile}
                >
                  {t("teacherPages.studentDetail.uploadPhoto")}
                </Button>
              </Stack>
            </Grid.Col>

            {/* RIGHT COLUMN: Main fields */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="sm">
                <TextInput
                  label={t("person.name")}
                  id={fieldId(FORM_ID, "name")}
                  error={fieldErrors.name}
                  required
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                />
                <TextInput
                  label={t("person.nickname")}
                  value={nickname}
                  onChange={(e) => setNickname(e.currentTarget.value)}
                />
                <Group grow>
                  <Select
                    label={t("student.gradeLevel")}
                    placeholder={t("teacherPages.studentDetail.gradePlaceholder")}
                    value={gradeLevel}
                    onChange={setGradeLevel}
                    // The same list the admin form writes. This picker used to
                    // offer "Grade 1…12" while the admin form took free text,
                    // so one column held four spellings of the same grade.
                    data={gradeOptions(gradeLevel)}
                    searchable
                    clearable
                  />
                  <TextInput
                    label={t("student.village")}
                    value={village ?? ""}
                    onChange={(e) => setVillage(e.currentTarget.value)}
                  />
                </Group>
                <Group grow>
                  <DateInput
                    label={t("student.birthdate")}
                    value={birthdate}
                    onChange={setBirthdate}
                    clearable
                  />
                  <Select
                    label={t("student.school")}
                    id={fieldId(FORM_ID, "schoolId")}
                    error={fieldErrors.schoolId}
                    required
                    placeholder={t("teacherPages.studentDetail.schoolPlaceholder")}
                    data={schools}
                    value={schoolId}
                    onChange={setSchoolId}
                    clearable
                  />
                </Group>
                <TextInput
                  label={t("student.monthlySupport")}
                  value={monthlySupport}
                  onChange={(e) => setMonthlySupport(e.currentTarget.value)}
                  placeholder="1000"
                />
              </Stack>
            </Grid.Col>
          </Grid>

          <Divider my="sm" />

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="sm">
                <Text fw={500} size="sm">
                  {t("teacherPages.studentDetail.guardianHeading")}
                </Text>
                <TextInput
                  label={t("student.guardian")}
                  id={fieldId(FORM_ID, "guardian")}
                  error={fieldErrors.guardian}
                  required
                  value={contactGuardian}
                  onChange={(e) => setContactGuardian(e.currentTarget.value)}
                />
                <TextInput
                  label={t("person.phone")}
                  id={fieldId(FORM_ID, "phone")}
                  error={fieldErrors.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.currentTarget.value)}
                />
                <TextInput
                  label={t("person.address")}
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.currentTarget.value)}
                />
                <TextInput
                  label={t("person.lineOrWhatsapp")}
                  value={contactLineOrWhatsApp}
                  onChange={(e) =>
                    setContactLineOrWhatsApp(e.currentTarget.value)
                  }
                />
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="sm">
                {/* One heading names the field; no repeated visible label (R9). */}
                <Text fw={500} size="sm" id={`${FORM_ID}-background`}>
                  {t("student.background")}
                </Text>
                <Textarea
                  aria-labelledby={`${FORM_ID}-background`}
                  minRows={4}
                  autosize
                  value={bio ?? ""}
                  onChange={(e) => setBio(e.currentTarget.value)}
                />
              </Stack>
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="sm">
            <Button type="submit" loading={saving}>
              {t("common.saveChanges")}
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Term reports, from the shared reports module — the same list, the same
          form and the same privacy rules the admin screens use. Written from
          here in a drawer, because a teacher writing a report is looking at the
          student while they write it. */}
      <Card withBorder>
        <Stack gap="sm">
          <Text fw={500}>{t("teacherPages.studentDetail.reports")}</Text>
          <ReportList studentId={studentId ?? ""} studentName={student?.name ?? null} />
        </Stack>
      </Card>
    </Stack>
  );
};

export default TeacherStudentDetailPage;