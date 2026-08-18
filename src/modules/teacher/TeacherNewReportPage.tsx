// src/modules/teacher/TeacherNewReportPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
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
  Divider,
  ActionIcon,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconTrash } from "@tabler/icons-react";
import { LoadingState, color } from "../../design-system";

type ProgressPhotoDraft = {
  file: File;
  isPublic: boolean;
  previewUrl: string;
};

type StudentRow = {
  id: string;
  name: string;
};

export const TeacherNewReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get("studentId");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);

  // Dates
  const today = new Date();
  const initialStart = new Date();
  initialStart.setMonth(initialStart.getMonth() - 6);

  const [reportDate, setReportDate] = useState<Date | null>(today);
  const [coversStart, setCoversStart] = useState<Date | null>(initialStart);
  const [coversEnd, setCoversEnd] = useState<Date | null>(today);

  // Grades
  const [grade, setGrade] = useState("");
  const [gradeText, setGradeText] = useState("");
  const [gradeNumeric, setGradeNumeric] = useState<number | undefined>(
    undefined
  );

  // Comments
  const [donorComment, setDonorComment] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // Photos
  const [photos, setPhotos] = useState<ProgressPhotoDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load student info
  useEffect(() => {
    const load = async () => {
      if (!studentId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", studentId)
        .maybeSingle();

      if (error) {
        console.error("Error loading student", error);
        setError("Could not load student info.");
      } else if (data) {
        setStudent(data as StudentRow);
      }

      setLoading(false);
    };

    load();
  }, [studentId]);

  /**
   * Additive file selection:
   * - Choosing new files adds them to the existing list instead of replacing it.
   * - Clearing the input (no files) does NOT automatically wipe the list –
   *   users can remove images with the small trash icon.
   */
  const handleFilesChange = (files: File[] | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setPhotos((prev) => {
      const next = [...prev];

      for (const f of files) {
        // Avoid duplicates by (name + size) heuristic
        const key = `${f.name}-${f.size}`;
        const already = next.some(
          (p) => `${p.file.name}-${p.file.size}` === key
        );
        if (already) continue;

        next.push({
          file: f,
          isPublic: true, // default: share with donor
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

  const toIsoDate = (d: Date | null): string | null =>
    d ? d.toISOString().slice(0, 10) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError("Missing studentId.");
      return;
    }
    if (!reportDate) {
      setError("Please choose a report date.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1) Upload photos to "progress-photos" bucket
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

      // 2) Insert progress report into term_updates
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
        // keep `info` in sync for backward compatibility (e.g. admin views)
        info: donorComment || null,
        attachments: attachments.length > 0 ? attachments : null,
      };

      const { error: insertError } = await supabase
        .from("term_updates")
        .insert(payload);

      if (insertError) {
        console.error("Insert error", insertError);
        setError(insertError.message);
        setSubmitting(false);
        return;
      }

      // back to student detail
      navigate(`/teacher/students/${studentId}`, { replace: true });
    } catch (err: any) {
      console.error("Unexpected error saving report", err);
      setError(err.message ?? "Unexpected error while saving report.");
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;

  if (!studentId) {
    return <Text>Missing studentId in URL.</Text>;
  }

  return (
    <Stack>
      <Title order={3}>New progress report</Title>
      <Text size="sm" c="dimmed">
        Student: {student?.name ?? "Unknown student"}
      </Text>

      <Card withBorder>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Report date + covered period */}
            <Group grow>
              <DateInput
                label="Report date"
                value={reportDate}
                onChange={setReportDate}
                required
              />
              <DateInput
                label="Report covers period from"
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
                placeholder="Please enter the overall grade/ GPA (e.g., A / B / Pass / Good / 3.5)"
                value={grade}
                onChange={(e) => setGrade(e.currentTarget.value)}
              />
              <NumberInput
                label="Grade (numeric)"
                placeholder="e.g., 0–100 (only if available/relevant)"
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
              description="Will be visible to donor and can be used in donor reports."
              placeholder="Describe the student's progress in a donor-friendly way."
              minRows={4}
              value={donorComment}
              onChange={(e) => setDonorComment(e.currentTarget.value)}
            />

            <Textarea
              label="Internal note (teacher/admin only)"
              description="Internal observations, sensitive information, or contextual notes."
              placeholder="This will NOT be shared with donors."
              minRows={3}
              value={internalNote}
              onChange={(e) => setInternalNote(e.currentTarget.value)}
            />

            <Divider label="Photos" />

            {/* Photos input */}
            <FileInput
              label="Progress photos and documents"
              description="You can upload multiple photos; new selections will be added to the list."
              placeholder="Select photo files"
              accept="image/*"
              multiple
              onChange={handleFilesChange}
            />

            {/* Photo previews */}
            {photos.length > 0 && (
              <Stack gap="xs">
                {photos.map((p, idx) => (
                  <Card
                    key={idx}
                    withBorder
                    padding="xs"
                    radius="md"
                    style={{ maxWidth: 420 }}
                  >
                    <Group align="flex-start" wrap="nowrap">
                      {p.file.type.startsWith("image/") ? (
                        <img
                          src={p.previewUrl}
                          alt={p.file.name}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 8,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 8,
                            border: `1px solid ${color.border.default}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "var(--fs-micro)",
                            flexShrink: 0,
                          }}
                        >
                          {p.file.name.split(".").pop() || "file"}
                        </div>
                      )}

                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text size="xs" fw={500}>
                          {p.file.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {(p.file.size / 1024).toFixed(1)} kB
                        </Text>
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
                      </Stack>

                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        aria-label="Remove photo"
                        onClick={() => handleRemovePhoto(idx)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}

            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}

            <Group justify="flex-end" mt="sm">
              <Button
                variant="subtle"
                onClick={() => navigate(-1)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Save report
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
};

