// src/modules/teacher/TeacherStudentDetailPage.tsx
import React, { useEffect, useState } from "react";
import {
  Alert,
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
import { supabase } from "../../lib/supabaseClient";
import { ReportList } from "../reports";
import { asRow } from "../../lib/supabaseRelations";
import {
  LoadingState,
} from "../../design-system";

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
        setError("Missing student id");
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
          console.error("Error loading student", studentError);
          setError("Could not load student details.");
          setLoading(false);
          return;
        }

        if (!data) {
          setError("Student not found.");
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
              label: (row.name as string) || "(no name)",
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
      } catch (err: any) {
        console.error("Unexpected error loading student detail", err);
        setError(err.message ?? "Unexpected error while loading student.");
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
        setError("Photo upload failed.");
        return;
      }

      const { error: updatePhotoError } = await supabase
        .from("students")
        .update({ profile_photo_path: filePath })
        .eq("id", studentId);

      if (updatePhotoError) {
        console.error(updatePhotoError);
        setError("Student saved, but unable to link photo.");
        return;
      }

      setProfilePhotoPath(filePath);
      setMessage("Photo updated.");
    } catch (e) {
      console.error(e);
      setError("Unexpected error while uploading photo.");
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

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Student name is required.");
      setSaving(false);
      return;
    }
    if (!contactPhone.trim() || !contactGuardian.trim()) {
      setError("Please provide a guardian name and phone number.");
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
      console.error("Error updating student", updateError);
      setError(updateError.message);
      return;
    }

    if (!data) {
      setError(
        "Student could not be updated. You may not have permission to edit this record."
      );
      return;
    }

    setStudent((prev) =>
      prev ? ({ ...prev, ...data } as StudentDetail) : (data as StudentDetail)
    );

    setMessage("Student details have been saved.");
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
          <Title order={3}>Student details</Title>
          <Alert color="red" variant="light">
            {error}
          </Alert>
        </Stack>
      </Center>
    );
  }

  if (!student) {
    return (
      <Center mih="60vh">
        <Text>Student could not be found.</Text>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>Student details</Title>
          <Text size="sm" c="dimmed">
            View and update the basic information for this student.
          </Text>
        </div>
      </Group>

      <Card withBorder component="form" onSubmit={handleSaveStudent}>
        <Stack gap="sm">
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          {message && (
            <Alert color="green" variant="light">
              {message}
            </Alert>
          )}

          <Grid gutter="md">
            {/* LEFT COLUMN: Photo */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="sm">
                <Text fw={500} size="sm">
                  Photo
                </Text>
                <Divider />

                <Group>
                  <Avatar
                    size={96}
                    radius="xl"
                    src={profilePhotoUrl ?? undefined}
                  />
                </Group>

                <FileInput
                  label="Profile photo"
                  placeholder="Upload image"
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
                  Upload
                </Button>
              </Stack>
            </Grid.Col>

            {/* RIGHT COLUMN: Main fields */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="sm">
                <TextInput
                  label="Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                />
                <TextInput
                  label="Nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.currentTarget.value)}
                />
                <Group grow>
                  <Select
                    label="Grade level"
                    placeholder="Select grade"
                    value={gradeLevel}
                    onChange={setGradeLevel}
                    data={Array.from({ length: 12 }, (_, i) => {
                      const val = String(i + 1);
                      return { value: val, label: `Grade ${val}` };
                    })}
                    clearable
                  />
                  <TextInput
                    label="Village / community"
                    value={village ?? ""}
                    onChange={(e) => setVillage(e.currentTarget.value)}
                  />
                </Group>
                <Group grow>
                  <DateInput
                    label="Birthdate"
                    value={birthdate}
                    onChange={setBirthdate}
                    clearable
                  />
                  <Select
                    label="School"
                    placeholder="Select school"
                    data={schools}
                    value={schoolId}
                    onChange={setSchoolId}
                    clearable
                  />
                </Group>
                <TextInput
                  label="Expected monthly support (THB)"
                  value={monthlySupport}
                  onChange={(e) => setMonthlySupport(e.currentTarget.value)}
                  placeholder="e.g. 1000"
                />
              </Stack>
            </Grid.Col>
          </Grid>

          <Divider my="sm" />

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="sm">
                <Text fw={500} size="sm">
                  Guardian / contact details
                </Text>
                <TextInput
                  label="Guardian name"
                  required
                  value={contactGuardian}
                  onChange={(e) => setContactGuardian(e.currentTarget.value)}
                />
                <TextInput
                  label="Phone number"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.currentTarget.value)}
                />
                <TextInput
                  label="Address"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.currentTarget.value)}
                />
                <TextInput
                  label="LINE / WhatsApp"
                  value={contactLineOrWhatsApp}
                  onChange={(e) =>
                    setContactLineOrWhatsApp(e.currentTarget.value)
                  }
                />
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="sm">
                <Text fw={500} size="sm">
                  Background / notes
                </Text>
                <Textarea
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
              Save changes
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
          <Text fw={500}>Term updates</Text>
          <ReportList studentId={studentId ?? ""} studentName={student?.name ?? null} />
        </Stack>
      </Card>
    </Stack>
  );
};

export default TeacherStudentDetailPage;