// src/modules/admin/AdminCreateDonorPage.tsx
import React, { useEffect, useState } from "react";
import { Button, SimpleGrid, Select, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  FormBody,
  FormError,
  FormFooter,
  FormPage,
  FormSection,
  LoadingState,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  isEmail,
  isPhone,
  type FieldErrors,
} from "../../design-system";

/** Namespaces this form's field ids. */
const FORM_ID = "donor-new";

type DonorField = "name" | "email" | "phone";
const DONOR_FIELD_ORDER: readonly DonorField[] = ["name", "email", "phone"];

type AgentOption = { value: string; label: string };

export const AdminCreateDonorPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form fields (all optional)
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otherContact, setOtherContact] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);

  // new donor flags
  const [isDashboardEnabled, setIsDashboardEnabled] = useState(true);
  const [wantsEmailUpdates, setWantsEmailUpdates] = useState(true);
  const [wantsNewsletter, setWantsNewsletter] = useState(false);
  const [preferredLanguage, setPreferredLanguage] =
    useState<string | null>("en");
  const [noteInternal, setNoteInternal] = useState("");

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<DonorField>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      // agents
      const { data: agentRows, error: agentError } = await supabase
        .from("agents")
        .select("id, name")
        .order("name", { ascending: true });

      if (agentError) {
        console.error("Error loading agents", agentError);
      } else {
        setAgents(
          (agentRows ?? []).map((a: any) => ({
            value: a.id,
            label: a.name,
          }))
        );
      }

      setLoading(false);
    };

    load();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // A donor with no name is a row nobody can find again, and the form used to
    // accept one: there was no client-side validation on this screen at all.
    const problems: FieldErrors<DonorField> = {};
    if (!name.trim()) problems.name = "A donor needs a name — a person or an organisation.";
    if (email.trim() && !isEmail(email)) {
      problems.email = "Enter a complete email address, for example name@example.com.";
    }
    if (phone.trim() && !isPhone(phone)) {
      problems.phone = "Enter a Thai phone number, for example 081 234 5678.";
    }
    setFieldErrors(problems);

    if (hasErrors(problems)) {
      setError(errorSummary(problems));
      focusField(FORM_ID, firstError(problems, DONOR_FIELD_ORDER));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const contact: any = {
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        other_contact: otherContact.trim() || null,
        agent_id: agentId || null,
      };

      const payload: any = {
        name: name.trim() || null,
        contact,
        is_dashboard_enabled: isDashboardEnabled,
        wants_email_updates: wantsEmailUpdates,
        wants_newsletter: wantsNewsletter,
        preferred_language: preferredLanguage,
        note_internal: noteInternal.trim() || null,
      };

const { data: inserted, error: insertError } = await supabase
  .from("donors")
  .insert(payload)
  .select()
  .single();


      if (insertError) {
        console.error("Error creating donor", insertError);
        setError(insertError.message);
        setSaving(false);
        return;
      }

      navigate(`/admin/donors/${inserted.id}/edit`, { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Unexpected error while creating donor.");
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <FormPage
      title="New donor"
      subtitle="All fields are optional. Leave everything empty for a fully anonymous donor — scholarships and students can still be linked later."
    >
      <FormBody onSubmit={handleSubmit}>
        <FormError>{error}</FormError>

        <FormSection title="Donor">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <TextInput
              label="Name"
              id={fieldId(FORM_ID, "name")}
              error={fieldErrors.name}
              required
              placeholder="e.g., Jane Doe or Company XYZ"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Select
              label="Agent"
              placeholder="No agent"
              data={agents}
              value={agentId}
              onChange={(value) => setAgentId(value)}
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
                error={fieldErrors.email}
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="name@example.com"
              />
            </div>
            <TextInput
              label="Phone"
              id={fieldId(FORM_ID, "phone")}
              error={fieldErrors.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder="+66…"
            />
            <TextInput
              label="Other contact (Line, WhatsApp, etc.)"
              value={otherContact}
              onChange={(e) => setOtherContact(e.currentTarget.value)}
            />
            <Textarea
              label="Address"
              minRows={2}
              value={address}
              onChange={(e) => setAddress(e.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Dashboard & communication">
          <Stack gap="md">
            <Switch
              label="Wants email updates"
              checked={wantsEmailUpdates}
              onChange={(e) => setWantsEmailUpdates(e.currentTarget.checked)}
            />
            <Switch
              label="Wants newsletter"
              checked={wantsNewsletter}
              onChange={(e) => setWantsNewsletter(e.currentTarget.checked)}
            />
            <Select
              label="Preferred language"
              data={[
                { value: "en", label: "English" },
                { value: "th", label: "Thai" },
              ]}
              value={preferredLanguage}
              onChange={(v) => setPreferredLanguage(v || "en")}
            />
          </Stack>
        </FormSection>

        <FormSection title="Internal notes">
          <Textarea
            label="Internal note"
            minRows={3}
            value={noteInternal}
            onChange={(e) => setNoteInternal(e.currentTarget.value)}
            placeholder="Visible only to admins (e.g., payment details, preferences)."
          />
        </FormSection>

        <FormFooter
          left={
            <Button variant="subtle" type="button" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          }
        >
          <Button type="submit" loading={saving}>
            Save donor
          </Button>
        </FormFooter>
      </FormBody>
    </FormPage>
  );
};
