// src/modules/admin/AdminNewReportPage.tsx
import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  FileInput,
  Switch,
  Box,
  ActionIcon,
  Select,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { IconTrash } from "@tabler/icons-react";

type StudentOption = {
  value: string;
  label: string;
};

type ProgressPhotoDraft = {
  file: File;
  isPublic: boolean;
  previewUrl: string;
};

export const AdminNewReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const studentIdFromQuery = searchParams.get("studentId");

  const [loading, setLoading] = useState(true);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState<string | null>(
    studentIdFromQuery
  );

  // form state
  const [reportDate, setReportDate] = useState<Date | null>(new Date());
  const [coversStart, setCoversStart] = useState<Date | null>(null);
  const [coversEnd, setCoversEnd] = useState<Date | null>(null);

  const [grade, setGrade] = useState("");
  const [gradeText, setGradeText] = useState("");
  const [gradeNumeric, setGradeNumeric] = useState<number | undefined>(
    undefined
  );

  const [donorComment, setDonorComment] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const [photos, setPhotos] = useState<ProgressPhotoDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all students for the selector, and preselect from query if available
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: sError } = await supabase
          .from("students")
          .select("id, name, grade_level")
          .order("name", { ascending: true });

        if (sError) throw sError;

        const options: StudentOption[] =
          (data ?? []).map((s: any) => ({
            value: s.id as string,
            label: s.grade_level
              ? `${s.name ?? "(no name)"} – Grade ${s.grade_level}`
              : (s.name as string) ?? "(no name)",
          })) ?? [];

        setStudentOptions(options);

        // if query param matches a student, keep it; otherwise leave null
        if (studentIdFromQuery) {
          const exists = options.some(
            (o) => o.value === studentIdFromQuery
          );
          if (!exists) {
            // invalid studentId in query → clear it
            setStudentId(null);
          }
        }
      } catch (err: any) {
        console.error("Error loading students for admin new report", err);
        setError("Could not load student list.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentIdFromQuery]);

  const toIsoDate = (d: Date | null): string | null =>
    d ? d.toISOString().slice(0, 10) : null;

  /** Add new photos (additive) */
  const handleFilesChange = (files: File[] | null) => {
    if (!files || files.length === 0) return;

    setPhotos((prev) => {
      const next = [...prev];
      for (const f of files) {
        const key = `${f.name}-${f.size}`;
        const exists = next.some(
          (p) => `${p.file.name}-${p.file.size}` === key
        );
        if (exists) continue;

        next.push({
          file: f,
          isPublic: true,
          previewUrl: URL.createObjectURL(f),
        });
      }
      return next;
    });
  };

  const handleTogglePhotoPublic = (idx: number, value: boolean) => {
    setPhotos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, isPublic: value } : p))
    );
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const navigateBack = () => {
    if (studentId) {
      navigate(`/admin/students/${studentId}`);
    } else if (studentIdFromQuery) {
      navigate(`/admin/students/${studentIdFromQuery}`);
    } else {
      navigate("/admin/students");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId) {
      setError("Please select a student.");
      return;
    }
    if (!reportDate) {
      setError("Please choose a report date.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1) Upload photos to "progress-photos" bucket and build attachments
      const attachments: { path: string; is_public: boolean }[] = [];

      if (photos.length > 0) {
        const uploads = await Promise.all(
          photos.map(async (p) => {
            const ext = p.file.name.split(".").pop() || "jpg";
            const filePath = `${studentId}/${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.${ext}`;

            const { data, error } = await supabase.storage
              .from("progress-photos")
              .upload(filePath, p.file);

            if (error) {
              console.error("Error uploading progress photo", error);
              throw error;
            }

            return {
              path: data?.path ?? filePath,
              is_public: p.isPublic,
            };
          })
        );

        attachments.push(...uploads);
      }

      // 2) Insert term_update row
      const payload: any = {
        student_id: studentId,
        grade: grade || null,
        grade_text: gradeText || null,
        grade_numeric:
          typeof gradeNumeric === "number" ? gradeNumeric : null,
        report_date: toIsoDate(reportDate),
        covers_start: toIsoDate(coversStart),
        covers_end: toIsoDate(coversEnd),
        donor_comment: donorComment || null,
        internal_note: internalNote || null,
        info: donorComment || null,
        attachments: attachments.length > 0 ? attachments : null,
      };

      const { error: insertError } = await supabase
        .from("term_updates")
        .insert(payload);

      if (insertError) {
        console.error("Error inserting term_update (admin)", insertError);
        setError(insertError.message);
        setSubmitting(false);
        return;
      }

      // 3) Go back to student
      navigateBack();
    } catch (err: any) {
      console.error("Unexpected error creating report (admin)", err);
      setError(err.message ?? "Unexpected error while creating report.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={3}>New progress report (admin)</Title>
          <Text size="sm" c="dimmed">
            Create a new term / progress report for any student, including
            comments and photos. This will appear in teacher dashboards and
            overdue calculations.
          </Text>
        </div>
        <Button
          component={Link}
          variant="subtle"
          size="xs"
          to="#"
          onClick={(e) => {
            e.preventDefault();
            navigateBack();
          }}
          disabled={submitting}
        >
          Back to student
        </Button>
      </Group>

      <Card withBorder component="form" onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Student selector */}
          <Select
            label="Student"
            placeholder="Select student"
            data={studentOptions}
            value={studentId}
            onChange={setStudentId}
            required
            searchable
          />

          {/* Report date and coverage period */}
          <Group grow>
            <DateInput
              label="Report date"
              value={reportDate}
              onChange={setReportDate}
              required
            />
            <DateInput
              label="Report covers from"
              value={coversStart}
              onChange={setCoversStart}
            />
            <DateInput
              label="Covers until"
              value={coversEnd}
              onChange={setCoversEnd}
            />
          </Group>

          {/* Grades */}
          <Group grow>
            <TextInput
              label="Grade (short)"
              placeholder="e.g. A / Pass / Good / 3.5"
              value={grade}
              onChange={(e) => setGrade(e.currentTarget.value)}
            />
            <NumberInput
              label="Grade (numeric)"
              placeholder="0–100 or similar (optional)"
              value={gradeNumeric}
              onChange={(val) =>
                setGradeNumeric(
                  typeof val === "number" ? val : undefined
                )
              }
              min={0}
            />
          </Group>

          <TextInput
            label="Progress summary"
            placeholder="Short headline, e.g. 'Very good progress'"
            value={gradeText}
            onChange={(e) => setGradeText(e.currentTarget.value)}
          />

          {/* Comments */}
          <Textarea
            label="Comment for donor"
            description="Visible in donor reporting; keep language clear and encouraging."
            placeholder="Describe the student's progress in a donor-friendly way."
            minRows={4}
            value={donorComment}
            onChange={(e) => setDonorComment(e.currentTarget.value)}
          />

          <Textarea
            label="Internal note (teacher/admin only)"
            description="Internal observations or sensitive information. Not shared with donors."
            placeholder="Optional – visible only to teachers and admins."
            minRows={3}
            value={internalNote}
            onChange={(e) => setInternalNote(e.currentTarget.value)}
          />

          {/* Photos */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Photos
            </Text>
            <FileInput
              multiple
              accept="image/*"
              placeholder="Select one or more photos"
              onChange={handleFilesChange}
            />

            {photos.length > 0 && (
              <Group gap="sm">
                {photos.map((p, idx) => (
                  <Box
                    key={`${p.file.name}-${idx}`}
                    style={{
                      width: 120,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <img
                      src={p.previewUrl}
                      alt={p.file.name}
                      style={{
                        width: "100%",
                        height: 90,
                        objectFit: "cover",
                      }}
                    />
                    <Box p={6}>
                      <Switch
                        size="xs"
                        label="Share with donor"
                        checked={p.isPublic}
                        onChange={(e) =>
                          handleTogglePhotoPublic(
                            idx,
                            e.currentTarget.checked
                          )
                        }
                      />
                    </Box>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      aria-label="Remove photo"
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        backgroundColor: "white",
                      }}
                      onClick={() => handleRemovePhoto(idx)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                    {!p.isPublic && (
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
            )}
          </Stack>

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button
              variant="subtle"
              type="button"
              onClick={navigateBack}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save report
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};

export default AdminNewReportPage;
