// src/modules/reports/ReportForm.tsx
//
// A term report, as one form — used to write a new one and to edit an existing
// one, by an admin and by a teacher.
//
// The four groups follow who reads what, because that is the decision a teacher
// is actually making as they fill it in:
//
//   Report        — which student, which date, which term
//   Progress      — the grade, in the two shapes the programme records it
//   For the donor — the sentence a sponsor will read
//   Internal      — what stays inside the organisation
//   Attachments   — each file shared with donors, or not, one at a time
//
// The privacy line runs through the middle of this form. "Comment for donor"
// leaves the building; "internal note" does not; an attachment does only if
// somebody ticks it. The labels say so rather than assuming it is understood.

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Checkbox, Select, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  FieldLabel,
  FormBody,
  FormError,
  FormFooter,
  FormSection,
  InlineMessage,
  LoadingState,
  parseDateInput,
  toDateInputValue,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  type FieldErrors,
} from "../../design-system";
import { Button, Icon } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import type { EntityFormHandle, EntityFormOwnerProps } from "../admin/entityForm";
import { logEvent } from "../admin/studentEvents";
import {
  attachmentName,
  attachmentProblem,
  attachmentUrl,
  isImagePath,
  removeAttachments,
  uploadAttachments,
  type AttachmentDraft,
  type ReportAttachment,
} from "./reportAttachments";
import {
  emptyReportDetails,
  loadReport,
  saveReport,
  validateReportDetails,
  REPORT_FIELD_ORDER,
  type ReportField,
  type ReportDetailsInput,
} from "./reportRecord";
import { REPORT_STATE_META, REPORT_STATUS_OPTIONS } from "./reportStatus";
import styles from "./ReportForm.module.scss";

/** Namespaces this form's field ids — a report is written from three screens. */
const FORM_ID = "report-form";

export interface SavedReport {
  id: string;
  studentId: string | null;
}

export interface ReportFormProps extends EntityFormOwnerProps {
  /** Editing an existing report. Absent creates a new one. */
  reportId?: string | null;
  /** Fixes the student. Passed from a student's own page, where it is not a choice. */
  studentId?: string | null;
  /** Shows the student as fixed context instead of a picker. */
  lockStudent?: boolean;
  onSaved: (report: SavedReport) => void;
}

interface StudentOption {
  value: string;
  label: string;
}

