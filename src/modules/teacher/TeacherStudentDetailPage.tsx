// src/modules/teacher/TeacherStudentDetailPage.tsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  NumberInput,
  Avatar,
  Divider,
  Select,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase, Student, TermUpdate } from "../../lib/supabaseClient";

interface StudentDetail extends Student {
  school_name?: string | null;
  grant_type_name?: string | null;
}

interface TermUpdateRow extends TermUpdate {
  term_name?: string | null; // kept for backward-compatibility, but no longer displayed as "Term"
}

type AttachmentPreview = {
  url: string;
  is_public: boolean;
  path: string;
};

type School = {
  id: string;
  name: string;
};

export const TeacherStudentDetailPage: React.FC = () => {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [reports, setReports] = useState<TermUpdateRow[]>([]);

  // schools for dropdown
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // editable fields
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [village, setVillage] = useState("");
  const [bio, setBio] = useState("");
  const [monthlySupport, setMonthlySupport] = useState<string>("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactGuardian, setContactGuardian] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactLineOrWhatsApp, setContactLineOrWhatsApp] = useState("");

  // birthday / age
  const [birthdate, setBirthdate] = useState<Date | null>(null);

  // profile photo
  const [profilePhotoPath, setProfilePhotoPath] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // selected report & richer preview
  const selectedReportId = searchParams.get("reportId") || null;
  const [selectedAttachments, setSelectedAttachments] = useState<
    AttachmentPreview[]
  >([]);

  useEffect(() => {
    const load = async () => {
      if (!studentId) return;
      setLoading(true);
      setError(null);

      // Load schools for dropdown
      const { data: schoolRows, error: schoolError } = await supabase
        .from("schools")
        .select("id, name")
        .order("name", { ascending: true });

      if (schoolError) {
        console.error("Error loading schools", schoolError);
      } else {
        setSchools((schoolRows ?? []) as School[]);
      }

      // ---- Load student ----
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(
          `
          id,
          name,
          nickname,
          school_id,
          scholarship,
          responsible_teacher_id,
          created_at,
          grant_type_id,
          birthdate,
          grade_level,
          village,
          bio,
          monthly_support_expected,
          contact,
          profile_photo_path,
          schools(name),
          grant_types(name)
        `
        )
        .eq("id", studentId)
        .single();

      if (studentError || !studentData) {
        console.error(studentError);
        setError("Could not load student.");
        setLoading(false);
        return;
      }

      const detail: StudentDetail = {
        id: studentData.id,
        name: studentData.name,
        nickname: studentData.nickname,
        school_id: studentData.school_id,
        scholarship: studentData.scholarship,
        responsible_teacher_id: studentData.responsible_teacher_id,
        created_at: studentData.created_at,
        grant_type_id: studentData.grant_type_id,
        birthdate: studentData.birthdate,
        grade_level: studentData.grade_level,
        village: studentData.village,
        bio: studentData.bio,
        monthly_support_expected: studentData.monthly_support_expected,
        contact: studentData.contact,
        profile_photo_path: studentData.profile_photo_path,
        school_name: studentData.schools?.name ?? null,
        grant_type_name: studentData.grant_types?.name ?? null,
      };

      setStudent(detail);

      // fill editable fields
      setName(detail.name ?? "");
      setNickname(detail.nickname ?? "");
      setGradeLevel(detail.grade_level ?? "");
      setVillage(detail.village ?? "");
      setBio(detail.bio ?? "");
      setMonthlySupport(
        detail.monthly_support_expected != null
          ? String(detail.monthly_support_expected)
          : ""
      );
      setSchoolId(detail.school_id ?? null);

      const contact = (detail.contact as any) ?? {};
      setContactPhone(contact.phone ?? "");
      setContactGuardian(contact.guardian ?? "");
      setContactAddress(contact.address ?? "");
      setContactLineOrWhatsApp(contact.line_or_whatsapp ?? "");

      setBirthdate(detail.birthdate ? new Date(detail.birthdate) : null);
      setProfilePhotoPath(detail.profile_photo_path ?? null);

      // ---- Load reports ----
      const { data: reportsData, error: reportsError } = await supabase
        .from("term_updates")
        .select(
          `
          id,
          student_id,
          term_id,
          grade,
          info,
          attachments,
          created_at,
          grade_text,
          grade_numeric,
          report_date,
          covers_start,
          covers_end,
          donor_comment,
          internal_note
        `
        )
        .eq("student_id", studentId)
        .order("report_date", { ascending: false });

      if (reportsError) {
        console.error(reportsError);
      }

      const mappedReports: TermUpdateRow[] =
        reportsData?.map((r: any) => ({
          id: r.id,
          student_id: r.student_id,
          term_id: r.term_id,
          grade: r.grade,
          info: r.info,
          attachments: r.attachments,
          created_at: r.created_at,
          grade_text: r.grade_text,
          grade_numeric: r.grade_numeric,
          report_date: r.report_date,
          covers_start: r.covers_start,
          covers_end: r.covers_end,
          term_name: null,
          donor_comment: r.donor_comment,
          internal_note: r.internal_note,
        })) ?? [];

      setReports(mappedReports);
      setLoading(false);
    };

    load();
  }, [studentId]);

  // resolve profile photo URL
  useEffect(() => {
    if (!profilePhotoPath) {
      setProfilePhotoUrl(null);
      return;
    }

    const { data } = supabase.storage
      .from("student-profiles")
      .getPublicUrl(profilePhotoPath);
    setProfilePhotoUrl(data.publicUrl);
  }, [profilePhotoPath]);

  // compute age from birthdate
  const age =
    birthdate != null
      ? Math.floor(
          (Date.now() - birthdate.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25)
        )
      : null;

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
      setError("Phone and guardian are required (contact information).");
      setSaving(false);
      return;
    }

    const contact = {
      phone: contactPhone.trim(),
      guardian: contactGuardian.trim(),
      address: contactAddress.trim() || null,
      line_or_whatsapp: contactLineOrWhatsApp.trim() || null,
    };

    const monthly =
      monthlySupport.trim() !== ""
        ? Number(monthlySupport.replace(",", "."))
        : null;

    const updatePayload: any = {
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

    const { error: updateError } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId);

    setSaving(false);

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setMessage("Changes saved.");
  };

  const handlePhotoUpload = async (file: File | null) => {
    if (!file || !studentId) return;

    try {
      setUploadingPhoto(true);
      setError(null);

      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${studentId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("student-profiles")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error(uploadError);
        setError(uploadError.message);
        setUploadingPhoto(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("students")
        .update({ profile_photo_path: filePath })
        .eq("id", studentId);

      if (updateError) {
        console.error(updateError);
        setError(updateError.message);
        setUploadingPhoto(false);
        return;
      }

      setProfilePhotoPath(filePath);
      setMessage("Profile photo updated.");
      setUploadingPhoto(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error uploading photo.");
      setUploadingPhoto(false);
    }
  };

  const selectedReport = selectedReportId
    ? reports.find((r) => r.id === selectedReportId)
    : null;

  // richer preview: resolve attachments for selected report
  useEffect(() => {
    const resolveAttachments = async () => {
      if (!selectedReport || !selectedReport.attachments) {
        setSelectedAttachments([]);
        return;
      }

      try {
        const raw = selectedReport.attachments as any[];

        const previews: AttachmentPreview[] = [];

        for (const a of raw) {
          // Support both { path, is_public } and legacy string entries
          const path =
            typeof a === "string" ? (a as string) : (a.path as string | undefined);
          if (!path) continue;

          const is_public =
            typeof a === "string"
              ? true
              : a.is_public === undefined
              ? true
              : !!a.is_public;

          const { data, error } = await supabase.storage
            .from("progress-photos")
            .createSignedUrl(path, 60 * 60); // 1 hour

          if (error || !data?.signedUrl) {
            console.error("Error creating signed URL for", path, error);
            continue;
          }

          previews.push({
            url: data.signedUrl,
            is_public,
            path,
          });
        }

        setSelectedAttachments(previews);
      } catch (err) {
        console.error("Error resolving attachments", err);
        setSelectedAttachments([]);
      }
    };

    resolveAttachments();
  }, [selectedReport]);

  const handleRowClick = (reportId: string) => {
    if (!studentId) return;
    navigate(`/teacher/students/${studentId}?reportId=${reportId}`);
  };

  const handleEditSelectedReport = () => {
    if (!selectedReport || !studentId) return;
    navigate(
      `/teacher/reports/${selectedReport.id}/edit?studentId=${studentId}`
    );
  };

  if (loading) {
    return <Loader />;
  }

  if (!student) {
    return <Text>Student not found.</Text>;
  }

  const schoolOptions = schools.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const displayName =
    nickname && nickname.trim().length > 0
      ? `${nickname} (${student.name})`
      : student.name;

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Group align="center" gap="md">
          <Avatar
            src={profilePhotoUrl || undefined}
            radius="xl"
            size={72}
            alt={student.name}
          >
            {!profilePhotoUrl && student.name ? student.name.charAt(0) : null}
          </Avatar>
          <Stack gap={4}>
            <Title order={3}>{displayName}</Title>
            {nickname && nickname.trim().length > 0 && (
              <Text size="xs" c="dimmed">
                Legal name: {student.name}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              {student.school_name || "No school assigned"}
            </Text>
          </Stack>
        </Group>

        <Group>
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              navigate(`/teacher/reports/new?studentId=${student.id}`)
            }
          >
            Add report
          </Button>
          <Button size="xs" variant="subtle" onClick={() => navigate(-1)}>
            Back
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {/* LEFT: editable student details */}
        <Card withBorder component="form" onSubmit={handleSaveStudent}>
          <Stack gap="sm">
            <Text fw={600}>Student details</Text>

            {/* Profile photo upload */}
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Profile photo
              </Text>
              <FileInput
                size="xs"
                accept="image/*"
                placeholder="Upload a new profile photo"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
              {uploadingPhoto && (
                <Text size="xs" c="dimmed">
                  Uploading…
                </Text>
              )}
            </Stack>

            <TextInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />

            <TextInput
              label="Nickname (shared with donor)"
              description="Optional name used in donor-facing dashboards, emails, and reports."
              value={nickname}
              onChange={(e) => setNickname(e.currentTarget.value)}
            />

            <Group grow>
              <DateInput
                label="Birthday"
                value={birthdate}
                onChange={setBirthdate}
                valueFormat="YYYY-MM-DD"
              />
              <TextInput
                label="Age (approx.)"
                value={age != null ? `${age} years` : "—"}
                readOnly
              />
            </Group>

            <Select
              label="School"
              placeholder="Select school"
              data={schoolOptions}
              value={schoolId}
              onChange={(value) => setSchoolId(value)}
              clearable
            />

            <TextInput
              label="Current grade level"
              description="You can adjust this when the student moves to the next grade."
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.currentTarget.value)}
            />

            <TextInput
              label="Village"
              value={village}
              onChange={(e) => setVillage(e.currentTarget.value)}
            />

            <Group grow>
              <TextInput
                label="Guardian name"
                value={contactGuardian}
                onChange={(e) => setContactGuardian(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.currentTarget.value)}
                required
              />
            </Group>

            <TextInput
              label="LINE / WhatsApp"
              value={contactLineOrWhatsApp}
              onChange={(e) => setContactLineOrWhatsApp(e.currentTarget.value)}
            />

            <Textarea
              label="Address"
              minRows={2}
              value={contactAddress}
              onChange={(e) => setContactAddress(e.currentTarget.value)}
            />

            <Textarea
              label="Student background / bio"
              placeholder="Short background information, family situation, learning needs, etc."
              minRows={3}
              value={bio}
              onChange={(e) => setBio(e.currentTarget.value)}
            />

            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}
            {message && (
              <Text size="sm" c="green">
                {message}
              </Text>
            )}

            <Group justify="flex-end" mt="sm">
              <Button type="submit" size="sm" loading={saving}>
                Save changes
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* RIGHT: additional info */}
        <Card withBorder>
          <Text fw={600} mb="xs">
            Additional information
          </Text>
          <Stack gap={8}>
            <Text size="sm">
              <strong>Grant type:</strong>{" "}
              {student.grant_type_name || "—"}
            </Text>
            <NumberInput
              label="Monthly support expected (THB)"
              value={
                monthlySupport !== ""
                  ? Number(monthlySupport.replace(",", "."))
                  : undefined
              }
              onChange={(val) =>
                setMonthlySupport(
                  typeof val === "number" ? String(val) : ""
                )
              }
              min={0}
            />
            <Text size="sm">
              <strong>Scholarship:</strong>{" "}
              {student.scholarship || "—"}
            </Text>
            <Text size="sm">
              <strong>Created:</strong>{" "}
              {student.created_at
                ? new Date(student.created_at).toLocaleDateString()
                : "—"}
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* PROGRESS REPORTS */}
      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Progress reports</Text>
          <Button
            size="xs"
            onClick={() =>
              navigate(`/teacher/reports/new?studentId=${student.id}`)
            }
          >
            Add report
          </Button>
        </Group>

        {reports.length === 0 ? (
          <Text size="sm" c="dimmed">
            No reports yet.
          </Text>
        ) : (
          <>
            <Box style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead
                  style={{
                    backgroundColor: "var(--mantine-color-gray-0)",
                  }}
                >
                  <tr>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>
                      Report date
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>
                      Covers
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>
                      Progress summary
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>
                      Comment for donor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const isSelected = r.id === selectedReportId;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => handleRowClick(r.id as string)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: isSelected
                            ? "var(--mantine-color-gray-1)"
                            : undefined,
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 12px",
                            borderTop: "1px solid #eee",
                          }}
                        >
                          {r.report_date
                            ? new Date(
                                r.report_date
                              ).toLocaleDateString()
                            : "—"}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            borderTop: "1px solid #eee",
                          }}
                        >
                          {r.covers_start && r.covers_end
                            ? `${new Date(
                                r.covers_start
                              ).toLocaleDateString()} – ${new Date(
                                r.covers_end
                              ).toLocaleDateString()}`
                            : "—"}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            borderTop: "1px solid #eee",
                          }}
                        >
                          {r.grade_text || r.grade || "—"}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            borderTop: "1px solid #eee",
                          }}
                        >
                          {r.donor_comment || r.info || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>

            {/* RICH PREVIEW FOR SELECTED REPORT */}
            {selectedReport && (
              <>
                <Divider my="sm" />
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="sm">
                      Selected report – detailed preview
                    </Text>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={handleEditSelectedReport}
                    >
                      Edit this report
                    </Button>
                  </Group>

                  <Text size="sm">
                    <strong>Report date:</strong>{" "}
                    {selectedReport.report_date
                      ? new Date(
                          selectedReport.report_date
                        ).toLocaleDateString()
                      : "—"}
                  </Text>
                  <Text size="sm">
                    <strong>Covers:</strong>{" "}
                    {selectedReport.covers_start &&
                    selectedReport.covers_end
                      ? `${new Date(
                          selectedReport.covers_start
                        ).toLocaleDateString()} – ${new Date(
                          selectedReport.covers_end
                        ).toLocaleDateString()}`
                      : "—"}
                  </Text>
                  <Text size="sm">
                    <strong>Progress summary:</strong>{" "}
                    {selectedReport.grade_text ||
                      selectedReport.grade ||
                      "—"}
                  </Text>
                  <Text size="sm">
                    <strong>Grade (numeric):</strong>{" "}
                    {typeof selectedReport.grade_numeric === "number"
                      ? selectedReport.grade_numeric
                      : "—"}
                  </Text>
                  <Text size="sm">
                    <strong>Comment for donor:</strong>{" "}
                    {selectedReport.donor_comment ||
                      selectedReport.info ||
                      "—"}
                  </Text>
                  <Text size="sm">
                    <strong>Internal note:</strong>{" "}
                    {selectedReport.internal_note || "—"}
                  </Text>

                  {/* Attachments preview if available */}
                  {selectedAttachments.length > 0 && (
                    <Stack gap={4} mt="xs">
                      <Text size="sm" fw={500}>
                        Photos / attachments
                      </Text>
                      <Group gap="xs">
                        {selectedAttachments.map((a) => (
                          <Box
                            key={a.path}
                            style={{
                              width: 90,
                              height: 90,
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid #ddd",
                              position: "relative",
                              flexShrink: 0,
                              cursor: "pointer",
                            }}
                            onClick={() => window.open(a.url, "_blank")}
                          >
                            <img
                              src={a.url}
                              alt={a.path}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                            {!a.is_public && (
                              <Box
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  background: "rgba(0,0,0,0.55)",
                                  color: "white",
                                  fontSize: 9,
                                  padding: "2px 4px",
                                  textAlign: "center",
                                }}
                              >
                                Internal only
                              </Box>
                            )}
                          </Box>
                        ))}
                      </Group>
                    </Stack>
                  )}
                </Stack>
              </>
            )}
          </>
        )}
      </Card>
    </Stack>
  );
};
