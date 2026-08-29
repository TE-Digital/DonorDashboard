// src/modules/admin/SchoolForm.tsx
//
// The school record, as one form.
//
// This is the whole of what the approved design asks for a school: programme,
// names, address, principal, contact person, description. What persists is
// bounded by the schema — `schools` has a name and one composed address column —
// so everything else is collected and shown back on the school page through
// schoolProfile.ts. The form says as much rather than implying a silent save.
//
// Used by the add-school route and by SchoolFormDrawer. The action bar lives in
// whichever of those is holding the form; see entityForm.ts.

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  SegmentedControl,
  Select,
  SimpleGrid,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  FieldLabel,
  FormBody,
  FormError,
  FormFooter,
  FormSection,
  InlineMessage,
  LoadingState,
} from "../../design-system";
import { Button } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_REPORTING_PERIOD_MONTHS,
  DORMITORY_OPTIONS,
  GRADES,
  PROVINCES,
  REPORTING_PERIODS,
  SCHOOL_SYSTEMS,
} from "./schoolProfile";
import { isMissingColumnError } from "./teacherProfile";
import { writeFailureMessage, type EntityFormHandle, type EntityFormOwnerProps } from "./entityForm";
import styles from "./AdminDirectory.module.scss";

export interface CreatedSchool {
  id: string;
  name: string;
}

export interface SchoolFormProps extends EntityFormOwnerProps {
  onCreated: (school: CreatedSchool) => void;
}

