// src/modules/admin/AdminReportFormPage.tsx 
import React, { useEffect, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  IconTrash,
  IconFileDescription,
  IconFile,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypeXls,
  IconFileTypePpt,
} from "@tabler/icons-react";

const STORAGE_BUCKET = "progress-photos"; 

type RouteParams = {
  reportId?: string;
  studentId?: string;
};

type ExistingAttachment = {
  path: string;
  is_public?: boolean;
};

type NewAttachmentDraft = {
  file: File;
  isPublic: boolean;
  previewUrl?: string;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES =
  "image/*,application/pdf," +
  "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

const isImagePath = (path: string) =>
  /\.(jpe?g|png|webp|gif)$/i.test(path || "");

const pickFileIcon = (extLower: string | null | undefined) => {
  switch (extLower) {
    case "pdf":
      return IconFileTypePdf;
    case "doc":
    case "docx":
      return IconFileTypeDocx;
    case "xls":
    case "xlsx":
      return IconFileTypeXls;
    case "ppt":
    case "pptx":
      return IconFileTypePpt;
    default:
      return IconFile;
  }
};

const toIsoDate = (d: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const AdminReportFormPage: React.FC = () => {
  const { reportId, studentId: studentIdParam } = useParams<RouteParams>();
  const navigate = useNavigate();

  const isEditMode = !!reportId;

  const [loading, setLoading] = useState<boolean>(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // core fields
  const [studentId, setStudentId] = useState<string | null>(
    studentIdParam ?? null
  );
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

  // attachments
  const [existingAttachments, setExistingAttachments] = useState<
    ExistingAttachment[]
  >([]);
  const [existingPublicFlags, setExistingPublicFlags] = useState<boolean[]>([]);
  const [newAttachments, setNewAttachments] = useState<NewAttachmentDraft[]>(
    []
  );

  // ───────────────────────────────── Load for EDIT mode ──────────────────────
  useEffect(() => {
    const load = async () => {
      if (!isEditMode || !reportId) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: qError } = await supabase
          .from("term_updates")
          .select("*")
          .eq("id", reportId)
          .maybeSingle();

        if (qError) {
          console.error("Error loading term_update", qError);
          setError(qError.message);
          setLoading(false);
          return;
        }
        if (!data) {
          setError("Report not found.");
          setLoading(false);
          return;
        }

        // Map fields
        setStudentId(data.student_id ?? studentIdParam ?? null);
        setReportDate(parseDate(data.report_date));
        setCoversStart(parseDate(data.covers_start));
        setCoversEnd(parseDate(data.covers_end));

        setGrade(data.grade ?? "");
        setGradeText(data.grade_text ?? "");
        setGradeNumeric(
          typeof data.grade_numeric === "number"
            ? data.grade_numeric
            : undefined
        );
        setDonorComment(data.donor_comment ?? "");
        setInternalNote(data.internal_note ?? "");

        // Normalize attachments
        const raw = data.attachments;
        let items: ExistingAttachment[] = [];

        try {
          let parsed: any = raw;
          if (typeof raw === "string") {
            parsed = JSON.parse(raw);
          }

          if (Array.isArray(parsed)) {
            items = parsed
              .filter(
                (item: any) =>
                  item &&
                  typeof item === "object" &&
                  typeof item.path === "string" &&
                  item.path.trim() !== ""
              )
              .map((item: any) => ({
                path: item.path,
                is_public:
                  typeof item.is_public === "boolean" ? item.is_public : true,
              }));
          }
        } catch (e) {
          console.warn("Could not parse attachments, treating as empty.", e);
          items = [];
        }

        setExistingAttachments(items);
        setExistingPublicFlags(
          items.map((att) =>
            typeof att.is_public === "boolean" ? att.is_public : true
          )
        );
      } catch (e: any) {
        console.error("Unexpected error loading report", e);
        setError(e.message ?? "Unexpected error while loading report.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isEditMode, reportId, studentIdParam]);

  // ───────────────────────────── File handling (both modes) ──────────────────
  const handleFilesChange = (files: File[] | null) => {
    if (!files || files.length === 0) return;

    setNewAttachments((prev) => {
      const next = [...prev];
      for (const f of files) {
        if (f.size > MAX_FILE_SIZE_BYTES) {
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

  const handleToggleExistingPublic = (idx: number, value: boolean) => {
    setExistingPublicFlags((prev) =>
      prev.map((flag, i) => (i === idx ? value : flag))
    );
  };

  const handleToggleNewPublic = (idx: number, value: boolean) => {
    setNewAttachments((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, isPublic: value } : p))
    );
  };

  const handleRemoveNewAttachment = (idx: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const navigateBack = () => {
    if (studentId) {
      navigate(`/admin/students/${studentId}`);
    } else {
      navigate("/admin/reports");
    }
  };

  // ───────────────────────────────── Submit (create / update) ────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reportDate) {
      setError("Please choose a report date.");
      return;
    }
    if (!studentId) {
      setError("Missing student ID for this report.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1) Upload new attachments
      const newUploaded: { path: string; is_public: boolean }[] = [];

      if (newAttachments.length > 0) {
        const uploads = await Promise.all(
          newAttachments.map(async (p) => {
            const ext = p.file.name.split(".").pop() || "bin";
            const studentIdForPath = studentId ?? "unknown-student";
            const filePath = `${studentIdForPath}/${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.${ext}`;

            const { data, error } = await supabase.storage
              .from("progress-photos")
              .upload(filePath, p.file);

            if (error) {
              console.error("Error uploading attachment", error);
              throw error;
            }

            return {
              path: data?.path ?? filePath,
              is_public: p.isPublic,
            };
          })
        );

        newUploaded.push(...uploads);
      }

      // 2) Combine existing + new attachments (edit) OR only new (create)
      let combinedAttachments: { path: string; is_public: boolean }[] = [];

      if (isEditMode) {
        combinedAttachments = [
          ...existingAttachments.map((att, idx) => ({
            path: att.path,
            is_public:
              typeof existingPublicFlags[idx] === "boolean"
                ? existingPublicFlags[idx]
                : att.is_public ?? true,
          })),
          ...newUploaded,
        ];
      } else {
        combinedAttachments = [...newUploaded];
      }

      // 3) Build payload
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
        attachments: combinedAttachments.length > 0 ? combinedAttachments : null,
      };

      if (isEditMode && reportId) {
        const { error: updateError } = await supabase
          .from("term_updates")
          .update(payload)
          .eq("id", reportId);

        if (updateError) {
          console.error("Error updating term_update", updateError);
          setError(updateError.message);
          setSubmitting(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("term_updates")
          .insert(payload);

        if (insertError) {
          console.error("Error inserting term_update", insertError);
          setError(insertError.message);
          setSubmitting(false);
          return;
        }
      }

      navigateBack();
    } catch (err: any) {
      console.error("Unexpected error saving report (admin)", err);
      setError(err.message ?? "Unexpected error while saving report.");
      setSubmitting(false);
    }
  };

  // ───────────────────────────────────────── UI ──────────────────────────────

  if (loading) {
    return <Loader />;
  }

  const title = isEditMode
    ? "Edit progress report (admin)"
    : "Create progress report (admin)";

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={3}>{title}</Title>
          <Text size="sm" c="dimmed">
            {isEditMode
              ? "Update term / progress report fields and manage attachments (photos and documents)."
              : "Create a new term / progress report and add attachments (photos and documents)."}
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
          Back
        </Button>
      </Group>

      <Card withBorder component="form" onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Date fields */}
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

          {/* Existing attachments – only in EDIT mode */}
          {isEditMode && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Existing attachments
              </Text>
              {existingAttachments.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No existing attachments.
                </Text>
              ) : (
                <Stack gap={6}>
                  {existingAttachments.map((att, idx) => {
                    const path = att.path;
                    const filename = path.split("/").pop() ?? path;
                    const extRaw = filename.split(".").pop() ?? "";
                    const extUpper = extRaw.toUpperCase();
                    const extLower = extRaw.toLowerCase();

                    const { data } = supabase.storage
                      .from("progress-photos")
                      .getPublicUrl(path);
                    const publicUrl = data.publicUrl;

                    const IconComp = pickFileIcon(extLower);
                    const image = isImagePath(path);

                    return (
                      <Group
                        key={`${path}-${idx}`}
                        align="flex-start"
                        gap="xs"
                      >
                        {image ? (
                          <Anchor
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-block" }}
                          >
                            <img
                              src={publicUrl}
                              alt={`Attachment ${idx + 1}`}
                              style={{
                                width: 40,
                                height: 40,
                                objectFit: "cover",
                                borderRadius: 4,
                                border: "1px solid #ddd",
                              }}
                            />
                          </Anchor>
                        ) : (
                          <IconComp size={20} />
                        )}

                        <Stack gap={2}>
                          <Group gap={6}>
                            <Badge size="xs" variant="light">
                              {extUpper || "FILE"}
                            </Badge>
                            <Text size="xs" lineClamp={1}>
                                Attachment {idx + 1}
                            </Text>
                          </Group>

                          <Group gap={8}>
                            <Anchor
                              href={publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              size="xs"
                            >
                              Open
                            </Anchor>
                            <Anchor
                              component="a"
                              href={publicUrl}
                              download={filename}
                              size="xs"
                            >
                              Download
                            </Anchor>
                            <Switch
                              size="xs"
                              label="Share with donor"
                              checked={existingPublicFlags[idx]}
                              onChange={(e) =>
                                handleToggleExistingPublic(
                                  idx,
                                  e.currentTarget.checked
                                )
                              }
                            />
                          </Group>
                        </Stack>
                      </Group>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          )}

          {/* New attachments */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Add photos / files (max 5 MB each)
            </Text>
            <FileInput
              multiple
              accept={ACCEPTED_TYPES}
              placeholder="Select photos or documents"
              onChange={handleFilesChange}
            />

            {newAttachments.length > 0 && (
              <Group gap="sm">
                {newAttachments.map((p, idx) => {
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
                        border: "1px solid #ddd",
                        overflow: "hidden",
                        position: "relative",
                        backgroundColor: "#f8f9fa",
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
                            handleToggleNewPublic(
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
                        onClick={() => handleRemoveNewAttachment(idx)}
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
              {isEditMode ? "Save changes" : "Create report"}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};

export default AdminReportFormPage;
