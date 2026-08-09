// src/modules/admin/AdminCreateDonorPage.tsx
import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { LoadingState, PageHeader } from "../../design-system";

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
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

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

  const checkEmail = async (val: string) => {
    if (!val) {
      setEmailWarning(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", val.trim())
      .maybeSingle();
    if (data) {
      setEmailWarning(
        "This email is already associated with a user account. The donor will be automatically linked."
      );
    } else {
      setEmailWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Stack>
      <PageHeader
        title="New donor"
        actions={
          <Button size="xs" variant="subtle" onClick={() => navigate(-1)}>
              Back
            </Button>
        }
      />

      <Card withBorder component="form" onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            All fields are optional. Leave everything empty for a fully
            anonymous donor. You can still link scholarships and students later.
          </Text>

          <TextInput
            label="Name"
            placeholder="e.g., Jane Doe or Company XYZ"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          <Textarea
            label="Address"
            minRows={2}
            value={address}
            onChange={(e) => setAddress(e.currentTarget.value)}
          />

          <Group grow align="flex-start">
            <Stack gap={0}>
              <TextInput
                label="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.currentTarget.value);
                  setEmailWarning(null);
                }}
                onBlur={() => checkEmail(email)}
                placeholder="name@example.com"
              />
              {emailWarning && (
                <Text size="xs" c="orange" mt={4}>
                  {emailWarning}
                </Text>
              )}
            </Stack>
            <TextInput
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder="+66…"
            />
          </Group>

          <TextInput
            label="Other contact (Line, WhatsApp, etc.)"
            value={otherContact}
            onChange={(e) => setOtherContact(e.currentTarget.value)}
          />

          <Select
            label="Agent"
            placeholder="No agent"
            data={agents}
            value={agentId}
            onChange={(value) => setAgentId(value)}
            clearable
          />

          {/* Dashboard & communication – same as edit page semantics */}
          <Text fw={600} mt="md">
            Dashboard & communication
          </Text>
          <Stack gap={4}>
            
            <Switch
              label="Wants email updates"
              checked={wantsEmailUpdates}
              onChange={(e) =>
                setWantsEmailUpdates(e.currentTarget.checked)
              }
            />
            <Switch
              label="Wants newsletter"
              checked={wantsNewsletter}
              onChange={(e) =>
                setWantsNewsletter(e.currentTarget.checked)
              }
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

          <Text fw={600} mt="md">
            Internal notes
          </Text>
          <Textarea
            label="Internal note (not visible to donor)"
            minRows={2}
            value={noteInternal}
            onChange={(e) => setNoteInternal(e.currentTarget.value)}
            placeholder="Visible only to admins (e.g., payment details, preferences)."
          />

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button type="submit" loading={saving}>
              Save donor
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};