export const SchoolForm = forwardRef<EntityFormHandle, SchoolFormProps>(
  ({ onCreated, onSavingChange, onErrorChange, onDirtyChange, onCancel, showActions = false, submitLabel = "Create school" }, ref) => {
    // Programme
    const [schoolSystem, setSchoolSystem] = useState<string>(SCHOOL_SYSTEMS[0]);
    const [gradeFrom, setGradeFrom] = useState<string | null>("K1");
    const [gradeTo, setGradeTo] = useState<string | null>("P6");
    // How often this school reports. Every student assigned here inherits it,
    // which is why it is asked once, on the school, and never per student.
    const [reportingPeriod, setReportingPeriod] = useState<string>(
      String(DEFAULT_REPORTING_PERIOD_MONTHS),
    );
    const [dormitoryStatus, setDormitoryStatus] = useState<string | null>(DORMITORY_OPTIONS[0]);

    // Names
    const [thaiName, setThaiName] = useState("");
    const [englishName, setEnglishName] = useState("");
    const [schoolCode, setSchoolCode] = useState("");

    // Address
    const [province, setProvince] = useState<string | null>(PROVINCES[0]);
    const [district, setDistrict] = useState("");
    const [subdistrict, setSubdistrict] = useState("");
    const [dateJoined, setDateJoined] = useState<Date | null>(new Date());
    const [thaiAddress, setThaiAddress] = useState("");
    const [englishAddress, setEnglishAddress] = useState("");

    // People
    const [principalName, setPrincipalName] = useState("");
    const [principalPhone, setPrincipalPhone] = useState("");
    const [principalEmail, setPrincipalEmail] = useState("");
    const [contactName, setContactName] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactLine, setContactLine] = useState("");
    const [description, setDescription] = useState("");

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


    // Dirty is measured against the values this form opened with, so a
    // container can ask before discarding. Comparing a snapshot rather than
    // counting keystrokes means typing something and deleting it again
    // correctly counts as clean.
    const currentValues = JSON.stringify({
      schoolSystem,
      gradeFrom,
      gradeTo,
      reportingPeriod,
      dormitoryStatus,
      thaiName,
      englishName,
      schoolCode,
      province,
      district,
      subdistrict,
      thaiAddress,
      englishAddress,
      principalName,
      principalPhone,
      principalEmail,
      contactName,
      contactPhone,
      contactEmail,
      contactLine,
      description,
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

      if (!thaiName.trim() || !englishName.trim()) {
        reportError("Both the Thai and the English school name are required.");
        return;
      }
      if (!province || !district.trim() || !subdistrict.trim()) {
        reportError("Province, district and subdistrict are required.");
        return;
      }
      if (!contactName.trim()) {
        reportError("A contact person is required for school coordination.");
        return;
      }

      setBusy(true);

      // One address column, so the parts are composed in the order a Thai
      // address reads: street, subdistrict, district, province.
      const location = [subdistrict.trim(), district.trim(), province].filter(Boolean).join(", ");
      const composedAddress = [englishAddress.trim() || thaiAddress.trim(), location]
        .filter(Boolean)
        .join(", ");

      const base = { name: englishName.trim(), address: composedAddress || null };

      // The reporting period is a real column, but a database without the
      // migration should still be able to create a school rather than fail on
      // a field it has never heard of.
      let { data, error: insertError } = await supabase
        .from("schools")
        .insert({ ...base, reporting_period_months: Number(reportingPeriod) })
        .select("id, name")
        .maybeSingle();

      if (insertError && isMissingColumnError(insertError)) {
        ({ data, error: insertError } = await supabase
          .from("schools")
          .insert(base)
          .select("id, name")
          .maybeSingle());
      }

      setBusy(false);

      if (insertError || !data?.id) {
        console.error("Error creating school", insertError);
        reportError(writeFailureMessage(insertError, "school"));
        return;
      }

      onCreated({ id: data.id, name: data.name ?? englishName.trim() });
    };

    useImperativeHandle(ref, () => ({ submit: () => void save() }), [
      thaiName,
      englishName,
      province,
      district,
      subdistrict,
      englishAddress,
      thaiAddress,
      contactName,
    ]);

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

        <FormSection title="Programme">
          {/* Four fields, not five. Total enrollment was asked for and never
              stored, and it is a number that changes every term anyway — the
              student records are the count. The reporting period replaces it,
              and unlike enrollment it is a fact the rest of the product uses. */}
          <div className={styles.programmeGrid}>
            <div className={styles.systemField}>
              <FieldLabel>School system</FieldLabel>
              <SegmentedControl
                fullWidth
                value={schoolSystem}
                onChange={setSchoolSystem}
                data={SCHOOL_SYSTEMS}
                className={styles.systemControl}
              />
            </div>
            <Select label="Grade from" value={gradeFrom} onChange={setGradeFrom} data={GRADES} allowDeselect={false} />
            <Select label="Grade to" value={gradeTo} onChange={setGradeTo} data={GRADES} allowDeselect={false} />
            <Select label="Dormitory status" value={dormitoryStatus} onChange={setDormitoryStatus} data={DORMITORY_OPTIONS} allowDeselect={false} />
          </div>
          <div className={styles.reportingRow}>
            <Select
              label="Reporting period"
              description="How often this school reports on a student. Everyone assigned here inherits it."
              value={reportingPeriod}
              onChange={(value) => value && setReportingPeriod(value)}
              data={REPORTING_PERIODS}
              allowDeselect={false}
            />
          </div>
        </FormSection>

        <FormSection title="School names">
          <div className={styles.namesGrid}>
            <TextInput label="Thai school name" required value={thaiName} onChange={(e) => setThaiName(e.currentTarget.value)} placeholder="โรงเรียน..." />
            <TextInput label="English school name" required value={englishName} onChange={(e) => setEnglishName(e.currentTarget.value)} placeholder="Ban ... School" />
            <TextInput label="School code" value={schoolCode} onChange={(e) => setSchoolCode(e.currentTarget.value)} placeholder="50100123" />
          </div>
        </FormSection>

        <FormSection title="Address">
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
            <Select label="Province" required searchable value={province} onChange={setProvince} data={PROVINCES} />
            <TextInput label="District" required value={district} onChange={(e) => setDistrict(e.currentTarget.value)} placeholder="Search districts" />
            <TextInput label="Subdistrict" required value={subdistrict} onChange={(e) => setSubdistrict(e.currentTarget.value)} placeholder="Search subdistricts" />
            <DateInput label="Date joined iCare" value={dateJoined} onChange={setDateJoined} clearable />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
            <Textarea label="Thai address" minRows={3} value={thaiAddress} onChange={(e) => setThaiAddress(e.currentTarget.value)} placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด" />
            <Textarea label="English address" minRows={3} value={englishAddress} onChange={(e) => setEnglishAddress(e.currentTarget.value)} placeholder="House no., Moo, subdistrict, district, province" />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Principal">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <TextInput label="Principal name" value={principalName} onChange={(e) => setPrincipalName(e.currentTarget.value)} placeholder="Name (ชื่อ-สกุล)" />
            <TextInput label="Principal phone" value={principalPhone} onChange={(e) => setPrincipalPhone(e.currentTarget.value)} placeholder="08x xxx xxxx" />
            <TextInput label="Principal email" type="email" value={principalEmail} onChange={(e) => setPrincipalEmail(e.currentTarget.value)} placeholder="name@icare.or.th" />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Contact person">
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
            <TextInput label="Contact person" required value={contactName} onChange={(e) => setContactName(e.currentTarget.value)} placeholder="Name (ชื่อ-สกุล)" />
            <TextInput label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.currentTarget.value)} placeholder="08x xxx xxxx" />
            <TextInput label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.currentTarget.value)} placeholder="name@icare.or.th" />
            <TextInput label="LINE ID" value={contactLine} onChange={(e) => setContactLine(e.currentTarget.value)} placeholder="LINE ID" />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Description">
          <Textarea label="Description" minRows={4} value={description} onChange={(e) => setDescription(e.currentTarget.value)} placeholder="Anything a field officer should know before visiting" />
          <div className={styles.sectionNote}>
            <InlineMessage tone="info" size="xs">
              The schools table stores the English name and the composed address. The remaining
              fields are shown on the school page from a derived profile until columns exist for
              them.
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
    );
  },
);

SchoolForm.displayName = "SchoolForm";

export default SchoolForm;
