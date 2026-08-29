// src/modules/admin/AssignTeacherModal.tsx
//
// Moving a student to another teacher, from the row the admin is already on.
//
// Reassignment is one of the two things that happen to a student between
// reports — the other is money — and both used to need the edit form: open the
// student, scroll past nine fields that are not changing, change one select,
// save, come back. This is that one select.
//
// Teachers at the student's own school come first, because that is nearly
// always the answer, but the list is ordered rather than cut: a student
// occasionally answers to somebody from another school, and hiding them makes
// the control useless in exactly the case that needed a human.

import React from "react";
import { Modal, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { supabase } from "../../lib/supabaseClient";
import { InlineMessage } from "../../design-system";
import { Button } from "../../design-system/lumen";
import { logEvent } from "./studentEvents";
import { rankTeachersForSchool, type TeacherOption } from "./studentProfile";

export interface AssignTeacherTarget {
  id: string;
  name: string | null;
  school_id: string | null;
  school_name: string | null;
  responsible_teacher_id: string | null;
  teacher_name: string | null;
}

export interface AssignTeacherModalProps {
  student: AssignTeacherTarget | null;
  teachers: TeacherOption[];
  onClose: () => void;
  /** Reload the list. Called after a write that changed something. */
  onAssigned: () => void;
}

export const AssignTeacherModal: React.FC<AssignTeacherModalProps> = ({
  student,
  teachers,
  onClose,
  onAssigned,
}) => {
  const [teacherId, setTeacherId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Opening on a different student starts from that student's teacher, not
  // from whatever was left on screen last time.
  React.useEffect(() => {
    if (student) {
      setTeacherId(student.responsible_teacher_id);
      setError(null);
    }
  }, [student?.id]);

  const options = React.useMemo(() => {
    if (!student) return [];
    const { atSchool, elsewhere } = rankTeachersForSchool(teachers, student.school_id);

    if (!student.school_id || atSchool.length === 0) {
      return teachers.map((teacher) => ({ value: teacher.value, label: teacher.label }));
    }

    return [
      {
        group: `At ${student.school_name ?? "this school"}`,
        items: atSchool.map((teacher) => ({ value: teacher.value, label: teacher.label })),
      },
      {
        group: "Other schools",
        items: elsewhere.map((teacher) => ({ value: teacher.value, label: teacher.label })),
      },
    ];
  }, [teachers, student?.school_id, student?.school_name]);

  const changed = student ? teacherId !== student.responsible_teacher_id : false;

  const save = async () => {
    if (!student || !changed) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("students")
      .update({ responsible_teacher_id: teacherId })
      .eq("id", student.id);

    setSaving(false);

    if (updateError) {
      console.error("Error assigning teacher", updateError);
      setError("The change did not go through. Try again in a minute.");
      return;
    }

    const name = teacherId
      ? teachers.find((teacher) => teacher.value === teacherId)?.label ?? "another teacher"
      : null;

    // The timeline gets the sentence a person would say, both halves of it, so
    // "who had this student in March?" is answerable a year from now.
    await logEvent(
      student.id,
      "teacher_assigned",
      name
        ? student.teacher_name
          ? `Responsible teacher changed from ${student.teacher_name} to ${name}.`
          : `${name} is now the responsible teacher.`
        : `${student.teacher_name ?? "The responsible teacher"} was removed. Nobody is responsible for this student.`,
      { from: student.responsible_teacher_id, to: teacherId },
    );

    notifications.show({
      title: name ? "Teacher assigned" : "Teacher removed",
      message: name
        ? `${student.name ?? "This student"} is now with ${name}.`
        : `${student.name ?? "This student"} has nobody responsible for them.`,
      color: name ? "green" : "yellow",
    });

    onAssigned();
    onClose();
  };

  return (
    <Modal
      opened={student !== null}
      onClose={onClose}
      title={student?.teacher_name ? "Change responsible teacher" : "Assign a responsible teacher"}
      centered
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {student?.name ?? "This student"}
          {student?.school_name ? ` · ${student.school_name}` : ""}
        </Text>

        <InlineMessage tone="error">{error}</InlineMessage>

        <Select
          label="Responsible teacher"
          placeholder="Select teacher"
          searchable
          clearable
          data={options as any}
          value={teacherId}
          onChange={setTeacherId}
          disabled={saving}
          nothingFoundMessage="No teacher matches"
        />

        {teacherId === null && student?.responsible_teacher_id && (
          <InlineMessage tone="warning">
            Clearing this leaves the student with nobody responsible for their reports.
          </InlineMessage>
        )}

        <Stack gap="xs">
          <Button variant="primary" onClick={() => void save()} disabled={!changed || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
};

export default AssignTeacherModal;
