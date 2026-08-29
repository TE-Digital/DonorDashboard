// src/modules/reports/ReportFormDrawer.tsx
//
// Writing or editing a term report over whatever screen you were on — normally
// the student's own page, which is where a report is nearly always written
// from. Same fields as the report route; see ReportForm.
//
// Deleting a report lives here rather than in a menu somewhere else: the person
// who can see what a report says is the person who should decide whether it
// should exist. The confirmation names the date and says the word "permanently",
// because a term's observations cannot be reconstructed.

import React, { useRef, useState } from "react";
import { Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { FormDrawer, InlineMessage } from "../../design-system";
import { Button, Icon } from "../../design-system/lumen";
import type { EntityFormHandle } from "../admin/entityForm";
import { ReportForm, type SavedReport } from "./ReportForm";
import { deleteReport } from "./reportRecord";
import { logEvent } from "../admin/studentEvents";

export interface ReportFormDrawerProps {
  opened: boolean;
  onClose: () => void;
  /** Editing an existing report. Absent creates a new one. */
  reportId?: string | null;
  studentId?: string | null;
  /** Shows the student as fixed context instead of a picker. */
  lockStudent?: boolean;
  /** Named in the subtitle, so the fixed student is visible without a field. */
  contextLabel?: string;
  onSaved: (report: SavedReport) => void;
  /** Fires after a report is deleted, so a list can drop the row. */
  onDeleted?: (reportId: string) => void;
}

export const ReportFormDrawer: React.FC<ReportFormDrawerProps> = ({
  opened,
  onClose,
  reportId = null,
  studentId = null,
  lockStudent = false,
  contextLabel,
  onSaved,
  onDeleted,
}) => {
  const form = useRef<EntityFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editing = Boolean(reportId);

  const close = () => {
    if (saving || deleting) return;
    setFormError(null);
    onClose();
  };

  const remove = async () => {
    if (!reportId) return;
    setDeleting(true);
    const error = await deleteReport(reportId);
    setDeleting(false);
    setConfirmingDelete(false);

    if (error) {
      notifications.show({
        title: "The report was not deleted",
        message: error,
        color: "red",
        icon: <Icon name="circle-alert" size={16} />,
        withBorder: true,
      });
      return;
    }

    if (studentId) await logEvent(studentId, "report_deleted", "Report deleted");

    notifications.show({
      title: "Report deleted",
      message: "The report and its files are gone.",
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });

    onDeleted?.(reportId);
    onClose();
  };

  return (
    <>
      <FormDrawer
        opened={opened}
        onClose={close}
        busy={saving || deleting}
        dirty={dirty}
        title={editing ? "Edit report" : "Add report"}
        subtitle={
          contextLabel
            ? `A term report for ${contextLabel}.`
            : "Record how this student is doing this term."
        }
        size={880}
        status={
          formError ? (
            <InlineMessage tone="error" size="xs">
              {formError}
            </InlineMessage>
          ) : null
        }
        footer={
          <>
            {editing && (
              <Button
                variant="danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving || deleting}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={close} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => form.current?.submit()}
              disabled={saving || deleting}
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Save report"}
            </Button>
          </>
        }
      >
        {/* Remounted per opening, so a cancelled draft is not still there next time. */}
        {opened && (
          <ReportForm
            ref={form}
            reportId={reportId}
            studentId={studentId}
            lockStudent={lockStudent}
            onSaved={onSaved}
            onSavingChange={setSaving}
            onErrorChange={setFormError}
            onDirtyChange={setDirty}
          />
        )}
      </FormDrawer>

      <Modal
        opened={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this report?"
        size="sm"
      >
        <Text size="sm" style={{ textWrap: "pretty" }}>
          The report and everything attached to it are removed permanently. A term's observations
          cannot be written again from memory.
        </Text>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void remove()} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete report"}
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default ReportFormDrawer;
