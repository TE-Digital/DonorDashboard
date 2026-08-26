// src/modules/admin/StudentForm.tsx
//
// Creating a student, wherever that is done from.
//
// The fields are the ones the add-student screen has always had — identity,
// placement, links and the internal contact block — regrouped into the sections
// the rest of the product uses. The guardian and their phone are required
// because `students_contact_required` rejects a row without them, so the check
// happens here rather than as a database error the admin has to decode.
//
// A profile photo still belongs to the student's own page: the upload is keyed
// by student id, which does not exist until this form has saved.

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Select, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import {
  FormBody,
  FormError,
  FormFooter,
  FormSection,
  InlineMessage,
  LoadingState,
} from "../../design-system";
import { Button } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { writeFailureMessage, type EntityFormHandle, type EntityFormOwnerProps } from "./entityForm";
import styles from "./AdminDirectory.module.scss";

export interface CreatedStudent {
  id: string;
  name: string;
  grade_level: string | null;
  school_id: string | null;
}

export interface StudentFormProps extends EntityFormOwnerProps {
  onCreated: (student: CreatedStudent) => void;
  /** Preselects the school. Passed by the school page, where it is not a choice. */
  defaultSchoolId?: string | null;
  /** Preselects the responsible teacher, from a teacher's own page. */
  defaultTeacherId?: string | null;
  /** Hides the school picker when the context already fixes the school. */
  lockSchool?: boolean;
}

interface Option {
  value: string;
  label: string;
}

