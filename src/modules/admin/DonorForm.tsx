// src/modules/admin/DonorForm.tsx
//
// The fields of a donor, in the side panel students and teachers already use.
//
// It opens on one question, individual or organisation, and reshapes around
// the answer. An organisation is a name that isn't a person, so it also asks
// who reports should be addressed to. Country comes before phone so the phone
// field already knows the dialling code.
//
// Like the teacher form, the fields and the save live here and the action bar
// belongs to whoever holds the form: the drawer pins it to the foot and submits
// through the handle.

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { SegmentedControl, Select, SimpleGrid, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  CountrySelect,
  FieldLabel,
  FormBody,
  FormError,
  FormSection,
  InlineMessage,
  LoadingState,
  PhoneInput,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  phoneMessage,
  phoneProblem,
  type FieldErrors,
} from "../../design-system";
import type { EntityFormHandle, EntityFormOwnerProps } from "./entityForm";
import {
  DONOR_FIELDS_PENDING_NOTE,
  DONOR_FIELD_ORDER,
  EMPTY_DONOR_DETAILS,
  createDonor,
  donorColumnsAvailable,
  duplicateMessage,
  findDonorByEmail,
  phoneCountryFor,
  updateDonor,
  validateDonorDetails,
  type DonorDetailsInput,
  type DonorField,
  type DonorLanguage,
  type DonorType,
  type DuplicateDonor,
} from "./donorRecord";

/** Namespaces this form's field ids, for focus-to-first-error. */
const FORM_ID = "donor-form";
const TYPE_LABEL_ID = `${FORM_ID}-type-label`;

const DONOR_TYPES: { value: DonorType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "organisation", label: "Organisation" },
];

const LANGUAGES: { value: DonorLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "th", label: "Thai" },
];

export interface CreatedDonor {
  id: string;
  name: string;
  /** False when donor type, contact person and country had to be left out. */
  extended: boolean;
}

export interface DonorFormProps extends EntityFormOwnerProps {
  /** Set when editing an existing donor; absent when adding one. */
  donorId?: string | null;
  /** The stored values to start from when editing. */
  initial?: DonorDetailsInput;
  onCreated?: (donor: CreatedDonor) => void;
  onUpdated?: (donor: CreatedDonor) => void;
}

