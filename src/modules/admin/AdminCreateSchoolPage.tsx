// src/modules/admin/AdminCreateSchoolPage.tsx
//
// Add school, as the four-step wizard the design calls for:
//
//   1 School details  →  2 Teachers  →  3 Students  →  4 Assign
//
// What actually persists is bounded by the schema. The school row carries a
// name and a composed address; students are inserted with their grade, contact
// and responsible teacher. Everything else on step 1 models the approved
// frontend ahead of the schema work and is not written anywhere.
//
// Teachers cannot be created here — a teacher is an account, not a row — so
// step 2 matches the imported list against existing teacher profiles by email.
// Rows without a match are reported and the school still saves.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  NumberInput,
  SegmentedControl,
  Select as MantineSelect,
  SimpleGrid,
  Table,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate } from "react-router-dom";
import {
  FieldLabel,
  FormBody,
  FormError,
  FormFooter,
  FormPage,
  FormSection,
  InlineMessage,
  LoadingState,
} from "../../design-system";
import { Button, Icon } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { DORMITORY_OPTIONS, GRADES, PROVINCES, SCHOOL_SYSTEMS } from "./schoolProfile";
import styles from "./AdminDirectory.module.scss";

const STEPS = ["School details", "Teachers", "Students", "Assign"];

interface TeacherDraft {
  /** Stable across edits and removals, so React keys and the assignment map
   *  never depend on a row's current position. */
  key: string;
  name: string;
  email: string;
  subject: string;
  phone: string;
}

interface StudentDraft {
  key: string;
  name: string;
  grade: string;
  guardian: string;
  phone: string;
  scholarship: string;
}

interface TeacherAccount {
  id: string;
  name: string;
  email: string;
}

let rowSeq = 0;
const nextKey = () => {
  rowSeq += 1;
  return `row-${rowSeq}`;
};

const TEACHER_COLUMNS: Array<[keyof TeacherDraft, string, string]> = [
  ["name", "Name", "Somchai Jaidee"],
  ["email", "Email", "name@icare.or.th"],
  ["subject", "Subject", "Mathematics"],
  ["phone", "Phone", "08x xxx xxxx"],
];

const STUDENT_COLUMNS: Array<[keyof StudentDraft, string, string]> = [
  ["name", "Name", "Anucha Pankham"],
  ["grade", "Grade", "P3"],
  ["guardian", "Guardian", "Malee Pankham"],
  ["phone", "Guardian phone", "08x xxx xxxx"],
  ["scholarship", "Scholarship", "Optional"],
];

const TEACHER_SAMPLE = [
  "name,email,subject,phone",
  "Somchai Jaidee,somchai@icare.or.th,Mathematics,0812345670",
  "Suda Srisuk,suda@icare.or.th,Thai language,0812345671",
].join("\n");

const STUDENT_SAMPLE = [
  "name,grade,guardian,phone,scholarship",
  "Anucha Pankham,P3,Malee Pankham,0898765430,Full",
  "Siriporn Doikaew,P5,Kanya Doikaew,0898765431,",
].join("\n");

/** Split a CSV line, tolerating quoted fields with commas inside. */
const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      out.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  out.push(field.trim());
  return out;
};

const parseCsv = <T extends { key: string }>(
  text: string,
  keys: Array<keyof T>,
): { rows: T[]; skipped: number } => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], skipped: 0 };

  const header = lines[0].toLowerCase();
  const hasHeader = keys.some((key) => header.includes(String(key)));
  const body = hasHeader ? lines.slice(1) : lines;

  const rows: T[] = [];
  let skipped = 0;

  body.forEach((line) => {
    const cells = splitCsvLine(line);
    if (!cells[0]) {
      skipped += 1;
      return;
    }
    const row = { key: nextKey() } as T;
    keys.forEach((field, index) => {
      (row as any)[field] = cells[index] ?? "";
    });
    rows.push(row);
  });

  return { rows, skipped };
};

