// src/modules/admin/AdminNewReportPage.tsx
import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Group,
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
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { IconTrash, IconFileDescription } from "@tabler/icons-react";
import { LoadingState, color } from "../../design-system";

type StudentOption = {
  value: string;
  label: string;
};

type ProgressAttachmentDraft = {
  file: File;
  isPublic: boolean;
  previewUrl?: string; // only used for images
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES =
  "image/*,application/pdf," +
  "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const AdminNewReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const studentIdFromQuery = searchParams.get("studentId");

  const [loading, setLoading] = useState(true);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState<string | null>(studentIdFromQuery);

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

  const [attachmentsDraft, setAttachmentsDraft] = useState<
    ProgressAttachmentDraft[]
  >([]);
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

        if (studentIdFromQuery) {
          const exists = options.some((o) => o.value === studentIdFromQuery);
          if (!exists) setStudentId(null);
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

  /** Add new files (additive, images + pdf/doc, <= 5MB each) */
  const handleFilesChange = (files: File[] | null) => {
    if (!files || files.length === 0) return;

    setAttachmentsDraft((prev) => {
      const next = [...prev];
      for (const f of files) {
        if (f.size > MAX_FILE_SIZE_BYTES) {
          // skip and show error
          console.warn(
            `File ${f.name} skipped because it exceeds 5MB (${f.size} bytes).`
          );
          setError(
            `Some files were skipped because they exceed 5MB. (e.g. ${f.name})`
          );
          continue;
        }

        const key = `${f.name}-${f.size}`;
        const exists = next.some(
          (p) => `${p.file.name}-${p.file.size}` === key
        );
        if (exists) continue;

        next.push({
          file: f,
          isPublic: true,
          previewUrl: f.type.startsWith("image/")
            ? URL.createObjectURL(f)
            : undefined,
        });
      }
      return next;
    });
  };

  const handleToggleAttachmentPublic = (idx: number, value: boolean) => {
    setAttachmentsDraft((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, isPublic: value } : p))
    );
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachmentsDraft((prev) => prev.filter((_, i) => i !== idx));
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
      // 1) Upload attachments to "progress-photos" bucket and build attachments array
      const attachments: { path: string; is_public: boolean }[] = [];

      if (attachmentsDraft.length > 0) {
        const uploads = await Promise.all(
          attachmentsDraft.map(async (p) => {
            const ext = p.file.name.split(".").pop() || "bin";
            const filePath = `${studentId}/${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.${ext}`;

            const { data, error } = await supabase.storage
              .from("progress-photos")
              .upload(filePath, p.file);

            if (error) {
              console.error("Error uploading progress attachment", error);
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

      navigateBack();
    } catch (err: any) {
      console.error("Unexpected error creating report (admin)", err);
      setError(err.message ?? "Unexpected error while creating report.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={3}>New progress report (admin)</Title>
          <Text size="sm" c="dimmed">
            Create a new term / progress report for any student, including
            comments, photos and documents. This will appear in teacher
            dashboards and overdue calculations.
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
                setGradeNumeric(typeof val === "number" ? val : undefined)
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

          {/* Attachments */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Photos / files (max 5 MB each)
            </Text>
            <FileInput
              multiple
              accept={ACCEPTED_TYPES}
              placeholder="Select photos or documents"
              onChange={handleFilesChange}
            />

            {attachmentsDraft.length > 0 && (
              <Group gap="sm">
                {attachmentsDraft.map((p, idx) => {
                  const isImage = p.file.type.startsWith("image/");
                  const ext =
                    p.file.name.split(".").pop()?.toUpperCase() ?? "FILE";
                  const sizeMb = (p.file.size / (1024 * 1024)).toFixed(2);

                  return (
                    <Box
                      key={`${p.file.name}-${idx}`}
                      style={{
                        width: 150,
                        borderRadius: 8,
                        border: `1px solid ${color.border.default}`,
                        overflow: "hidden",
                        position: "relative",
                        backgroundColor: color.surface.sunken,
                      }}
                    >
                      {isImage && p.previewUrl ? (
                        <img
                          src={p.previewUrl}
                          alt={p.file.name}
                          style={{
                            width: "100%",
                            height: 100,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <Box
                          style={{
                            height: 100,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <IconFileDescription size={26} />
                          <Text size="xs" fw={500}>
                            {ext}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {sizeMb} MB
                          </Text>
                        </Box>
                      )}

                      <Box p={6}>
                        <Switch
                          size="xs"
                          label="Share with donor"
                          checked={p.isPublic}
                          onChange={(e) =>
                            handleToggleAttachmentPublic(
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
                        aria-label="Remove file"
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          backgroundColor: "white",
                        }}
                        onClick={() => handleRemoveAttachment(idx)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Box>
                  );
                })}
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