export const DonorForm = forwardRef<EntityFormHandle, DonorFormProps>(
  ({ donorId = null, initial, onCreated, onUpdated, onSavingChange, onErrorChange, onDirtyChange }, ref) => {
    const isNew = !donorId;
    const [details, setDetails] = useState<DonorDetailsInput>(initial ?? EMPTY_DONOR_DETAILS);
    const [agents, setAgents] = useState<{ value: string; label: string }[]>([]);
    /** Null while the probe is in flight: the fields stay visible until we know. */
    const [extended, setExtended] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors<DonorField>>({});
    /** The donor already on this email, when the email error is about that. */
    const [duplicate, setDuplicate] = useState<DuplicateDonor | null>(null);

    const errorRef = useRef<HTMLDivElement>(null);
    const hasColumns = extended !== false;
    const isOrganisation = hasColumns && details.donorType === "organisation";
    const phoneCountry = phoneCountryFor(details, hasColumns);

    useEffect(() => {
      void (async () => {
        const [available, agentRead] = await Promise.all([
          donorColumnsAvailable(),
          supabase.from("agents").select("id, name").order("name", { ascending: true }),
        ]);
        setExtended(available);
        if (agentRead.error) {
          console.error("Error loading agents", agentRead.error);
        } else {
          setAgents((agentRead.data ?? []).map((agent: any) => ({ value: agent.id, label: agent.name })));
        }
      })();
    }, []);

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

    const clearFieldError = (key: DonorField) =>
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });

    /** A field stops being wrong the moment it is edited. */
    const set = <K extends keyof DonorDetailsInput>(key: K, value: DonorDetailsInput[K]) => {
      if (key === "name" || key === "contactPerson" || key === "phone") clearFieldError(key);
      if (key === "email") {
        clearFieldError("email");
        setDuplicate(null);
      }
      setDetails((current) => ({ ...current, [key]: value }));
    };

    /**
     * A country change re-checks a number already typed, rather than rewriting
     * it. The admin sees whether it still fits and decides.
     */
    const setCountry = (country: string | null) => {
      setDetails((current) => ({ ...current, country }));
      setFieldErrors((current) => {
        const next = { ...current };
        const problem = details.phone.trim() ? phoneProblem(details.phone, country) : null;
        if (problem) next.phone = phoneMessage(problem, country) ?? undefined;
        else delete next.phone;
        return next;
      });
    };

    /** Looks for another donor on this address as soon as the field is left. */
    const checkDuplicate = async () => {
      // Editing never flags the donor's own address as a duplicate of itself.
      const found = await findDonorByEmail(details.email, donorId);
      setDuplicate(found);
      setFieldErrors((current) => {
        if (found) return { ...current, email: duplicateMessage(found) };
        // Only clear an error this check put there; a format error stays.
        if (current.email?.startsWith("Another donor already uses this email")) {
          const next = { ...current };
          delete next.email;
          return next;
        }
        return current;
      });
    };

    // Dirty is measured against what the form opened with, so typing something
    // and deleting it again correctly counts as clean.
    const currentValues = JSON.stringify(details);
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

      const problems = validateDonorDetails(details, { extended: hasColumns, isNew });

      // The duplicate check runs again at save: the field may never have been
      // left, and a blur check can be overtaken by further typing.
      if (!problems.email) {
        const found = await findDonorByEmail(details.email, donorId);
        setDuplicate(found);
        if (found) problems.email = duplicateMessage(found);
      }

      setFieldErrors(problems);
      if (hasErrors(problems)) {
        // The count by the button, the sentences on the fields, and the cursor
        // in the first one, so fixing four fields is one pass, not four.
        reportError(errorSummary(problems));
        focusField(FORM_ID, firstError(problems, DONOR_FIELD_ORDER));
        return;
      }

      setBusy(true);
      try {
        const result = donorId
          ? await updateDonor(donorId, details, hasColumns)
          : await createDonor(details, hasColumns);
        if (result.error || !result.id) {
          reportError(
            result.error ??
              (isNew
                ? "We couldn't create this donor. Check the details above and try again."
                : "We couldn't save these changes. Check the details above and try again."),
          );
          return;
        }
        const saved = { id: result.id, name: details.name.trim(), extended: result.extended };
        if (isNew) onCreated?.(saved);
        else onUpdated?.(saved);
      } finally {
        setBusy(false);
      }
    };

    useImperativeHandle(ref, () => ({ submit: () => void save() }), [details, extended, donorId]);

    /** id + error together, so no field can be marked without being reachable. */
    const field = (key: DonorField) => ({ id: fieldId(FORM_ID, key), error: fieldErrors[key] });

    const emailError =
      fieldErrors.email && duplicate ? (
        <>
          {fieldErrors.email}{" "}
          {/* A new tab, so following the link doesn't throw away this form. */}
          <Link to={`/admin/donors/${duplicate.id}`} target="_blank" rel="noopener">
            Open {duplicate.name?.trim() || "that donor"} in a new tab
          </Link>
        </>
      ) : (
        fieldErrors.email
      );

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

        {extended === false && <InlineMessage tone="warning">{DONOR_FIELDS_PENDING_NOTE}</InlineMessage>}

        <FormSection title="Donor">
          {hasColumns && (
            <div role="radiogroup" aria-labelledby={TYPE_LABEL_ID} style={{ marginBottom: "var(--sp-5)" }}>
              <div id={TYPE_LABEL_ID}>
                <FieldLabel>Donor type</FieldLabel>
              </div>
              <SegmentedControl
                fullWidth
                value={details.donorType}
                onChange={(value) => set("donorType", value as DonorType)}
                data={DONOR_TYPES}
              />
            </div>
          )}

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <TextInput
              label={isOrganisation ? "Organisation name" : "Name"}
              {...field("name")}
              required
              placeholder={isOrganisation ? "e.g. Acme Foundation" : "e.g. Jane Doe"}
              value={details.name}
              onChange={(event) => set("name", event.currentTarget.value)}
            />
            {/* Hidden, not cleared, when switching back to Individual: a
                mis-click on the type shouldn't cost what was typed. */}
            {isOrganisation && (
              <TextInput
                label="Contact person"
                {...field("contactPerson")}
                required
                placeholder="The person reports are addressed to"
                value={details.contactPerson}
                onChange={(event) => set("contactPerson", event.currentTarget.value)}
              />
            )}
            <Select
              label="Agent"
              placeholder="No agent"
              data={agents}
              value={details.agentId}
              onChange={(value) => set("agentId", value)}
              searchable
              clearable
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Contact">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <div>
              <TextInput
                label="Email"
                id={fieldId(FORM_ID, "email")}
                error={emailError}
                required={isNew}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={details.email}
                onChange={(event) => set("email", event.currentTarget.value)}
                onBlur={() => void checkDuplicate()}
              />
              {/* An existing donor saved without an email can still be saved
                  (decided 2026-09-11), but the admin is told what it costs. */}
              {!isNew && !details.email.trim() && !fieldErrors.email && (
                <InlineMessage tone="warning" size="xs">
                  No email, so reports can't be sent to this donor.
                </InlineMessage>
              )}
            </div>
            {hasColumns && (
              <CountrySelect id={fieldId(FORM_ID, "country")} value={details.country} onChange={setCountry} />
            )}
            <PhoneInput
              id={fieldId(FORM_ID, "phone")}
              value={details.phone}
              country={phoneCountry}
              onChange={(value) => set("phone", value)}
              error={fieldErrors.phone}
            />
            <TextInput
              label="Other contact (LINE, WhatsApp, etc.)"
              value={details.otherContact}
              onChange={(event) => set("otherContact", event.currentTarget.value)}
            />
            <Textarea
              label="Address"
              minRows={2}
              autosize
              value={details.address}
              onChange={(event) => set("address", event.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Preferences">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Select
              label="Preferred language"
              data={LANGUAGES}
              value={details.preferredLanguage}
              onChange={(value) => set("preferredLanguage", (value ?? "en") as DonorLanguage)}
              allowDeselect={false}
            />
            <Stack gap="sm" justify="center">
              <Switch
                label="Send report emails"
                checked={details.wantsEmailUpdates}
                onChange={(event) => set("wantsEmailUpdates", event.currentTarget.checked)}
              />
              <Switch
                label="Newsletter"
                checked={details.wantsNewsletter}
                onChange={(event) => set("wantsNewsletter", event.currentTarget.checked)}
              />
            </Stack>
          </SimpleGrid>
        </FormSection>

        <FormSection title="Internal note">
          <Textarea
            label="Internal note"
            minRows={3}
            autosize
            placeholder="Only admins see this."
            value={details.noteInternal}
            onChange={(event) => set("noteInternal", event.currentTarget.value)}
          />
        </FormSection>
      </FormBody>
    );
  },
);

DonorForm.displayName = "DonorForm";

export default DonorForm;
