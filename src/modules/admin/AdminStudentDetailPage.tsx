// src/modules/admin/AdminStudentDetailPage.tsx
import React, { useEffect, useState } from "react";
import {
  Anchor,  
  Card,
  Stack,
  Text,
  TextInput,
  Group,
  Button,
  Select,
  Textarea,
  Grid,
  Divider,
  Avatar,
  FileInput,
  Table,
  Badge,
  Image,
} from "@mantine/core";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { LoadingState, StatusBadge } from "../../design-system";

type School = { id: string; name: string };
type TeacherOption = { value: string; label: string };
type GrantTypeOption = { value: string; label: string };

type ScholarshipAwardRow = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null;
  currency: string | null;
  status: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  grant_type_name: string | null;
};

type ReportAttachment = {
  path: string;
  is_public?: boolean | null;
  publicUrl?: string;
};

type ReportRow = {
  id: string;
  report_date: string | null;
  info: string | null;
  grade_text: string | null;
  donor_comment: string | null;
  internal_note: string | null;
  created_at: string | null;
  attachments: ReportAttachment[] | null;
};

export const AdminStudentDetailPage: React.FC = () => {
  // Support both /students/:studentId and /students/:id
  const params = useParams<{ studentId?: string; id?: string }>();
  const routeStudentId = params.studentId ?? params.id ?? "";
  const isNew = !routeStudentId || routeStudentId === "create";

  const navigate = useNavigate();

  const studentIdForLinks = !isNew && routeStudentId ? routeStudentId : null;
  const studentQueryParam = studentIdForLinks
    ? `?studentId=${studentIdForLinks}`
    : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // main fields
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [gradeLevel, setGradeLevel] = useState("");
  const [village, setVillage] = useState("");
  const [birthdate, setBirthdate] = useState("2010-01-01");
  const [monthlySupport, setMonthlySupport] = useState("");
  const [bio, setBio] = useState("");

  // contact
  const [contactPhone, setContactPhone] = useState("");
  const [contactGuardian, setContactGuardian] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactLineOrWhatsApp, setContactLineOrWhatsApp] = useState("");

  // teacher & grant
  const [teacherProfileId, setTeacherProfileId] = useState<string | null>(null);
  const [grantTypeId, setGrantTypeId] = useState<string | null>(null);

  // profile photo
  const [profilePhotoPath, setProfilePhotoPath] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [schools, setSchools] = useState<School[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [grantTypeOptions, setGrantTypeOptions] = useState<GrantTypeOption[]>(
    []
  );

  // scholarships + reports
  const [scholarships, setScholarships] = useState<ScholarshipAwardRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // helper: image extension check
  const isImagePath = (path: string) =>
    /\.(jpe?g|png|webp|gif)$/i.test(path.split("?")[0] ?? "");

  // ---------- lookups ----------
  const loadLookups = async () => {
    const { data: schoolRows } = await supabase
      .from("schools")
      .select("id, name")
      .order("name", { ascending: true });
    setSchools((schoolRows ?? []) as School[]);

    const { data: roleRows } = await supabase
      .from("person_roles")
      .select("user_id")
      .eq("role", "teacher");

    const teacherProfileIds = Array.from(
      new Set((roleRows ?? []).map((r: any) => r.user_id as string))
    );

    if (teacherProfileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherProfileIds);

      setTeacherOptions(
        (profileRows ?? []).map((p: any) => ({
          value: p.id as string,
          label: (p.full_name as string) || "(no name)",
        }))
      );
    } else {
      setTeacherOptions([]);
    }

    const { data: gtRows, error: gtError } = await supabase
      .from("grant_types")
      .select("id, name")
      .order("name", { ascending: true });

    if (gtError) {
      console.error("Error loading grant types", gtError);
      setGrantTypeOptions([]);
    } else {
      setGrantTypeOptions(
        (gtRows ?? []).map((g: any) => ({
          value: g.id as string,
          label: (g.name as string) || "(no name)",
        }))
      );
    }
  };

  // ---------- load scholarships + reports ----------
  const loadScholarshipsAndReports = async (sid: string) => {
    try {
      const [
        { data: schRows, error: schError },
        { data: repRows, error: repError },
      ] = await Promise.all([
        supabase
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
          .eq("student_id", sid)
          .order("period_start", { ascending: false }),
        supabase
          .from("term_updates")
          .select(
            "id, report_date, info, grade_text, donor_comment, internal_note, created_at, attachments"
          )
          .eq("student_id", sid)
          .order("report_date", { ascending: false }),
      ]);

      if (schError) {
        console.error("Error loading scholarships for student", schError);
      } else {
        const mapped: ScholarshipAwardRow[] = (schRows ?? []).map((r: any) => ({
          id: r.id as string,
          period_start: r.period_start ?? null,
          period_end: r.period_end ?? null,
          amount_for_period: r.amount_for_period ?? null,
          currency: r.currency ?? null,
          status: r.status ?? null,
          is_paid: r.is_paid ?? null,
          payment_date: r.payment_date ?? null,
          grant_type_name: r.grant_types?.name ?? null,
        }));
        setScholarships(mapped);
      }

      if (repError) {
        console.error("Error loading reports for student", repError);
      } else {
        // build signed URLs only for image attachments
        const mappedReports: ReportRow[] = await Promise.all(
          (repRows ?? []).map(async (r: any) => {
            const rawAttachments =
              (r.attachments as { path: string; is_public?: boolean | null }[] | null) ??
              null;

            let attachments: ReportAttachment[] | null = null;

            if (rawAttachments && rawAttachments.length > 0) {
              const imageAttachments = rawAttachments.filter(
                (att) => att?.path && isImagePath(att.path)
              );

              if (imageAttachments.length > 0) {
                attachments = await Promise.all(
                  imageAttachments.map(async (att) => {
                    try {
                      const { data, error } = await supabase.storage
                        .from("progress-photos")
                        .createSignedUrl(att.path, 60 * 60); // 1 hour

                      return {
                        path: att.path,
                        is_public: att.is_public,
                        publicUrl: !error && data?.signedUrl ? data.signedUrl : undefined,
                      };
                    } catch (e) {
                      console.error(
                        "Error creating signed URL for admin report photo",
                        e
                      );
                      return {
                        path: att.path,
                        is_public: att.is_public,
                        publicUrl: undefined,
                      };
                    }
                  })
                );
              }
            }

            return {
              id: r.id as string,
              report_date: r.report_date ?? null,
              info: r.info ?? null,
              grade_text: r.grade_text ?? null,
              donor_comment: r.donor_comment ?? null,
              internal_note: r.internal_note ?? null,
              created_at: r.created_at ?? null,
              attachments,
            };
          })
        );

        setReports(mappedReports);
      }
    } catch (e) {
      console.error("Unexpected error loading scholarships/reports", e);
    }
  };

  // ---------- load student ----------
  const loadStudent = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await loadLookups();

      // New student: no DB row yet
      if (isNew || !routeStudentId) {
        return;
      }

      const { data, error: studentError } = await supabase
        .from("students")
        .select(
          `
        id,
        name,
        nickname,
        school_id,
        grade_level,
        village,
        scholarship,
        contact,
        birthdate,
        monthly_support_expected,
        responsible_teacher_id,
        bio,
        profile_photo_path,
        grant_type_id
      `
        )
        .eq("id", routeStudentId)
        .maybeSingle();

      if (studentError || !data) {
        console.error("Error loading student", studentError);
        setError("Could not load student.");
        return;
      }

      setName(data.name ?? "");
      setNickname(data.nickname ?? "");
      setSchoolId(data.school_id ?? null);
      setGradeLevel(data.grade_level ?? "");
      setVillage(data.village ?? "");
      setBirthdate(data.birthdate ?? "2010-01-01");
      setMonthlySupport(
        data.monthly_support_expected != null
          ? String(data.monthly_support_expected)
          : ""
      );
      setBio(data.bio ?? "");
      setProfilePhotoPath(data.profile_photo_path ?? null);
      setGrantTypeId(data.grant_type_id ?? null);

      const contact = data.contact ?? {};
      setContactPhone(contact.phone ?? "");
      setContactGuardian(contact.guardian ?? "");
      setContactAddress(contact.address ?? "");
      setContactLineOrWhatsApp(contact.line_or_whatsapp ?? "");
      setTeacherProfileId(data.responsible_teacher_id ?? null);

      await loadScholarshipsAndReports(data.id);
    } catch (e) {
      console.error("Unexpected error loading student", e);
      setError("Unexpected error while loading student.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStudentId, isNew]);

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

  // ---------- upload new photo (only for existing students) ----------
  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;

    if (isNew || !routeStudentId) {
      setError("Please save the student first before uploading a photo.");
      return;
    }

    const sid = routeStudentId;

    setUploadingPhoto(true);
    setError(null);
    setMessage(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${sid}.${fileExt}`;
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
        .eq("id", sid);

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

  // ---------- submit (insert OR update) ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      setError("Phone and guardian name are required (for contact).");
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

    let scholarshipLabel: string | null = null;
    if (grantTypeId) {
      const gt = grantTypeOptions.find((g) => g.value === grantTypeId);
      scholarshipLabel = gt?.label ?? null;
    }

    const payload: any = {
      name: trimmedName,
      nickname: nickname.trim() || null,
      school_id: schoolId,
      grade_level: gradeLevel || null,
      village: village || null,
      scholarship: scholarshipLabel,
      contact,
      birthdate: birthdate || null,
      monthly_support_expected: monthly,
      bio: bio || null,
      responsible_teacher_id: teacherProfileId,
      grant_type_id: grantTypeId,
    };

    try {
      let currentId: string | null =
        !isNew && routeStudentId ? routeStudentId : null;

      if (!currentId) {
        // INSERT
        const { data, error: insertError } = await supabase
          .from("students")
          .insert(payload)
          .select("id")
          .maybeSingle();

        if (insertError) {
          console.error(insertError);
          setError("Could not create student. Please try again.");
          return;
        }
        currentId = data?.id ?? null;

        if (!currentId) {
          setError("Student created, but no ID returned.");
          return;
        }

        setMessage("Student created successfully.");
        navigate(`/admin/students/${currentId}`, { replace: true });
      } else {
        // UPDATE
        const { error: updateError } = await supabase
          .from("students")
          .update(payload)
          .eq("id", currentId);

        if (updateError) {
          console.error(updateError);
          setError("Could not save student. Please try again.");
          return;
        }

        setMessage("Student updated successfully.");
        await loadScholarshipsAndReports(currentId);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Unexpected error while saving student.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !routeStudentId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this student? This cannot be undone."
    );
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", routeStudentId);

    if (deleteError) {
      console.error(deleteError);
      setError("Could not delete student.");
      return;
    }

    navigate("/admin/students");
  };

  const title = isNew ? "Add student" : "Student details";

  return (
    <Card withBorder shadow="sm" radius="md" pos="relative" p="lg">
      <LoadingState variant="overlay" visible={loading || saving} />

      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={700} size="lg">
              {title}
            </Text>
            <Text size="sm" c="dimmed">
              {isNew
                ? "Create a new student, link them to a school and teacher, and capture the minimum contact details."
                : "Edit the student's information, contact details, and see related scholarships and reports."}
            </Text>
          </div>

          {!isNew && (
            <Group gap="xs">
              <Button variant="outline" color="red" onClick={handleDelete}>
                Delete
              </Button>
            </Group>
          )}
        </Group>

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        {message && (
          <Text c="green" size="sm">
            {message}
          </Text>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <Grid gutter="md">
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
                    >
                      {name ? name.charAt(0) : "?"}
                    </Avatar>
                  </Group>

                  <FileInput
                    label="Profile photo"
                    placeholder="Upload image"
                    value={profilePhotoFile}
                    onChange={setProfilePhotoFile}
                    accept="image/*"
                    disabled={uploadingPhoto}
                  />
                  <Button
                    size="xs"
                    mt="xs"
                    onClick={() => handlePhotoUpload(profilePhotoFile)}
                    loading={uploadingPhoto}
                    disabled={!profilePhotoFile || isNew}
                  >
                    {isNew ? "Save student first" : "Upload"}
                  </Button>
                </Stack>
              </Grid.Col>

              {/* RIGHT COLUMN: form fields */}
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap="sm">
                  <TextInput
                    label="Student name"
                    required
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                  />

                  <TextInput
                    label="Nickname (shared with donor)"
                    description="Optional name used in donor-facing dashboards, emails, and reports."
                    value={nickname}
                    onChange={(e) => setNickname(e.currentTarget.value)}
                  />

                  <Group grow>
                    <Select
                      label="School"
                      placeholder="Select school"
                      data={schools.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      value={schoolId}
                      onChange={setSchoolId}
                      clearable
                    />

                    <TextInput
                      label="Grade level"
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.currentTarget.value)}
                      placeholder="e.g. P4, M2"
                    />
                  </Group>

                  <Group grow>
                    <TextInput
                      label="Birthdate"
                      type="date"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Village"
                      value={village}
                      onChange={(e) => setVillage(e.currentTarget.value)}
                    />
                  </Group>

                  <TextInput
                    label="Monthly support (expected)"
                    placeholder="e.g. 800"
                    value={monthlySupport}
                    onChange={(e) => setMonthlySupport(e.currentTarget.value)}
                  />
                </Stack>
              </Grid.Col>
            </Grid>

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Stack gap="sm">
                  <Text fw={500} size="sm">
                    Links & roles
                  </Text>
                  <Divider />

                  <Select
                    label="Responsible teacher"
                    placeholder="Select teacher"
                    data={teacherOptions}
                    value={teacherProfileId}
                    onChange={setTeacherProfileId}
                    clearable
                  />

                  <Select
                    label="Scholarship / Grant type"
                    placeholder="Select scholarship"
                    data={grantTypeOptions}
                    value={grantTypeId}
                    onChange={setGrantTypeId}
                    clearable
                  />
                </Stack>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Stack gap="sm">
                  <Text fw={500} size="sm">
                    Contact (internal only)
                  </Text>
                  <Divider />

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

                  <TextInput
                    label="Address"
                    value={contactAddress}
                    onChange={(e) => setContactAddress(e.currentTarget.value)}
                  />

                  <TextInput
                    label="Line / WhatsApp"
                    value={contactLineOrWhatsApp}
                    onChange={(e) =>
                      setContactLineOrWhatsApp(e.currentTarget.value)
                    }
                  />
                </Stack>
              </Grid.Col>
            </Grid>

            <Stack gap="sm">
              <Text fw={500} size="sm">
                Short bio / background
              </Text>
              <Divider />

              <Textarea
                minRows={4}
                autosize
                value={bio}
                onChange={(e) => setBio(e.currentTarget.value)}
                placeholder="Anything that helps donors or teachers understand the student's situation (not public web content)."
              />
            </Stack>

            <Group justify="space-between" mt="md">
              <Link to="/admin/students">
                <Text size="sm">← Back to students</Text>
              </Link>
              <Group>
                <Button
                  variant="outline"
                  color="gray"
                  component={Link}
                  to="/admin/students"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {isNew ? "Save student" : "Save changes"}
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>

        {/* Scholarships */}
        <Stack gap="sm" mt="lg">
          <Group justify="space-between" align="center">
            <Text fw={500} size="sm">
              Scholarships
            </Text>
            {!isNew && studentIdForLinks && (
              <Button
                component={Link}
                to={`/admin/scholarships/new${studentQueryParam}`}
                size="xs"
                variant="subtle"
              >
                New scholarship
              </Button>
            )}
          </Group>
          <Divider />

{isNew ? (
  <Text size="sm" c="dimmed">
    Save the student first, then you can add scholarships.
  </Text>
) : scholarships.length === 0 ? (
  <Text size="sm" c="dimmed">
    No scholarships recorded.
  </Text>
) : (
  <Table striped highlightOnHover withTableBorder withColumnBorders>
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Period</Table.Th>
        <Table.Th>Scholarship</Table.Th>
        <Table.Th>Amount / period</Table.Th>
        <Table.Th>Status</Table.Th>
      </Table.Tr>
    </Table.Thead>

    <Table.Tbody>
      {scholarships.map((aw) => {
        const statusLabel = aw.status ?? "unknown";

        return (
          <Table.Tr key={aw.id}>
            {/* PERIOD (clickable) */}
            <Table.Td>
              <Anchor
                component={Link}
                to={`/admin/scholarships/${aw.id}/edit`}
                size="sm"
                underline="always"
              >
                {aw.period_start || "?"} – {aw.period_end || "?"}
              </Anchor>
            </Table.Td>

            {/* SCHOLARSHIP NAME (clickable also) */}
            <Table.Td>
              <Anchor
                component={Link}
                to={`/admin/scholarships/${aw.id}/edit`}
                size="sm"
                underline="always"
              >
                {aw.grant_type_name || statusLabel}
              </Anchor>
            </Table.Td>

            {/* AMOUNT */}
            <Table.Td>
              <Text size="sm">
                {aw.amount_for_period != null
                  ? `${aw.amount_for_period} ${aw.currency || ""}`
                  : "-"}
              </Text>
            </Table.Td>

            {/* STATUS */}
            <Table.Td>
              <StatusBadge kind="scholarship" value={aw.status} />
            </Table.Td>
          </Table.Tr>
        );
      })}
    </Table.Tbody>
  </Table>
)}
        </Stack>

        {/* Reports */}
        <Stack gap="sm" mt="lg">
          <Group justify="space-between" align="center">
            <Text fw={500} size="sm">
              Term updates / reports
            </Text>
            {!isNew && studentIdForLinks && (
              <Button
                component={Link}
                to={`/admin/reports/new${studentQueryParam}`}
                size="xs"
                variant="subtle"
              >
                New report
              </Button>
            )}
          </Group>
          <Divider />

          {isNew ? (
            <Text size="sm" c="dimmed">
              Save the student first, then you can add reports.
            </Text>
          ) : reports.length === 0 ? (
            <Text size="sm" c="dimmed">
              No reports recorded yet.
            </Text>
          ) : (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: "140px" }}>Date</Table.Th>
                  <Table.Th>Report</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reports.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Text
                        component={Link}
                        to={`/admin/reports/${r.id}/edit${studentQueryParam}`}
                        size="sm"
                        style={{ textDecoration: "underline" }}
                      >
                        {r.report_date || "Edit report"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {r.grade_text && (
                          <Group gap="xs">
                            <Badge size="xs" variant="light">
                              Grade
                            </Badge>
                            <Text size="sm">{r.grade_text}</Text>
                          </Group>
                        )}

                        {(r.info || r.donor_comment) && (
                          <Text size="sm">
                            {r.info || r.donor_comment}
                          </Text>
                        )}

                        {r.internal_note && (
                          <Text size="xs" c="dimmed">
                            Internal note: {r.internal_note}
                          </Text>
                        )}

                        {r.attachments && r.attachments.length > 0 && (
                          <Group gap="xs" mt={4}>
                            {r.attachments
                              .filter((att) => att.publicUrl)
                              .slice(0, 3)
                              .map((att, idx) => (
                                <Image
                                  key={idx}
                                  src={att.publicUrl}
                                  alt="Report photo"
                                  w={40}
                                  h={40}
                                  radius="sm"
                                  fit="cover"
                                />
                              ))}
                          </Group>
                        )}

                        {!r.grade_text &&
                          !r.info &&
                          !r.donor_comment &&
                          !r.internal_note &&
                          (!r.attachments || r.attachments.length === 0) && (
                            <Text size="sm" c="dimmed">
                              No details recorded.
                            </Text>
                          )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Stack>
    </Card>
  );
};

export default AdminStudentDetailPage;
