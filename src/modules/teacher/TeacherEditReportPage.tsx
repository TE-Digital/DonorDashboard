// src/modules/teacher/TeacherEditReportPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
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
  Box,
  FileInput,
  Switch,
  Divider,
  ActionIcon,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconTrash } from "@tabler/icons-react";

type StudentRow = {
  id: string;
  name: string;
};

type ReportRow = {
  id: string;
  student_id: string;
  grade: string | null;
  grade_text: string | null;
  grade_numeric: number | null;
  report_date: string | null;
  covers_start: string | null;
  covers_end: string | null;
  donor_comment: string | null;
  internal_note: string | null;
  info: string | null;
  attachments: any | null;
};

type ExistingAttachmentDraft = {
  path: string;
  url: string;
  isPublic: boolean;
  isDeleted: boolean;
};

type NewAttachmentDraft = {
  file: File;
  isPublic: boolean;
  previewUrl: string;
};

export const TeacherEditReportPage: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);

  // form state
  const [reportDate, setReportDate] = useState<Date | null>(null);
  const [coversStart, setCoversStart] = useState<Date | null>(null);
  const [coversEnd, setCoversEnd] = useState<Date | null>(null);

  const [grade, setGrade] = useState("");
  const [gradeText, setGradeText] = useState("");
  const [gradeNumeric, setGradeNumeric] = useState<number | undefined>(
    undefined
  );

  const [donorComment, setDonorComment] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // attachments
  const [existingAttachments, setExistingAttachments] = useState<
    ExistingAttachmentDraft[]
  >([]);
  const [newAttachments, setNewAttachments] = useState<NewAttachmentDraft[]>(
    []
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toDate = (s: string | null): Date | null =>
    s ? new Date(s) : null;

  const toIsoDate = (d: Date | null): string | null =>
    d ? d.toISOString().slice(0, 10) : null;

  useEffect(() => {
    const load = async () => {
      if (!reportId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      // ---------- Load report ----------
      const { data: reportData, error: reportError } = await supabase
        .from("term_updates")
        .select(
          `
          id,
          student_id,
          grade,
          grade_text,
          grade_numeric,
          report_date,
          covers_start,
          covers_end,
          donor_comment,
          internal_note,
          info,
          attachments
        `
        )
        .eq("id", reportId)
        .maybeSingle();

      if (reportError || !reportData) {
        console.error(reportError);
        setError("Could not load report.");
        setLoading(false);
        return;
      }

      const r = reportData as ReportRow;
      setReport(r);

      setReportDate(toDate(r.report_date));
      setCoversStart(toDate(r.covers_start));
      setCoversEnd(toDate(r.covers_end));
      setGrade(r.grade ?? "");
      setGradeText(r.grade_text ?? "");
      setGradeNumeric(
        typeof r.grade_numeric === "number" ? r.grade_numeric : undefined
      );
      setDonorComment(r.donor_comment ?? r.info ?? "");
      setInternalNote(r.internal_note ?? "");

      // ---------- Resolve existing attachments ----------
      const existing: ExistingAttachmentDraft[] = [];

      if (r.attachments && Array.isArray(r.attachments)) {
        for (const raw of r.attachments as any[]) {
          const path = raw.path as string;
          const is_public = !!raw.is_public;

          const { data, error } = await supabase.storage
            .from("progress-photos")
            .createSignedUrl(path, 60 * 60); // 1 hour

          if (error) {
            console.error("Error creating signed URL", error);
            continue;
          }

          if (data?.signedUrl) {
            existing.push({
              path,
              url: data.signedUrl,
              isPublic: is_public,
              isDeleted: false,
            });
          }
        }
      }

      setExistingAttachments(existing);
      setNewAttachments([]);

      // ---------- Load student (for name) ----------
      const studentId = r.student_id;
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", studentId)
        .maybeSingle();

      if (studentError) {
        console.error(studentError);
      } else if (studentData) {
        setStudent(studentData as StudentRow);
      }

      setLoading(false);
    };

    load();
  }, [reportId]);

  /** Add new files (additive) */
  const handleFilesChange = (files: File[] | null) => {
    if (!files || files.length === 0) return;

    setNewAttachments((prev) => {
      const next = [...prev];
      for (const f of files) {
        const key = `${f.name}-${f.size}`;
        const exists =
          next.some((p) => `${p.file.name}-${p.file.size}` === key) ||
          existingAttachments.some(
            (p) => !p.isDeleted && p.path.endsWith(f.name)
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

  const handleToggleExistingPublic = (idx: number, value: boolean) => {
    setExistingAttachments((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, isPublic: value } : a
      )
    );
  };

  const handleToggleNewPublic = (idx: number, value: boolean) => {
    setNewAttachments((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, isPublic: value } : a
      )
    );
  };

  const handleDeleteExisting = (idx: number) => {
    setExistingAttachments((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, isDeleted: !a.isDeleted } : a
      )
    );
  };

  const handleDeleteNew = (idx: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportId || !report) {
      setError("Missing report.");
      return;
    }

    if (!reportDate) {
      setError("Please choose a report date.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // ---------- 1) Prepare attachments ----------
      const attachments: { path: string; is_public: boolean }[] = [];

      // a) Keep existing (not deleted)
      const toDeletePaths: string[] = [];
      existingAttachments.forEach((a) => {
        if (a.isDeleted) {
          toDeletePaths.push(a.path);
        } else {
          attachments.push({
            path: a.path,
            is_public: a.isPublic,
          });
        }
      });

      // b) Upload newly added files
      if (newAttachments.length > 0) {
        const uploads = await Promise.all(
          newAttachments.map(async (p) => {
            const ext = p.file.name.split(".").pop() || "jpg";
            const filePath = `${report.student_id}/${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.${ext}`;

            const { data, error } = await supabase.storage
              .from("progress-photos")
              .upload(filePath, p.file);

            if (error) throw error;

            return {
              path: data?.path ?? filePath,
              is_public: p.isPublic,
            };
          })
        );
        attachments.push(...uploads);
      }

      // ---------- 2) Update report row ----------
      const payload: any = {
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

      const { error: updateError } = await supabase
        .from("term_updates")
        .update(payload)
        .eq("id", reportId);

      if (updateError) {
        console.error(updateError);
        setError(updateError.message);
        setSubmitting(false);
        return;
      }

      // ---------- 3) Delete removed files from storage (best effort) ----------
      if (toDeletePaths.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from("progress-photos")
          .remove(toDeletePaths);
        if (deleteError) {
          console.error("Error deleting removed photos", deleteError);
          // we don't block success for this
        }
      }

      const studentId =
        searchParams.get("studentId") || report.student_id;
      navigate(`/teacher/students/${studentId}?reportId=${reportId}`, {
        replace: true,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Unexpected error while updating report.");
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;

  if (!report) {
    return <Text>Report not found.</Text>;
  }

  return (
    <Stack>
      <Title order={3}>Edit progress report</Title>
      <Text size="sm" c="dimmed">
        Student: {student?.name ?? "Unknown student"}
      </Text>

      <Card withBorder>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
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

            <Divider label="Photos / attachments" />

            {/* Existing photos */}
            {existingAttachments.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Existing photos
                </Text>
                <Group gap="xs">
                  {existingAttachments.map((a, idx) => (
                    <Box
                      key={a.path}
                      style={{
                        width: 100,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <img
                        src={a.url}
                        alt={a.path}
                        style={{
                          width: "100%",
                          height: 80,
                          objectFit: "cover",
                          display: a.isDeleted ? "none" : "block",
                        }}
                      />
                      {a.isDeleted && (
                        <Box
                          style={{
                            width: "100%",
                            height: 80,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,0.05)",
                            fontSize: 11,
                          }}
                        >
                          Marked for deletion
                        </Box>
                      )}
                      <Box p={4}>
                        <Switch
                          size="xs"
                          label="Share with donor"
                          checked={a.isPublic}
                          disabled={a.isDeleted}
                          onChange={(e) =>
                            handleToggleExistingPublic(
                              idx,
                              e.currentTarget.checked
                            )
                          }
                        />
                      </Box>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color={a.isDeleted ? "gray" : "red"}
                        aria-label="Delete photo"
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          backgroundColor: "white",
                        }}
                        onClick={() => handleDeleteExisting(idx)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                      {!a.isPublic && !a.isDeleted && (
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

            {/* Add new photos */}
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Add new photos
              </Text>
              <FileInput
                multiple
                accept="image/*"
                placeholder="Select additional photos"
                onChange={handleFilesChange}
              />
              {newAttachments.length > 0 && (
                <Group gap="xs">
                  {newAttachments.map((p, idx) => (
                    <Box
                      key={`${p.file.name}-${idx}`}
                      style={{
                        width: 100,
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
                          height: 80,
                          objectFit: "cover",
                        }}
                      />
                      <Box p={4}>
                        <Switch
                          size="xs"
                          label="Share with donor"
                          checked={p.isPublic}
                          onChange={(e) =>
                            handleToggleNewPublic(
                              idx,
                              e.currentTarget.checked
                            )
                          }
                        />
                      </Box>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="red"
                        aria-label="Remove new photo"
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          backgroundColor: "white",
                        }}
                        onClick={() => handleDeleteNew(idx)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
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
                onClick={() => {
                  const studentId =
                    searchParams.get("studentId") || report.student_id;
                  navigate(
                    `/teacher/students/${studentId}?reportId=${report.id}`
                  );
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Save changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
};
