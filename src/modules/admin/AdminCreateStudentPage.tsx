// src/modules/admin/AdminCreateStudentPage.tsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Stack,
  Text,
  TextInput,
  Group,
  Button,
  Select,
  LoadingOverlay,
  Textarea,
  Grid,
  Divider,
  FileInput,
  Anchor,
} from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, Link } from "react-router-dom";

type School = { id: string; name: string };
type TeacherOption = { value: string; label: string };
type GrantTypeOption = { value: string; label: string };

export const AdminCreateStudentPage: React.FC = () => {
  const navigate = useNavigate();

  // basic fields
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [gradeLevel, setGradeLevel] = useState("");
  const [village, setVillage] = useState("");
  const [birthdate, setBirthdate] = useState("2010-01-01"); // default
  const [monthlySupport, setMonthlySupport] = useState("");

  // scholarship via grant types
  const [grantTypeId, setGrantTypeId] = useState<string | null>(null);
  const [grantTypeOptions, setGrantTypeOptions] = useState<GrantTypeOption[]>(
    []
  );

  // contact JSON
  const [contactPhone, setContactPhone] = useState("");
  const [contactGuardian, setContactGuardian] = useState("");

  // teacher (profile id)
  const [teacherProfileId, setTeacherProfileId] = useState<string | null>(null);

  // additional info
  const [bio, setBio] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null); // not yet uploaded

  const [schools, setSchools] = useState<School[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadLookups = async () => {
    setLoading(true);
    setError(null);

    // 1) schools
    const { data: schoolRows, error: schoolError } = await supabase
      .from("schools")
      .select("id, name")
      .order("name", { ascending: true });

    if (schoolError) {
      console.error("Error loading schools", schoolError);
      setError("Could not load schools.");
      setLoading(false);
      return;
    }
    setSchools((schoolRows ?? []) as School[]);

    // 2) teachers (profiles where role = 'teacher')
    const { data: teacherRows, error: teacherError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

    if (teacherError) {
      console.error("Error loading teachers", teacherError);
      setError("Could not load teachers.");
      setLoading(false);
      return;
    }

    const teacherSelectOptions: TeacherOption[] = (teacherRows ?? [])
      .filter((p: any) => p.role === "teacher")
      .map((p: any) => ({
        value: p.id,
        label: p.full_name || "(no name)",
      }));
    setTeacherOptions(teacherSelectOptions);

    // 3) grant types for scholarship selection
    const { data: gtRows, error: gtError } = await supabase
      .from("grant_types")
      .select("id, name")
      .order("name", { ascending: true });

    if (gtError) {
      console.error("Error loading grant types", gtError);
      // don't hard-fail the whole form, but show a message
      setError("Could not load grant types (scholarships).");
      setGrantTypeOptions([]);
      setLoading(false);
      return;
    }

    const gtOptions: GrantTypeOption[] = (gtRows ?? []).map((g: any) => ({
      value: g.id,
      label: g.name,
    }));
    setGrantTypeOptions(gtOptions);

    setLoading(false);
  };

  useEffect(() => {
    loadLookups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const trimmedName = name.trim();
    const phone = contactPhone.trim();
    const guardian = contactGuardian.trim();

    if (!trimmedName) {
      setError("Student name is required.");
      setSaving(false);
      return;
    }
    if (!phone || !guardian) {
      setError("Phone and guardian name are required (for contact).");
      setSaving(false);
      return;
    }

    // build contact json according to constraint
    const contact = {
      phone,
      guardian,
    };

    let birthdateValue: string | null = null;
    if (birthdate.trim()) {
      birthdateValue = birthdate.trim(); // HTML date input returns YYYY-MM-DD
    }

    const monthly =
      monthlySupport.trim() !== ""
        ? Number(monthlySupport.replace(",", ".")) // little helper for 10,5
        : null;

    // derive scholarship label from selected grant type
    let scholarshipLabel: string | null = null;
    if (grantTypeId) {
      const selected = grantTypeOptions.find((g) => g.value === grantTypeId);
      scholarshipLabel = selected?.label ?? null;
    }

    const insertPayload: any = {
      name: trimmedName,
      nickname: nickname.trim() || null,
      school_id: schoolId,
      grade_level: gradeLevel || null,
      village: village || null,
      scholarship: scholarshipLabel, // human-readable label
      grant_type_id: grantTypeId, // FK for consistency
      birthdate: birthdateValue,
      monthly_support_expected: monthly,
      contact,
      responsible_teacher_id: teacherProfileId,
      bio: bio || null,
      // profile picture upload can be handled later via storage
    };

    const { data, error: insertError } = await supabase
      .from("students")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("Error creating student", insertError);
      setError(insertError.message);
      setSaving(false);
      return;
    }

    const newId = data?.id;
    setMessage("Student created successfully.");

    // TODO: upload profile picture if needed

    if (newId) {
      navigate(`/admin/students/${newId}`);
    } else {
      setSaving(false);
    }
  };

  return (
    <Card withBorder shadow="sm" radius="md" pos="relative" p="lg">
      <LoadingOverlay visible={loading || saving} />

      <Stack gap="lg">
        <div>
          <Text fw={700} size="lg">
            Add student
          </Text>
          <Text size="sm" c="dimmed">
            Create a new student, link them to a school and responsible
            teacher, and capture the minimum contact details.
          </Text>
        </div>

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
              {/* LEFT COLUMN – basic info */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Stack gap="sm">
                  <Text fw={500} size="sm">
                    Basic information
                  </Text>
                  <Divider />

                  <TextInput
                    size="sm"
                    label="Student name"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    required
                  />

                  <TextInput
                    size="sm"
                    label="Nickname (shared with donor)"
                    description="Optional name to use in donor communication instead of the full legal name."
                    value={nickname}
                    onChange={(e) => setNickname(e.currentTarget.value)}
                  />

                  <TextInput
                    size="sm"
                    label="Grade level"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.currentTarget.value)}
                    placeholder="e.g. P4, M2"
                  />

                  <TextInput
                    size="sm"
                    label="Birthdate"
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.currentTarget.value)}
                  />

                  <TextInput
                    size="sm"
                    label="Village"
                    value={village}
                    onChange={(e) => setVillage(e.currentTarget.value)}
                  />

                  <TextInput
                    size="sm"
                    label="Monthly support (expected)"
                    placeholder="e.g. 800"
                    value={monthlySupport}
                    onChange={(e) => setMonthlySupport(e.currentTarget.value)}
                  />
                </Stack>
              </Grid.Col>

              {/* RIGHT COLUMN – meta info */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Stack gap="sm">
                  <Text fw={500} size="sm">
                    Links & roles
                  </Text>
                  <Divider />

                  <Select
                    label="School"
                    placeholder="Select school"
                    data={schools.map((s) => ({ value: s.id, label: s.name }))}
                    value={schoolId}
                    onChange={setSchoolId}
                    clearable
                  />

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

                  <FileInput
                    label="Profile photo (optional)"
                    placeholder="Upload image"
                    value={profilePicture}
                    onChange={setProfilePicture}
                    accept="image/*"
                  />
                </Stack>
              </Grid.Col>
            </Grid>

            {/* CONTACT + BIO */}
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Stack gap="sm">
                  <Text fw={500} size="sm">
                    Contact (for internal use)
                  </Text>
                  <Divider />

                  <TextInput
                    size="sm"
                    label="Guardian name"
                    value={contactGuardian}
                    onChange={(e) => setContactGuardian(e.currentTarget.value)}
                    required
                  />

                  <TextInput
                    size="sm"
                    label="Phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.currentTarget.value)}
                    required
                  />
                </Stack>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
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
                    placeholder="Anything that helps donors or teachers understand the student's situation (will not be publicly searchable)."
                  />
                </Stack>
              </Grid.Col>
            </Grid>

            <Group justify="space-between" mt="md">
              <Anchor component={Link} to="/admin/students" size="sm">
                ← Back to students
              </Anchor>
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
                  Save student
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
};