const downloadCsv = (filename: string, contents: string) => {
  const url = URL.createObjectURL(new Blob([`﻿${contents}\n`], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const AdminCreateSchoolPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // ── Step 1: school details ──────────────────────────────────────────────
  // Only englishName and the composed address are persisted today.
  const [schoolSystem, setSchoolSystem] = useState<string>(SCHOOL_SYSTEMS[0]);
  const [gradeFrom, setGradeFrom] = useState<string | null>("K1");
  const [gradeTo, setGradeTo] = useState<string | null>("P6");
  const [totalEnrollment, setTotalEnrollment] = useState<number | string>("");
  const [dormitoryStatus, setDormitoryStatus] = useState<string | null>(DORMITORY_OPTIONS[0]);
  const [thaiName, setThaiName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [province, setProvince] = useState<string | null>(PROVINCES[0]);
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [dateJoined, setDateJoined] = useState<Date | null>(new Date());
  const [thaiAddress, setThaiAddress] = useState("");
  const [englishAddress, setEnglishAddress] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [principalPhone, setPrincipalPhone] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactLine, setContactLine] = useState("");
  const [description, setDescription] = useState("");

  // ── Steps 2–4: rosters and assignment ───────────────────────────────────
  const [teacherRows, setTeacherRows] = useState<TeacherDraft[]>([]);
  const [studentRows, setStudentRows] = useState<StudentDraft[]>([]);
  const [assignment, setAssignment] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<TeacherAccount[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teacherFileRef = useRef<HTMLInputElement>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);

  // Teacher accounts already in the system, so imported rows can be matched to
  // a real profile id and students can carry a responsible_teacher_id.
  useEffect(() => {
    const loadAccounts = async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("person_roles").select("user_id, role"),
      ]);

      const teacherIds = new Set(
        (roles ?? []).filter((role: any) => role.role === "teacher").map((role: any) => role.user_id),
      );

      setAccounts(
        (profiles ?? [])
          .filter((profile: any) => teacherIds.has(profile.id))
          .map((profile: any) => ({
            id: profile.id,
            name: profile.full_name ?? "(no name)",
            email: (profile.email ?? "").toLowerCase(),
          })),
      );
    };

    void loadAccounts();
  }, []);

  /** Imported teachers paired with the account they resolve to, if any. */
  const matchedTeachers = useMemo(
    () =>
      teacherRows.map((teacher) => ({
        teacher,
        account: accounts.find(
          (account) => account.email && account.email === teacher.email.trim().toLowerCase(),
        ),
      })),
    [teacherRows, accounts],
  );

  const assignable = useMemo(
    () => matchedTeachers.filter((entry) => entry.account),
    [matchedTeachers],
  );

  const unmatched = matchedTeachers.filter((entry) => !entry.account);

  const detailsComplete =
    Boolean(thaiName.trim()) &&
    Boolean(englishName.trim()) &&
    Boolean(province) &&
    Boolean(district.trim()) &&
    Boolean(subdistrict.trim()) &&
    Boolean(contactName.trim());

  const importFile = (file: File, kind: "teachers" | "students") => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (kind === "teachers") {
        const { rows, skipped } = parseCsv<TeacherDraft>(text, ["name", "email", "subject", "phone"]);
        setTeacherRows((current) => [...current, ...rows]);
        setImportNote(`${rows.length} teachers added${skipped ? ` · ${skipped} rows skipped` : ""}`);
      } else {
        const { rows, skipped } = parseCsv<StudentDraft>(text, [
          "name",
          "grade",
          "guardian",
          "phone",
          "scholarship",
        ]);
        setStudentRows((current) => [...current, ...rows]);
        setImportNote(`${rows.length} students added${skipped ? ` · ${skipped} rows skipped` : ""}`);
      }
    };
    reader.readAsText(file);
  };

  const distributeEvenly = () => {
    if (!assignable.length) return;
    const next: Record<string, string> = {};
    studentRows.forEach((student, index) => {
      next[student.key] = assignable[index % assignable.length].account!.id;
    });
    setAssignment(next);
  };

  const save = async () => {
    setError(null);

    if (!detailsComplete) {
      setStep(0);
      setError("Complete all required fields on step 1 before saving.");
      return;
    }

    // The students table requires a guardian and a phone on every row.
    const incomplete = studentRows.filter(
      (student) => !student.name.trim() || !student.guardian.trim() || !student.phone.trim(),
    );
    if (incomplete.length) {
      setStep(2);
      setError(
        `${incomplete.length} student rows are missing a name, guardian or phone. All three are required.`,
      );
      return;
    }

    setSaving(true);

    const location = [subdistrict.trim(), district.trim(), province].filter(Boolean).join(", ");
    const composedAddress = [englishAddress.trim() || thaiAddress.trim(), location]
      .filter(Boolean)
      .join(", ");

    const { data: created, error: insertError } = await supabase
      .from("schools")
      .insert({ name: englishName.trim(), address: composedAddress || null })
      .select("id")
      .maybeSingle();

    if (insertError || !created?.id) {
      console.error("Error creating school", insertError);
      setError(insertError?.message ?? "Could not create the school.");
      setSaving(false);
      return;
    }

    if (studentRows.length) {
      const payload = studentRows.map((student) => ({
        name: student.name.trim(),
        school_id: created.id,
        grade_level: student.grade.trim() || null,
        scholarship: student.scholarship.trim() || null,
        responsible_teacher_id: assignment[student.key] || null,
        contact: { guardian: student.guardian.trim(), phone: student.phone.trim() },
      }));

      const { error: studentError } = await supabase.from("students").insert(payload);
      if (studentError) {
        console.error("Error adding students", studentError);
        setError(
          `The school was created, but the students could not be added: ${studentError.message}`,
        );
        setSaving(false);
        return;
      }
    }

    navigate(`/admin/schools/${created.id}`);
  };

  const dropZone = (kind: "teachers" | "students") => {
    const inputRef = kind === "teachers" ? teacherFileRef : studentFileRef;
    return (
      <div>
        <button
          type="button"
          className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) importFile(file, kind);
          }}
        >
          <Icon name="upload" size={20} />
          <span className={styles.dropZoneTitle}>Drop a CSV file here, or click to choose one</span>
          <span className={styles.dropZoneHint}>
            Expected columns:{" "}
            {(kind === "teachers" ? TEACHER_COLUMNS : STUDENT_COLUMNS)
              .map(([, label]) => label.toLowerCase())
              .join(", ")}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importFile(file, kind);
            event.target.value = "";
          }}
        />
        <div className={styles.dropZoneFooter}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() =>
              kind === "teachers"
                ? downloadCsv("teachers-sample.csv", TEACHER_SAMPLE)
                : downloadCsv("students-sample.csv", STUDENT_SAMPLE)
            }
          >
            Download sample {kind} csv
          </button>
          {importNote && <span className={styles.dropZoneNote}>{importNote}</span>}
        </div>
      </div>
    );
  };

  const stagedTable = <T extends TeacherDraft | StudentDraft>(
    columns: Array<[keyof T, string, string]>,
    rows: T[],
    setRows: React.Dispatch<React.SetStateAction<T[]>>,
    blank: T,
    noun: string,
  ) => (
    <>
      <div className={styles.stagedHead}>
        <span className={styles.stagedCount}>
          {rows.length} {noun}
          {rows.length === 1 ? "" : "s"} staged
        </span>
        <Button
          variant="secondary"
          icon="plus"
          onClick={() => setRows((current) => [...current, { ...blank, key: nextKey() }])}
        >
          Add row
        </Button>
        {rows.length > 0 && (
          <button type="button" className={styles.linkButton} onClick={() => setRows([])}>
            Remove all
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className={styles.detailEmpty}>
          No {noun}s added yet. This step is optional — you can save the school and add records later.
        </p>
      ) : (
        <div className={styles.stagedTable}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                {columns.map(([key, label]) => (
                  <Table.Th key={String(key)}>{label}</Table.Th>
                ))}
                <Table.Th style={{ width: 48 }} aria-label="Remove" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => (
                <Table.Tr key={row.key}>
                  {columns.map(([key, label, placeholder]) => (
                    <Table.Td key={String(key)}>
                      <TextInput
                        aria-label={`${label} for row ${index + 1}`}
                        placeholder={placeholder}
                        value={String(row[key] ?? "")}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setRows((current) =>
                            current.map((item, position) =>
                              position === index ? { ...item, [key]: value } : item,
                            ),
                          );
                        }}
                      />
                    </Table.Td>
                  ))}
                  <Table.Td>
                    <button
                      type="button"
                      className={styles.rowRemove}
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() =>
                        setRows((current) => current.filter((_, position) => position !== index))
                      }
                    >
                      <Icon name="trash-2" size={15} />
                    </button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </>
  );

  const assignedCount = studentRows.filter((student) => assignment[student.key]).length;

  return (
    <FormPage
      title="Add school"
      steps={STEPS.map((label, index) => ({
        label,
        onClick: () => setStep(index),
      }))}
      activeStep={step}
    >
      <LoadingState variant="overlay" visible={saving} />
      <FormError>{error}</FormError>

      <FormBody
        onSubmit={(event) => {
          event.preventDefault();
          if (step < STEPS.length - 1) {
            setImportNote(null);
            setStep(step + 1);
          } else void save();
        }}
      >
        {step === 0 && (
          <>
            <FormSection title="Programme" hint="School system and the grades iCare covers here">
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="lg">
                <div>
                  <FieldLabel>School system</FieldLabel>
                  <SegmentedControl
                    value={schoolSystem}
                    onChange={setSchoolSystem}
                    data={SCHOOL_SYSTEMS}
                    className={styles.systemControl}
                  />
                </div>
                <MantineSelect label="Grade from" value={gradeFrom} onChange={setGradeFrom} data={GRADES} allowDeselect={false} />
                <MantineSelect label="Grade to" value={gradeTo} onChange={setGradeTo} data={GRADES} allowDeselect={false} />
                <NumberInput label="Total enrollment" value={totalEnrollment} onChange={setTotalEnrollment} placeholder="132" min={0} hideControls />
                <MantineSelect label="Dormitory status" value={dormitoryStatus} onChange={setDormitoryStatus} data={DORMITORY_OPTIONS} allowDeselect={false} />
              </SimpleGrid>
            </FormSection>

            <FormSection title="School names" hint="Thai is the legal name; English is used in reports">
              <div className={styles.namesGrid}>
                <TextInput label="Thai school name" required value={thaiName} onChange={(e) => setThaiName(e.currentTarget.value)} placeholder="โรงเรียน..." />
                <TextInput label="English school name" required value={englishName} onChange={(e) => setEnglishName(e.currentTarget.value)} placeholder="Ban ... School" />
                <TextInput label="School code" value={schoolCode} onChange={(e) => setSchoolCode(e.currentTarget.value)} placeholder="50100123" description="Optional" />
              </div>
            </FormSection>

            <FormSection title="Address">
              <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
                <MantineSelect label="Province" required searchable value={province} onChange={setProvince} data={PROVINCES} />
                <TextInput label="District" required value={district} onChange={(e) => setDistrict(e.currentTarget.value)} placeholder="Search districts" />
                <TextInput label="Subdistrict" required value={subdistrict} onChange={(e) => setSubdistrict(e.currentTarget.value)} placeholder="Search subdistricts" />
                <DateInput label="Date joined iCare" value={dateJoined} onChange={setDateJoined} valueFormat="DD MMM YYYY" placeholder="Choose date" clearable />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
                <Textarea label="Thai address" minRows={3} value={thaiAddress} onChange={(e) => setThaiAddress(e.currentTarget.value)} placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด" />
                <Textarea label="English address" minRows={3} value={englishAddress} onChange={(e) => setEnglishAddress(e.currentTarget.value)} placeholder="House no., Moo, subdistrict, district, province" />
              </SimpleGrid>
            </FormSection>

            <FormSection title="Principal" hint="Optional">
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                <TextInput label="Principal name" value={principalName} onChange={(e) => setPrincipalName(e.currentTarget.value)} placeholder="Name (ชื่อ-สกุล)" />
                <TextInput label="Principal phone" value={principalPhone} onChange={(e) => setPrincipalPhone(e.currentTarget.value)} placeholder="08x xxx xxxx" />
                <TextInput label="Principal email" type="email" value={principalEmail} onChange={(e) => setPrincipalEmail(e.currentTarget.value)} placeholder="name@icare.or.th" />
              </SimpleGrid>
            </FormSection>

            <FormSection title="Contact person" hint="Required for school coordination">
              <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
                <TextInput label="Contact person" required value={contactName} onChange={(e) => setContactName(e.currentTarget.value)} placeholder="Name (ชื่อ-สกุล)" />
                <TextInput label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.currentTarget.value)} placeholder="08x xxx xxxx" />
                <TextInput label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.currentTarget.value)} placeholder="name@icare.or.th" />
                <TextInput label="LINE ID" value={contactLine} onChange={(e) => setContactLine(e.currentTarget.value)} placeholder="LINE ID" />
              </SimpleGrid>
            </FormSection>

            <FormSection title="Description" hint="Access, language needs, or visit constraints">
              <Textarea label="Description" minRows={4} value={description} onChange={(e) => setDescription(e.currentTarget.value)} placeholder="Anything a field officer should know before visiting" />
            </FormSection>
          </>
        )}

        {step === 1 && (
          <FormSection
            title="Teachers at this school"
            hint="Optional. Import a CSV or type rows in — both feed the same list."
          >
            <InlineMessage tone="info">
              Teachers are accounts, so they are matched to existing profiles by email rather than
              created here. Rows without a matching account are listed on the Assign step.
            </InlineMessage>
            {dropZone("teachers")}
            {stagedTable<TeacherDraft>(
              TEACHER_COLUMNS,
              teacherRows,
              setTeacherRows,
              { key: nextKey(), name: "", email: "", subject: "", phone: "" },
              "teacher",
            )}
          </FormSection>
        )}

        {step === 2 && (
          <FormSection
            title="Students at this school"
            hint="Optional. A name, guardian and guardian phone are required on every row."
          >
            {dropZone("students")}
            {stagedTable<StudentDraft>(
              STUDENT_COLUMNS,
              studentRows,
              setStudentRows,
              { key: nextKey(), name: "", grade: "", guardian: "", phone: "", scholarship: "" },
              "student",
            )}
          </FormSection>
        )}

        {step === 3 && (
          <FormSection title="Assign teachers to students" hint={`${assignedCount} of ${studentRows.length} assigned`}>
            {unmatched.length > 0 && (
              <InlineMessage tone="warning">
                {unmatched.length} imported teachers have no account yet and cannot be assigned:{" "}
                {unmatched.map((entry) => entry.teacher.name || entry.teacher.email).join(", ")}.
                Invite them from Users &amp; roles, then reopen this school.
              </InlineMessage>
            )}

            {studentRows.length === 0 || assignable.length === 0 ? (
              <p className={styles.detailEmpty}>
                {studentRows.length === 0
                  ? "Add at least one student on step 3 to assign them."
                  : "No imported teacher matched an existing account, so there is nobody to assign."}
              </p>
            ) : (
              <>
                <div className={styles.stagedHead}>
                  <Button variant="secondary" onClick={distributeEvenly}>
                    Distribute evenly
                  </Button>
                  <button type="button" className={styles.linkButton} onClick={() => setAssignment({})}>
                    Clear
                  </button>
                </div>

                <div className={styles.stagedTable}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Student</Table.Th>
                        <Table.Th style={{ width: 110 }}>Grade</Table.Th>
                        <Table.Th style={{ width: 300 }}>Assigned teacher</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {studentRows.map((student, index) => (
                        <Table.Tr key={student.key}>
                          <Table.Td>{student.name || `Student ${index + 1}`}</Table.Td>
                          <Table.Td>{student.grade || "—"}</Table.Td>
                          <Table.Td>
                            <MantineSelect
                              aria-label={`Teacher for ${student.name || `student ${index + 1}`}`}
                              placeholder="Unassigned"
                              clearable
                              value={assignment[student.key] ?? null}
                              onChange={(value) =>
                                setAssignment((current) => {
                                  const next = { ...current };
                                  if (value) next[student.key] = value;
                                  else delete next[student.key];
                                  return next;
                                })
                              }
                              data={assignable.map((entry) => ({
                                value: entry.account!.id,
                                label: entry.teacher.subject
                                  ? `${entry.account!.name} · ${entry.teacher.subject}`
                                  : entry.account!.name,
                              }))}
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </>
            )}
          </FormSection>
        )}

        <FormFooter
          left={
            <Button variant="ghost" type="button" onClick={() => navigate("/admin/schools")}>
              Cancel
            </Button>
          }
        >
          {step > 0 && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setImportNote(null);
                setStep(step - 1);
              }}
            >
              Back
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button variant="secondary" type="submit">
              Next: {STEPS[step + 1]}
            </Button>
          )}
          <Button variant="primary" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save school"}
          </Button>
        </FormFooter>
      </FormBody>
    </FormPage>
  );
};

export default AdminCreateSchoolPage;
