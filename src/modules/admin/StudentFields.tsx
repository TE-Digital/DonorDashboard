// src/modules/admin/StudentFields.tsx
//
// The student record as a set of fields, in the three groups it is described
// in — personal details, school, teacher and support.
//
// Rendered by both the add-student form and the edit screen. They differ in
// exactly two ways, and both are props here rather than a second copy of the
// fields: on the add form a photo is held until the record has an id, and on a
// page there is somewhere to open an "Add school" drawer that a drawer step
// has to handle itself.
//
// Field order, labels, required marks and grouping are defined once, here. A
// field added to one screen and not the other is the bug this file exists to
// prevent.

import React, { useMemo, useRef } from "react";
import { Avatar, Select, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  FieldLabel,
  FormSection,
  InlineMessage,
  parseDateInput,
  toDateInputValue,
} from "../../design-system";
import { Button } from "../../design-system/lumen";
import {
  GUARDIAN_RELATIONSHIPS,
  PHOTO_ACCEPT,
  rankTeachersForSchool,
  type Option,
  type SchoolOption,
  type StudentDetailsInput,
  type TeacherOption,
} from "./studentProfile";
import styles from "./AdminDirectory.module.scss";

export interface StudentFieldsProps {
  details: StudentDetailsInput;
  onChange: (next: StudentDetailsInput) => void;

  schools: SchoolOption[];
  teachers: TeacherOption[];
  grantTypes: Option[];

  /** Shows the school as fixed context instead of a picker. */
  lockSchool?: boolean;
  /** Renders "Add school" / "Add teacher" on the section rule. Hidden when absent. */
  onAddSchool?: () => void;
  onAddTeacher?: () => void;

  /** The photo to show: an uploaded one, or a preview of the chosen file. */
  photoUrl?: string | null;
  /** What the control says under the button. Differs between add and edit. */
  photoHint: React.ReactNode;
  photoBusy?: boolean;
  onChoosePhoto: (file: File) => void;
  /** Offered only when there is something to clear. */
  onClearPhoto?: () => void;

  disabled?: boolean;
}