export const ReportForm = forwardRef<EntityFormHandle, ReportFormProps>(
  (
    {
      reportId = null,
      studentId = null,
      lockStudent = false,
      onSaved,
      onSavingChange,
      onErrorChange,
      onDirtyChange,
      onCancel,
      showActions = false,
      submitLabel,
    },
    ref,
  ) => {
    const [details, setDetails] = useState<ReportDetailsInput>(emptyReportDetails(studentId));
    const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
    /** Files chosen but not uploaded. Uploaded only when the form saves. */
    const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
    /** Existing files ticked for removal, deleted after the row is written. */
    const [removing, setRemoving] = useState<string[]>([]);

    const [students, setStudents] = useState<StudentOption[]>([]);
    const [loading, setLoading] = useState(Boolean(reportId));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Which fields are wrong, so each one says so on itself. */
    const [fieldErrors, setFieldErrors] = useState<FieldErrors<ReportField>>({});

    const fileInput = useRef<HTMLInputElement>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    const set = <K extends keyof ReportDetailsInput>(key: K, value: ReportDetailsInput[K]) =>
      setDetails((current) => ({ ...current, [key]: value }));

    /** id + error together, so no field can be marked without being reachable. */
    const field = (key: ReportField) => ({ id: fieldId(FORM_ID, key), error: fieldErrors[key] });

    const reportError = (message: string | null) => {
      setError(message);
      onErrorChange?.(message);
      if (message) {
        requestAnimationFrame(() =>
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        );
      }
    };

    // The student picker is only loaded when there is a choice to make.
    useEffect(() => {
      if (lockStudent) return;
      const load = async () => {
        const { data } = await supabase.from("students").select("id, name, nickname").order("name");
        setStudents(
          ((data ?? []) as Array<{ id: string; name: string | null; nickname: string | null }>).map(
            (student) => ({
              value: student.id,
              label: student.nickname
                ? `${student.name ?? "(no name)"} · ${student.nickname}`
                : student.name ?? "(no name)",
            }),
          ),
        );
      };
      void load();
    }, [lockStudent]);

    useEffect(() => {
      if (!reportId) return;
      const load = async () => {
        setLoading(true);
        const result = await loadReport(reportId);
        if (result.error) {
          reportError(result.error);
        } else {
          setDetails(result.details);
          setAttachments(result.attachments);
        }
        setLoading(false);
      };
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportId]);

    useEffect(() => {
      if (studentId) setDetails((current) => ({ ...current, studentId }));
    }, [studentId]);

    const currentValues = JSON.stringify({ details, attachments, removing });
    const openedWith = useRef<string>(currentValues);
    useEffect(() => {
      openedWith.current = JSON.stringify({ details, attachments, removing: [] });
      // Only after the record has loaded, or an edit is dirty on arrival.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);
    const dirty = currentValues !== openedWith.current || drafts.length > 0;

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty]);

    const setBusy = (next: boolean) => {
      setSaving(next);
      onSavingChange?.(next);
    };

    const chooseFiles = (files: FileList | null) => {
      if (!files?.length) return;
      const chosen = Array.from(files);

      for (const file of chosen) {
        const problem = attachmentProblem(file);
        if (problem) {
          reportError(problem);
          return;
        }
      }

      reportError(null);
      // Nothing is shared with a donor because it was uploaded. Ticking is a
      // separate, deliberate act.
      setDrafts((current) => [...current, ...chosen.map((file) => ({ file, isPublic: false }))]);
      if (fileInput.current) fileInput.current.value = "";
    };

    const toggleExistingPublic = (path: string, isPublic: boolean) =>
      setAttachments((current) =>
        current.map((attachment) =>
          attachment.path === path ? { ...attachment, is_public: isPublic } : attachment,
        ),
      );

    const toggleRemoval = (path: string) =>
      setRemoving((current) =>
        current.includes(path) ? current.filter((entry) => entry !== path) : [...current, path],
      );

    const save = async () => {
      reportError(null);

      const problems = validateReportDetails(details);
      setFieldErrors(problems);

      if (hasErrors(problems)) {
        // The count at the top, the sentences on the fields, and the cursor in
        // the first one.
        reportError(errorSummary(problems));
        focusField(FORM_ID, firstError(problems, REPORT_FIELD_ORDER));
        return;
      }

      setBusy(true);

      // Upload first: a saved row pointing at files that were never uploaded is
      // a broken record, and a stray file in the bucket is not.
      const upload = await uploadAttachments(details.studentId!, drafts);
      if (upload.error) {
        setBusy(false);
        reportError(upload.error);
        return;
      }

      const kept = attachments.filter((attachment) => !removing.includes(attachment.path));
      const result = await saveReport(details, [...kept, ...upload.attachments], reportId);

      if (result.error || !result.id) {
        setBusy(false);
        reportError(result.error ?? "The report did not save.");
        return;
      }

      // The row no longer references these, so the files can go. Best effort:
      // the report is already correct either way.
      if (removing.length) await removeAttachments(removing);

      await logEvent(
        details.studentId!,
        reportId ? "report_updated" : "report_added",
        `${reportId ? "Report updated" : "Report added"} · ${REPORT_STATE_META[details.status].label}`,
        { report_id: result.id, status: details.status },
      );

      setBusy(false);
      onSaved({ id: result.id, studentId: details.studentId });
    };

    useImperativeHandle(ref, () => ({ submit: () => void save() }), [
      details,
      attachments,
      drafts,
      removing,
      reportId,
    ]);

    if (loading) return <LoadingState />;

    const studentName = students.find((student) => student.value === details.studentId)?.label;

    return (
      <FormBody
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <LoadingState variant="overlay" visible={saving} />
        <div ref={errorRef}>
          <FormError>{error}</FormError>
        </div>

        <FormSection title="Report">
          {lockStudent ? (
            <InlineMessage tone="info">
              This report is about {studentName ?? "this student"}.
            </InlineMessage>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Select
                label="Student"
                {...field("studentId")}
                required
                placeholder="Select student"
                searchable
                clearable
                nothingFoundMessage="No student matches"
                data={students}
                value={details.studentId}
                onChange={(value) => set("studentId", value)}
              />
            </SimpleGrid>
          )}

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt={lockStudent ? "lg" : "lg"}>
            <DateInput
              label="Report date"
              {...field("reportDate")}
              required
              value={parseDateInput(details.reportDate)}
              onChange={(value) => set("reportDate", toDateInputValue(value))}
            />
            <DateInput
              label="Covers from"
              {...field("coversStart")}
              placeholder="DD/MM/YYYY"
              clearable
              value={parseDateInput(details.coversStart)}
              onChange={(value) => set("coversStart", toDateInputValue(value))}
            />
            <DateInput
              label="Covers until"
              {...field("coversEnd")}
              placeholder="DD/MM/YYYY"
              clearable
              value={parseDateInput(details.coversEnd)}
              onChange={(value) => set("coversEnd", toDateInputValue(value))}
            />
          </SimpleGrid>

          {/* The state the directory reads. Kept beside the dates rather than
              hidden behind the save button, so a teacher can see they are
              saving a draft. */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
            <Select
              label="Status"
              required
              allowDeselect={false}
              data={REPORT_STATUS_OPTIONS}
              value={details.status}
              onChange={(value) => value && set("status", value as ReportDetailsInput["status"])}
            />
            <DateInput
              label="Due date"
              {...field("dueDate")}
              placeholder="DD/MM/YYYY"
              clearable
              value={parseDateInput(details.dueDate)}
              onChange={(value) => set("dueDate", toDateInputValue(value))}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Progress">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <TextInput
              label="Grade"
              placeholder="e.g. A, Pass, 3.5"
              value={details.grade}
              onChange={(event) => set("grade", event.currentTarget.value)}
            />
            <TextInput
              label="Grade as a number"
              {...field("gradeNumeric")}
              placeholder="e.g. 78"
              inputMode="decimal"
              value={details.gradeNumeric}
              onChange={(event) => set("gradeNumeric", event.currentTarget.value)}
            />
            <TextInput
              label="Progress summary"
              placeholder="e.g. Very good progress"
              value={details.gradeText}
              onChange={(event) => set("gradeText", event.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="For the donor" hint="The one part of this report a donor reads. Everything above is ours.">
          <Textarea
            label="Comment for donor"
            {...field("donorComment")}
            minRows={5}
            autosize
            placeholder="What changed for this student this term?"
            value={details.donorComment}
            onChange={(event) => set("donorComment", event.currentTarget.value)}
          />
        </FormSection>

        <FormSection title="Internal note">
          <Textarea
            label="Internal note"
            minRows={3}
            autosize
            placeholder="Anything the office should know that the donor should not read."
            value={details.internalNote}
            onChange={(event) => set("internalNote", event.currentTarget.value)}
          />
        </FormSection>

        <FormSection
          title="Attachments"
          actions={
            <Button
              variant="secondary"
              icon="upload"
              type="button"
              disabled={saving}
              onClick={() => fileInput.current?.click()}
            >
              Add files
            </Button>
          }
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            className={styles.fileInput}
            onChange={(event) => chooseFiles(event.currentTarget.files)}
          />

          {attachments.length === 0 && drafts.length === 0 ? (
            <p className={styles.empty}>No files on this report yet.</p>
          ) : (
            <div className={styles.list}>
              {attachments.map((attachment) => {
                const marked = removing.includes(attachment.path);
                return (
                  <div
                    key={attachment.path}
                    className={`${styles.row} ${marked ? styles.rowRemoved : ""}`}
                  >
                    <span className={styles.thumb}>
                      {isImagePath(attachment.path) ? (
                        <img src={attachmentUrl(attachment.path)} alt="" />
                      ) : (
                        <Icon name="clipboard-list" size={16} />
                      )}
                    </span>
                    <span className={styles.name}>
                      <a href={attachmentUrl(attachment.path)} target="_blank" rel="noreferrer">
                        {attachmentName(attachment.path)}
                      </a>
                      {marked && <span className={styles.removedNote}>Removed when you save</span>}
                    </span>
                    <Checkbox
                      label="Share with donors"
                      checked={attachment.is_public}
                      disabled={marked}
                      onChange={(event) =>
                        toggleExistingPublic(attachment.path, event.currentTarget.checked)
                      }
                    />
                    <Button variant="ghost" type="button" onClick={() => toggleRemoval(attachment.path)}>
                      {marked ? "Keep" : "Remove"}
                    </Button>
                  </div>
                );
              })}

              {drafts.map((draft, index) => (
                <div key={`${draft.file.name}-${index}`} className={styles.row}>
                  <span className={styles.thumb}>
                    <Icon name="upload" size={16} />
                  </span>
                  <span className={styles.name}>
                    {draft.file.name}
                    <span className={styles.removedNote}>Uploaded when you save</span>
                  </span>
                  <Checkbox
                    label="Share with donors"
                    checked={draft.isPublic}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, isPublic: event.currentTarget.checked } : entry,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.privacyNote}>
            <FieldLabel>Sharing</FieldLabel>
            <InlineMessage tone="info" size="xs">
              A file is only sent to donors when it is ticked. Photographs of children are shared
              one at a time, on purpose.
            </InlineMessage>
          </div>
        </FormSection>

        {showActions && (
          <FormFooter
            left={
              onCancel && (
                <Button variant="ghost" type="button" onClick={onCancel}>
                  Cancel
                </Button>
              )
            }
          >
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : submitLabel ?? (reportId ? "Save changes" : "Save report")}
            </Button>
          </FormFooter>
        )}
      </FormBody>
    );
  },
);

ReportForm.displayName = "ReportForm";

export default ReportForm;
