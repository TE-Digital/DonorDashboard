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
import { ThailandAddressAutocomplete } from "../../components/ThailandAddressAutocomplete";
import {
  DEFAULT_REPORTING_PERIOD_MONTHS,
  DORMITORY_OPTIONS,
  GRADES,
  PROVINCES,
  REPORTING_PERIODS,
  SCHOOL_SYSTEMS,
} from "./schoolProfile";
import { isMissingColumnError } from "./teacherProfile";
import {
  dateProblem,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  isEmail,
  isPhone,
  today,
  type FieldErrors,
} from "../../design-system/fieldValidation";
import { writeFailureMessage, type EntityFormHandle, type EntityFormOwnerProps } from "./entityForm";
import styles from "./AdminDirectory.module.scss";

/** Namespaces this form's field ids — it renders as a route and a drawer step. */
const CONTACT_CHANNEL_REQUIRED =
  "Give at least one way to reach this person: a phone number, an email address or a LINE ID.";

const FORM_ID = "school-form";

/** Every field this form can mark, in the order it asks for them. */
const SCHOOL_FIELD_ORDER = [
  "gradeTo",
  "thaiName",
  "englishName",
  "province",
  "district",
  "subdistrict",
  "dateJoined",
  "principalPhone",
  "principalEmail",
  "contactName",
  "contactPhone",
  "contactEmail",
] as const;

