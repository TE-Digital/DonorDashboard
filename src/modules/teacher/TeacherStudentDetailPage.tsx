// src/modules/teacher/TeacherStudentDetailPage.tsx
import React, { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Divider,
  Badge,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase, Student, TermUpdate } from "../../lib/supabaseClient";

interface StudentDetail extends Student {
  school_name?: string | null;
  grant_type_name?: string | null;
}

interface TermUpdateRow extends TermUpdate {
  // We no longer rely on term_id; schema has been simplified
  term_name?: string | null;
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

type ScholarshipAwardRow = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null;
  currency: string | null;
  status: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  grant_types: { name: string | null } | null;
};

export const TeacherStudentDetailPage: React.FC = () => {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [reports, setReports] = useState<TermUpdateRow[]>([]);
  const [awards, setAwards] = useState<ScholarshipAwardRow[]>([]);

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

      // 1) Load schools for dropdown
      const { data: schoolRows, error: schoolError } = await supabase
        .from("schools")
        .select("id, name")
        .order("name", { ascending: true });

      if (schoolError) {
        console.error("Error loading schools", schoolError);
      } else {
        setSchools((schoolRows ?? []) as School[]);
      }

      // 2) Load student
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

      // 3) Load progress reports (FIX: no term_id in select)
      const { data: reportsData, error: reportsError } = await supabase
        .from("term_updates")
        .select(
          `
          id,
          student_id,
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
        console.error("Error loading reports", reportsError);
      }

      const mappedReports: TermUpdateRow[] =
        reportsData?.map((r: any) => ({
          id: r.id,
          student_id: r.student_id,
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

      // 4) Load scholarship awards for this student
      const { data: awardRows, error: awardError } = await supabase
        .from("scholarship_awards")
        .select(
          `
          id,
          period_start,
          period_end,
          amount_for_period,
          currency,
          status,
          is_paid,
          payment_date,
          grant_types ( name )
        `
        )
        .eq("student_id", studentId)
        .order("period_start", { ascending: false });

      if (awardError) {
        console.error("Error loading scholarship awards for student", awardError);
      }

      setAwards((awardRows ?? []) as ScholarshipAwardRow[]);

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
      setError("Please provide a guardian name and phone number.");
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

    setMessage("Student details have been saved.");
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
    navigate(`/teacher/reports/${selectedReport.id}/edit?studentId=${studentId}`);
  };

  if (loading) {
    return (
      <Group justify="center" mt="lg">
        <Loader />
      </Group>
    );
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
    <Stack gap="md">
      {/* HEADER CARD */}
      <Card withBorder radius="md">
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
                  Registered name: {student.name}
                </Text>
              )}
              <Group gap="xs">
                {student.school_name && (
                  <Badge variant="light" size="sm">
                    {student.school_name}
                  </Badge>
                )}
                {gradeLevel && (
                  <Badge variant="light" size="sm">
                    Grade {gradeLevel}
                  </Badge>
                )}
                {village && (
                  <Badge variant="outline" size="sm">
                    {village}
                  </Badge>
                )}
                {student.grant_type_name && (
                  <Badge variant="outline" size="sm">
                    {student.grant_type_name}
                  </Badge>
                )}
              </Group>
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
      </Card>

      {/* MAIN CONTENT */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* LEFT: editable student details */}
        <Card withBorder radius="md" component="form" onSubmit={handleSaveStudent}>
          <Stack gap="sm">
            <Text fw={600}>Student profile</Text>

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
              label="Student name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />

            <TextInput
              label="Nickname (shown to donors)"
              description="Optional name used in donor dashboards, emails, and progress reports."
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
              description="Update this when the student moves to the next grade."
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

        {/* RIGHT: scholarship & support + awards list */}
        <Card withBorder radius="md">
          <Stack gap="sm">
            <Text fw={600}>Scholarship & support</Text>

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
              <strong>Preferred grant type:</strong>{" "}
              {student.grant_type_name || "—"}
            </Text>
            <Text size="sm">
              <strong>Scholarship notes:</strong>{" "}
              {student.scholarship || "—"}
            </Text>
            <Text size="sm">
              <strong>Student created:</strong>{" "}
              {student.created_at
                ? new Date(student.created_at).toLocaleDateString()
                : "—"}
            </Text>

            <Divider my="sm" />

            <Text fw={600} size="sm">
              Scholarship awards
            </Text>

            {awards.length === 0 ? (
              <Text size="sm" c="dimmed">
                No scholarship awards recorded for this student yet.
              </Text>
            ) : (
              <ScrollArea>
                <Table
                  highlightOnHover
                  verticalSpacing="xs"
                  style={{ minWidth: 600 }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Grant type</Table.Th>
                      <Table.Th>Period</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Paid on</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {awards.map((a) => {
                      const periodLabel =
                        a.period_start && a.period_end
                          ? `${new Date(
                              a.period_start
                            ).toLocaleDateString()} – ${new Date(
                              a.period_end
                            ).toLocaleDateString()}`
                          : "—";

                      const amountLabel =
                        a.amount_for_period != null
                          ? `${a.amount_for_period.toLocaleString("en-US", {
                              maximumFractionDigits: 0,
                            })} ${a.currency || "THB"}`
                          : "—";

                      const status = (a.status || "").toLowerCase();
                      let statusColor: string = "gray";
                      if (status === "active") statusColor = "green";
                      else if (status === "planned") statusColor = "yellow";
                      else if (status === "completed") statusColor = "blue";
                      else if (status === "cancelled") statusColor = "red";

                      return (
                        <Table.Tr key={a.id}>
                          <Table.Td>
                            {a.grant_types?.name ?? "Scholarship"}
                          </Table.Td>
                          <Table.Td>{periodLabel}</Table.Td>
                          <Table.Td>{amountLabel}</Table.Td>
                          <Table.Td>
                            {a.status && (
                              <Badge
                                size="xs"
                                variant="light"
                                color={statusColor}
                              >
                                {a.status}
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {a.payment_date
                              ? new Date(
                                  a.payment_date
                                ).toLocaleDateString()
                              : "—"}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {/* PROGRESS REPORTS */}
      <Card withBorder radius="md">
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
            No progress reports yet. Use “Add report” to create the first one.
          </Text>
        ) : (
          <>
            <ScrollArea>
              <Table
                highlightOnHover
                verticalSpacing="xs"
                style={{ minWidth: 600 }}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Report date</Table.Th>
                    <Table.Th>Covers period</Table.Th>
                    <Table.Th>Progress summary</Table.Th>
                    <Table.Th>Comment for donor</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reports.map((r) => {
                    const isSelected = r.id === selectedReportId;
                    return (
                      <Table.Tr
                        key={r.id}
                        onClick={() => handleRowClick(r.id as string)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: isSelected
                            ? "var(--mantine-color-gray-1)"
                            : undefined,
                        }}
                      >
                        <Table.Td>
                          {r.report_date
                            ? new Date(r.report_date).toLocaleDateString()
                            : "—"}
                        </Table.Td>
                        <Table.Td>
                          {r.covers_start && r.covers_end
                            ? `${new Date(
                                r.covers_start
                              ).toLocaleDateString()} – ${new Date(
                                r.covers_end
                              ).toLocaleDateString()}`
                            : "—"}
                        </Table.Td>
                        <Table.Td>{r.grade_text || r.grade || "—"}</Table.Td>
                        <Table.Td>{r.donor_comment || r.info || "—"}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {/* RICH PREVIEW FOR SELECTED REPORT */}
            {selectedReport && (
              <>
                <Divider my="sm" />
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="sm">
                      Selected report – detailed view
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

export default TeacherStudentDetailPage;