export const StudentForm = forwardRef<EntityFormHandle, StudentFormProps>(
  (
    {
      onCreated,
      defaultSchoolId = null,
      defaultTeacherId = null,
      lockSchool = false,
      onSavingChange,
      onErrorChange,
      onDirtyChange,
      onCancel,
      showActions = false,
      submitLabel = "Create student",
    },
    ref,
  ) => {
    const [name, setName] = useState("");
    const [nickname, setNickname] = useState("");
    // Tracks whether the admin has typed into Nickname directly, so the
    // name-based autofill below knows to stop offering suggestions.
    const [nicknameTouched, setNicknameTouched] = useState(false);
    const [schoolId, setSchoolId] = useState<string | null>(defaultSchoolId);
    const [gradeLevel, setGradeLevel] = useState("");
    const [birthdate, setBirthdate] = useState("");
    const [village, setVillage] = useState("");
    const [monthlySupport, setMonthlySupport] = useState("");
    const [teacherProfileId, setTeacherProfileId] = useState<string | null>(defaultTeacherId);
    const [grantTypeId, setGrantTypeId] = useState<string | null>(null);
    const [contactGuardian, setContactGuardian] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [contactAddress, setContactAddress] = useState("");
    const [contactLineOrWhatsApp, setContactLineOrWhatsApp] = useState("");
    const [bio, setBio] = useState("");

    const [schools, setSchools] = useState<Option[]>([]);
    const [teachers, setTeachers] = useState<Option[]>([]);
    const [grantTypes, setGrantTypes] = useState<Option[]>([]);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const errorRef = useRef<HTMLDivElement>(null);

    /** Sets the error, tells the container, and brings it into view. */
    const reportError = (message: string | null) => {
      setError(message);
      onErrorChange?.(message);
      if (message) {
        requestAnimationFrame(() =>
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        );
      }
    };

    useEffect(() => setSchoolId(defaultSchoolId), [defaultSchoolId]);
    useEffect(() => setTeacherProfileId(defaultTeacherId), [defaultTeacherId]);

    // Lookups: schools, teacher accounts, grant types.
    useEffect(() => {
      const load = async () => {
        const [schoolResult, roleResult, grantResult] = await Promise.all([
          supabase.from("schools").select("id, name").order("name"),
          supabase.from("person_roles").select("user_id").eq("role", "teacher"),
          supabase.from("grant_types").select("id, name").order("name"),
        ]);

        setSchools(
          ((schoolResult.data ?? []) as Array<{ id: string; name: string | null }>).map((school) => ({
            value: school.id,
            label: school.name ?? "(no name)",
          })),
        );

        setGrantTypes(
          ((grantResult.data ?? []) as Array<{ id: string; name: string | null }>).map((grant) => ({
            value: grant.id,
            label: grant.name ?? "(no name)",
          })),
        );

        const teacherIds = Array.from(
          new Set(((roleResult.data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id)),
        );
        if (!teacherIds.length) {
          setTeachers([]);
          return;
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds);

        setTeachers(
          ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => ({
            value: profile.id,
            label: profile.full_name ?? "(no name)",
          })),
        );
      };

      void load();
    }, []);


    // Dirty is measured against the values this form opened with, so a
    // container can ask before discarding. Comparing a snapshot rather than
    // counting keystrokes means typing something and deleting it again
    // correctly counts as clean.
    const currentValues = JSON.stringify({
      name,
      nickname,
      schoolId,
      gradeLevel,
      birthdate,
      village,
      monthlySupport,
      teacherProfileId,
      grantTypeId,
      contactGuardian,
      contactPhone,
      contactAddress,
      contactLineOrWhatsApp,
      bio,
    });
    const openedWith = useRef<string>(currentValues);
    const dirty = currentValues !== openedWith.current;

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty]);

    const setBusy = (next: boolean) => {
      setSaving(next);
      onSavingChange?.(next);
    };

    const save = async () => {
      reportError(null);

      if (!name.trim()) {
        reportError("The student's name is required.");
        return;
      }
      if (!contactGuardian.trim() || !contactPhone.trim()) {
        reportError("A guardian name and a phone number are required on every student.");
        return;
      }

      setBusy(true);

      const scholarshipLabel = grantTypeId
        ? grantTypes.find((grant) => grant.value === grantTypeId)?.label ?? null
        : null;

      const { data, error: insertError } = await supabase
        .from("students")
        .insert({
          name: name.trim(),
          nickname: nickname.trim() || null,
          school_id: schoolId,
          grade_level: gradeLevel.trim() || null,
          birthdate: birthdate || null,
          village: village.trim() || null,
          monthly_support_expected:
            monthlySupport.trim() !== "" ? Number(monthlySupport.replace(",", ".")) : null,
          responsible_teacher_id: teacherProfileId,
          grant_type_id: grantTypeId,
          scholarship: scholarshipLabel,
          bio: bio.trim() || null,
          contact: {
            guardian: contactGuardian.trim(),
            phone: contactPhone.trim(),
            address: contactAddress.trim() || null,
            line_or_whatsapp: contactLineOrWhatsApp.trim() || null,
          },
        })
        .select("id, name, grade_level, school_id")
        .maybeSingle();

      setBusy(false);

      if (insertError || !data?.id) {
        console.error("Error creating student", insertError);
        reportError(writeFailureMessage(insertError, "student"));
        return;
      }

      onCreated({
        id: data.id,
        name: data.name ?? name.trim(),
        grade_level: data.grade_level ?? null,
        school_id: data.school_id ?? null,
      });
    };

    useImperativeHandle(ref, () => ({ submit: () => void save() }), [
      name,
      nickname,
      schoolId,
      gradeLevel,
      birthdate,
      village,
      monthlySupport,
      teacherProfileId,
      grantTypeId,
      grantTypes,
      contactGuardian,
      contactPhone,
      contactAddress,
      contactLineOrWhatsApp,
      bio,
    ]);

    // Some fields carry helper text under their label and some don't, which
    // otherwise leaves the shorter fields' inputs sitting higher than their row
    // neighbours (Mantine only renders a description node when a field has
    // one). `.fieldAlign` in AdminDirectory.module.scss stretches every field
    // to the row height and pins its input to the bottom of that box, so
    // inputs land on the same baseline across a row regardless of which
    // fields have a description.
    return (
      <div className={styles.fieldAlign}>
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

          <FormSection title="Student" hint="The nickname is the name donors see">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <TextInput
                label="Student name"
                required
                placeholder="Anucha Pankham"
                value={name}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setName(value);
                  if (!nicknameTouched) {
                    setNickname(value);
                  }
                }}
              />
              <TextInput
                label="Nickname"
                description="Used in donor-facing dashboards, emails and reports"
                placeholder="Optional"
                value={nickname}
                onChange={(event) => {
                  setNicknameTouched(true);
                  setNickname(event.currentTarget.value);
                }}
              />
            </SimpleGrid>
          </FormSection>

          <FormSection title="Placement" hint="Where the student studies and lives">
            <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
              {!lockSchool && (
                <Select
                  label="School"
                  placeholder="Select school"
                  searchable
                  clearable
                  data={schools}
                  value={schoolId}
                  onChange={setSchoolId}
                />
              )}
              <TextInput
                label="Grade level"
                placeholder="e.g. P4, M2"
                value={gradeLevel}
                onChange={(event) => setGradeLevel(event.currentTarget.value)}
              />
              <TextInput
                label="Birthdate"
                type="date"
                value={birthdate}
                onChange={(event) => setBirthdate(event.currentTarget.value)}
              />
              <TextInput
                label="Village"
                placeholder="Optional"
                value={village}
                onChange={(event) => setVillage(event.currentTarget.value)}
              />
            </SimpleGrid>
          </FormSection>

          <FormSection title="Links & support" hint="Who is responsible, and under which grant">
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              <Select
                label="Responsible teacher"
                placeholder="Select teacher"
                searchable
                clearable
                data={teachers}
                value={teacherProfileId}
                onChange={setTeacherProfileId}
              />
              <Select
                label="Scholarship / grant type"
                placeholder="Select scholarship"
                searchable
                clearable
                data={grantTypes}
                value={grantTypeId}
                onChange={setGrantTypeId}
              />
              <TextInput
                label="Monthly support expected"
                placeholder="e.g. 800"
                value={monthlySupport}
                onChange={(event) => setMonthlySupport(event.currentTarget.value)}
              />
            </SimpleGrid>
          </FormSection>

          <FormSection title="Contact" hint="Internal only — never shown to donors">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <TextInput
                label="Guardian name"
                required
                placeholder="Malee Pankham"
                value={contactGuardian}
                onChange={(event) => setContactGuardian(event.currentTarget.value)}
              />
              <TextInput
                label="Phone"
                required
                placeholder="08x xxx xxxx"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.currentTarget.value)}
              />
              <TextInput
                label="Address"
                placeholder="Optional"
                value={contactAddress}
                onChange={(event) => setContactAddress(event.currentTarget.value)}
              />
              <TextInput
                label="LINE / WhatsApp"
                placeholder="Optional"
                value={contactLineOrWhatsApp}
                onChange={(event) => setContactLineOrWhatsApp(event.currentTarget.value)}
              />
            </SimpleGrid>
          </FormSection>

          <FormSection title="Background" hint="Context for teachers and donor reports">
            <Textarea
              label="Short bio"
              minRows={4}
              autosize
              placeholder="Anything that helps donors or teachers understand the student's situation (not public web content)."
              value={bio}
              onChange={(event) => setBio(event.currentTarget.value)}
            />
            <div className={styles.sectionNote}>
              <InlineMessage tone="info" size="xs">
                A profile photo is added from the student's own page once the record exists.
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
                {saving ? "Creating…" : submitLabel}
              </Button>
            </FormFooter>
          )}
        </FormBody>
      </div>
    );
  },
);

StudentForm.displayName = "StudentForm";

export default StudentForm;