export const StudentFields: React.FC<StudentFieldsProps> = ({
  details,
  onChange,
  schools,
  teachers,
  grantTypes,
  lockSchool = false,
  onAddSchool,
  onAddTeacher,
  photoUrl,
  photoHint,
  photoBusy = false,
  onChoosePhoto,
  onClearPhoto,
  disabled = false,
}) => {
  const photoInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof StudentDetailsInput>(key: K, value: StudentDetailsInput[K]) =>
    onChange({ ...details, [key]: value });

  const schoolName = useMemo(
    () => schools.find((school) => school.value === details.schoolId)?.label ?? null,
    [schools, details.schoolId],
  );

  /**
   * Teachers at the chosen school, then everybody else under a heading that
   * says so. A teacher's school is often blank on older profiles, so this
   * orders the list rather than cutting it — a student occasionally answers to
   * somebody from another school, and hiding them makes the form unusable in
   * exactly the cases that need a person.
   */
  const teacherOptions = useMemo(() => {
    const { atSchool, elsewhere } = rankTeachersForSchool(teachers, details.schoolId);
    if (!details.schoolId || atSchool.length === 0) {
      return teachers.map((teacher) => ({ value: teacher.value, label: teacher.label }));
    }
    return [
      {
        group: `At ${schoolName ?? "this school"}`,
        items: atSchool.map((teacher) => ({ value: teacher.value, label: teacher.label })),
      },
      {
        group: "Other schools",
        items: elsewhere.map((teacher) => ({ value: teacher.value, label: teacher.label })),
      },
    ];
  }, [teachers, details.schoolId, schoolName]);

  return (
    <>
      {/* 1 ─────────────────────────────────────────── Personal details */}
      <FormSection title="Personal details">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <TextInput
            label="Student name"
            required
            placeholder="Anucha Pankham"
            disabled={disabled}
            value={details.name}
            onChange={(event) => set("name", event.currentTarget.value)}
          />
          <TextInput
            label="Nickname"
            placeholder="Optional"
            disabled={disabled}
            value={details.nickname}
            onChange={(event) => set("nickname", event.currentTarget.value)}
          />
        </SimpleGrid>

        <div className={styles.photoField}>
          <FieldLabel>Photo</FieldLabel>
          <div className={styles.photoRow}>
            <Avatar size={64} radius="xl" src={photoUrl ?? undefined}>
              {details.name.trim().charAt(0).toUpperCase() || "?"}
            </Avatar>
            <div className={styles.photoActions}>
              <input
                ref={photoInput}
                type="file"
                accept={PHOTO_ACCEPT}
                className={styles.photoInput}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) onChoosePhoto(file);
                }}
              />
              <div className={styles.photoButtons}>
                <Button
                  variant="secondary"
                  icon="upload"
                  type="button"
                  disabled={disabled || photoBusy}
                  onClick={() => photoInput.current?.click()}
                >
                  {photoBusy ? "Uploading…" : photoUrl ? "Choose another photo" : "Choose photo"}
                </Button>
                {onClearPhoto && photoUrl && (
                  <Button variant="ghost" type="button" disabled={disabled || photoBusy} onClick={onClearPhoto}>
                    Remove
                  </Button>
                )}
              </div>
              <span className={styles.photoHint}>{photoHint}</span>
            </div>
          </div>
        </div>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
          <DateInput
            label="Birthdate"
            placeholder="Optional"
            clearable
            disabled={disabled}
            value={parseDateInput(details.birthdate)}
            onChange={(value) => set("birthdate", toDateInputValue(value))}
          />
          <TextInput
            label="Village"
            placeholder="Optional"
            disabled={disabled}
            value={details.village}
            onChange={(event) => set("village", event.currentTarget.value)}
          />
        </SimpleGrid>

        <div className={styles.formRow}>
          <Textarea
            label="Short bio / background"
            minRows={4}
            autosize
            disabled={disabled}
            placeholder="Anything that helps a donor or a teacher understand this student's situation."
            value={details.bio}
            onChange={(event) => set("bio", event.currentTarget.value)}
          />
        </div>

        <h3 className={styles.subsectionTitle}>Guardian and contact</h3>
        <p className={styles.subsectionHint}>Internal only — never shown to donors.</p>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <TextInput
            label="Guardian name"
            required
            placeholder="Malee Pankham"
            disabled={disabled}
            value={details.guardianName}
            onChange={(event) => set("guardianName", event.currentTarget.value)}
          />
          <Select
            label="Relationship to student"
            placeholder="Optional"
            clearable
            disabled={disabled}
            data={GUARDIAN_RELATIONSHIPS as unknown as string[]}
            value={details.guardianRelationship}
            onChange={(value) => set("guardianRelationship", value)}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="lg">
          <TextInput
            label="Phone"
            required
            placeholder="08x xxx xxxx"
            disabled={disabled}
            value={details.phone}
            onChange={(event) => set("phone", event.currentTarget.value)}
          />
          <TextInput
            label="Address"
            placeholder="Optional"
            disabled={disabled}
            value={details.address}
            onChange={(event) => set("address", event.currentTarget.value)}
          />
          <TextInput
            label="LINE / WhatsApp"
            placeholder="Optional"
            disabled={disabled}
            value={details.lineOrWhatsApp}
            onChange={(event) => set("lineOrWhatsApp", event.currentTarget.value)}
          />
        </SimpleGrid>
      </FormSection>

      {/* 2 ──────────────────────────────────────────────────── School */}
      <FormSection
        title="School"
        actions={
          !lockSchool &&
          onAddSchool && (
            <Button variant="secondary" icon="plus" type="button" disabled={disabled} onClick={onAddSchool}>
              Add school
            </Button>
          )
        }
      >
        {lockSchool ? (
          <>
            <InlineMessage tone="info">
              This student is at {schoolName ?? "this school"}.
            </InlineMessage>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
              <TextInput
                label="Grade level"
                placeholder="e.g. P4, M2"
                disabled={disabled}
                value={details.gradeLevel}
                onChange={(event) => set("gradeLevel", event.currentTarget.value)}
              />
            </SimpleGrid>
          </>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Select
              label="School"
              required
              placeholder="Select school"
              searchable
              clearable
              disabled={disabled}
              nothingFoundMessage="No school matches — add it instead"
              data={schools.map((school) => ({ value: school.value, label: school.label }))}
              value={details.schoolId}
              onChange={(value) => set("schoolId", value)}
            />
            <TextInput
              label="Grade level"
              placeholder="e.g. P4, M2"
              disabled={disabled}
              value={details.gradeLevel}
              onChange={(event) => set("gradeLevel", event.currentTarget.value)}
            />
          </SimpleGrid>
        )}
      </FormSection>

      {/* 3 ────────────────────────────────────────── Teacher & support */}
      <FormSection
        title="Teacher and support"
        // Hidden rather than disabled where there is nowhere to open it — this
        // form is itself a step of the add-teacher drawer there.
        actions={
          onAddTeacher && (
            <Button variant="secondary" icon="plus" type="button" disabled={disabled} onClick={onAddTeacher}>
              Add teacher
            </Button>
          )
        }
      >
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Select
            label="Responsible teacher"
            placeholder="Select teacher"
            searchable
            clearable
            disabled={disabled}
            nothingFoundMessage="No teacher matches — add one instead"
            data={teacherOptions as never}
            value={details.teacherProfileId}
            onChange={(value) => set("teacherProfileId", value)}
          />
          <Select
            label="Scholarship / grant type"
            placeholder="Select scholarship"
            searchable
            clearable
            disabled={disabled}
            data={grantTypes}
            value={details.grantTypeId}
            onChange={(value) => set("grantTypeId", value)}
          />
          <TextInput
            label="Monthly support expected (THB)"
            placeholder="e.g. 800"
            inputMode="decimal"
            disabled={disabled}
            value={details.monthlySupport}
            onChange={(event) => set("monthlySupport", event.currentTarget.value)}
          />
        </SimpleGrid>
      </FormSection>
    </>
  );
};

export default StudentFields;