type SchoolField = (typeof SCHOOL_FIELD_ORDER)[number];

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
    /** What the last save attempt found wrong, per field. */
    const [fieldErrors, setFieldErrors] = useState<FieldErrors<SchoolField>>({});

    /** id + error together, so no field can be marked without being reachable. */
    const field = (key: SchoolField) => ({ id: fieldId(FORM_ID, key), error: fieldErrors[key] });

    /**
     * Dropped when any of the three channels is filled, not only the phone.
     *
     * The message is anchored to contactPhone because a form error has to sit
     * on a field, but it is about all three — so typing an email has to clear
     * it, while leaving a genuine "that is not a phone number" alone.
     */
    const clearChannelError = () =>
      setFieldErrors((current) =>
        current.contactPhone === CONTACT_CHANNEL_REQUIRED
          ? (({ contactPhone: _drop, ...rest }) => rest)(current)
          : current,
      );

    /** A field stops being wrong the moment it is edited. */
    const clear = (key: SchoolField) =>
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });

    /** Set a text field and drop its error in one call. */
    const edit =
      (key: SchoolField, setValue: (value: string) => void) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        clear(key);
        setValue(event.currentTarget.value);
      };

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

      // Extract current DOM values as fallback in case Browser Autofill populated inputs without triggering React's onChange
      const getVal = (key: SchoolField, stateVal: string) => {
        const domVal = (document.getElementById(fieldId(FORM_ID, key)) as HTMLInputElement)?.value;
        return (stateVal || domVal || "").trim();
      };

      const cPhone = getVal("contactPhone", contactPhone);
      const cEmail = getVal("contactEmail", contactEmail);
      const lineDom = (document.getElementById(fieldId(FORM_ID, "contactLine")) as HTMLInputElement)?.value;
      const cLine = (contactLine || lineDom || "").trim();

      // Sync state back if DOM had autofilled values
      if (!contactPhone && cPhone) setContactPhone(cPhone);
      if (!contactEmail && cEmail) setContactEmail(cEmail);
      if (!contactLine && cLine) setContactLine(cLine);

      const problems: FieldErrors<SchoolField> = {};

      if (!getVal("thaiName", thaiName)) problems.thaiName = "The Thai school name is required.";
      if (!getVal("englishName", englishName)) problems.englishName = "The English school name is required.";

      if (!province) problems.province = "Select a province.";
      if (!getVal("district", district)) problems.district = "The district is required.";
      if (!getVal("subdistrict", subdistrict)) problems.subdistrict = "The subdistrict is required.";

      // "P6 to K1" is not a range. The two selects cannot know about each
      // other, so the pair is checked here.
      if (gradeFrom && gradeTo && GRADES.indexOf(gradeTo) < GRADES.indexOf(gradeFrom)) {
        problems.gradeTo = `The last grade cannot come before ${gradeFrom}.`;
      }

      if (dateProblem(dateJoined ? dateJoined.toISOString() : null) === "future") {
        problems.dateJoined = "A school cannot have joined on a date that has not happened.";
      }

      if (!getVal("contactName", contactName)) {
        problems.contactName = "A contact person is required for school coordination.";
      }

      // A name with no channel is not a contact. Which channel is theirs to
      // choose — LINE, a phone, an address — but there has to be one, or the
      // field officer arriving in the province has nobody to ring.
      if (!cPhone && !cEmail && !cLine) {
        problems.contactPhone = CONTACT_CHANNEL_REQUIRED;
      }

      if (cPhone && !isPhone(cPhone)) {
        problems.contactPhone = "Enter a Thai phone number, for example 081 234 5678.";
      }
      if (cEmail && !isEmail(cEmail)) {
        problems.contactEmail = "Enter a valid email address, or leave it empty.";
      }
      const pPhone = getVal("principalPhone", principalPhone);
      if (pPhone && !isPhone(pPhone)) {
        problems.principalPhone = "Enter a Thai phone number, or leave it empty.";
      }
      const pEmail = getVal("principalEmail", principalEmail);
      if (pEmail && !isEmail(pEmail)) {
        problems.principalEmail = "Enter a valid email address, or leave it empty.";
      }

      setFieldErrors(problems);

      if (hasErrors(problems)) {
        // The count at the top, the sentences on the fields, and the cursor in
        // the first one — so fixing four empty fields is one pass, not four.
        reportError(errorSummary(problems));
        focusField(FORM_ID, firstError(problems, SCHOOL_FIELD_ORDER));
        return;
      }

      setBusy(true);

      // One address column, so the parts are composed in the order a Thai
      // address reads: street, subdistrict, district, province.
      const location = [subdistrict.trim(), district.trim(), province].filter(Boolean).join(", ");
      const composedAddress = [englishAddress.trim() || thaiAddress.trim(), location]
        .filter(Boolean)
        .join(", ");

      // The Thai name was already required by this form and then dropped on
      // save — collected from a person and discarded, which is the surest way
      // to teach staff that filling forms in carefully does not matter. It has
      // a column now, and this is where it lands.
      const base = {
        name: englishName.trim(),
        name_th: thaiName.trim() || null,
        address: composedAddress || null,
      };

      // Province and district are columns of their own now, as well as part of
      // the composed address. The dashboard ranks provinces by funding gap, and
      // a ranking cannot be built by splitting a free-text address on commas.
      const located = {
        ...base,
        province: province?.trim() || null,
        district: district.trim() || null,
      };

      // Both of the above are real columns, but a database without the
      // migrations should still be able to create a school rather than fail on
      // a field it has never heard of. Widest insert first, narrowing on each
      // missing-column error.
      let { data, error: insertError } = await supabase
        .from("schools")
        .insert({ ...located, reporting_period_months: Number(reportingPeriod) })
        .select("id, name")
        .maybeSingle();

      if (insertError && isMissingColumnError(insertError)) {
        ({ data, error: insertError } = await supabase
          .from("schools")
          .insert(located)
          .select("id, name")
          .maybeSingle());
      }

      if (insertError && isMissingColumnError(insertError)) {
        ({ data, error: insertError } = await supabase
          .from("schools")
          .insert(base)
          .select("id, name")
          .maybeSingle());
      }

      // Last resort: a database without even name_th. Creating the school still
      // has to work, so the Thai name is the thing that gives way rather than
      // the school.
      if (insertError && isMissingColumnError(insertError)) {
        ({ data, error: insertError } = await supabase
          .from("schools")
          .insert({ name: base.name, address: base.address })
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
            <Select label="Grade to" {...field("gradeTo")} value={gradeTo} onChange={(value) => { clear("gradeTo"); setGradeTo(value); }} data={GRADES} allowDeselect={false} />
            <Select label="Dormitory status" value={dormitoryStatus} onChange={setDormitoryStatus} data={DORMITORY_OPTIONS} allowDeselect={false} />
          </div>
          <div className={styles.reportingRow}>
            <Select
              label="Reporting period"
              value={reportingPeriod}
              onChange={(value) => value && setReportingPeriod(value)}
              data={REPORTING_PERIODS}
              allowDeselect={false}
            />
            <p className={styles.fieldHint}>
              How often this school reports on a student. Everyone assigned here inherits it.
            </p>
          </div>
        </FormSection>

        <FormSection title="School names">
          <div className={styles.namesGrid}>
            <TextInput label="Thai school name" required {...field("thaiName")} value={thaiName} onChange={edit("thaiName", setThaiName)} placeholder="โรงเรียน..." />
            <TextInput label="English school name" required {...field("englishName")} value={englishName} onChange={edit("englishName", setEnglishName)} placeholder="Ban ... School" />
            <TextInput label="School code" value={schoolCode} onChange={(e) => setSchoolCode(e.currentTarget.value)} placeholder="50100123" />
          </div>
        </FormSection>

        <FormSection title="Address">
          <ThailandAddressAutocomplete
            onSelectAddress={(item) => {
              clear("province");
              clear("district");
              clear("subdistrict");
              setProvince(item.provinceEng);
              setDistrict(item.district);
              setSubdistrict(item.subdistrict);
              setThaiAddress(`ตำบล${item.subdistrict} อำเภอ${item.district} จังหวัด${item.provinceThai} ${item.zipcode}`);
              setEnglishAddress(`${item.subdistrict} subdistrict, ${item.district} district, ${item.provinceEng} ${item.zipcode}`);
            }}
          />
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
            <Select label="Province" required searchable {...field("province")} value={province} onChange={(value) => { clear("province"); setProvince(value); }} data={PROVINCES} />
            <TextInput label="District" required {...field("district")} value={district} onChange={edit("district", setDistrict)} placeholder="Search districts" />
            <TextInput label="Subdistrict" required {...field("subdistrict")} value={subdistrict} onChange={edit("subdistrict", setSubdistrict)} placeholder="Search subdistricts" />
            <DateInput label="Date joined iCare" {...field("dateJoined")} maxDate={today()} value={dateJoined} onChange={(value) => { clear("dateJoined"); setDateJoined(value); }} clearable />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
            <Textarea label="Thai address" minRows={3} value={thaiAddress} onChange={(e) => setThaiAddress(e.currentTarget.value)} placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด" />
            <Textarea label="English address" minRows={3} value={englishAddress} onChange={(e) => setEnglishAddress(e.currentTarget.value)} placeholder="House no., Moo, subdistrict, district, province" />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Principal">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <TextInput label="Principal name" value={principalName} onChange={(e) => setPrincipalName(e.currentTarget.value)} placeholder="Name (ชื่อ-สกุล)" />
            <TextInput label="Principal phone" type="tel" inputMode="tel" autoComplete="tel" {...field("principalPhone")} value={principalPhone} onChange={edit("principalPhone", setPrincipalPhone)} placeholder="08x xxx xxxx" />
            <TextInput label="Principal email" inputMode="email" autoComplete="email" type="email" {...field("principalEmail")} value={principalEmail} onChange={edit("principalEmail", setPrincipalEmail)} placeholder="name@icare.or.th" />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Contact person">
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
            <TextInput label="Contact person" required {...field("contactName")} value={contactName} onChange={edit("contactName", setContactName)} placeholder="Name (ชื่อ-สกุล)" />
            <TextInput label="Contact phone" type="tel" inputMode="tel" autoComplete="tel" {...field("contactPhone")} value={contactPhone} onChange={(e) => { clearChannelError(); edit("contactPhone", setContactPhone)(e); }} placeholder="08x xxx xxxx" />
            <TextInput label="Contact email" inputMode="email" autoComplete="email" type="email" {...field("contactEmail")} value={contactEmail} onChange={(e) => { clearChannelError(); edit("contactEmail", setContactEmail)(e); }} placeholder="name@icare.or.th" />
            <TextInput label="LINE ID" id={fieldId(FORM_ID, "contactLine")} value={contactLine} onChange={(e) => { clearChannelError(); setContactLine(e.currentTarget.value); }} placeholder="LINE ID" />
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
