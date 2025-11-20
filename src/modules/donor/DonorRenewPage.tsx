// src/modules/donor/DonorRenewPage.tsx
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import { IconInfoCircle, IconCheck } from "@tabler/icons-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";

type GrantTypeOption = { value: string; label: string };

export const DonorRenewPage: React.FC = () => {
  const { profile, role } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [grantTypeId, setGrantTypeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [grantTypes, setGrantTypes] = useState<GrantTypeOption[]>([]);
  const [loadingGrantTypes, setLoadingGrantTypes] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Prefill name/email when logged in
  useEffect(() => {
    if (profile) {
      if (!name) setName(profile.full_name ?? "");
      if (!email) setEmail(profile.email ?? "");
    }
  }, [profile, name, email]);

  // Load grant types for the optional dropdown
  useEffect(() => {
    const loadGrantTypes = async () => {
      setLoadingGrantTypes(true);
      try {
        const { data, error } = await supabase
          .from("grant_types")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) {
          console.error("Error loading grant types", error);
          setGrantTypes([]);
          return;
        }

        setGrantTypes(
          (data ?? []).map((g: any) => ({
            value: g.id as string,
            label: (g.name as string) || "(no name)",
          }))
        );
      } finally {
        setLoadingGrantTypes(false);
      }
    };

    loadGrantTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setError("Please fill in name, email, and your message.");
      setSubmitting(false);
      return;
    }

    try {
      const { error: fnError } = await supabase.functions.invoke(
        "donor-renew-request",
        {
          body: {
            name: trimmedName,
            email: trimmedEmail,
            grantTypeId,
            message: trimmedMessage,
          },
        }
      );

      if (fnError) {
        console.error("donor-renew-request error", fnError);
        setError(fnError.message ?? "Could not send your request.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setMessage(""); // keep name/email, just clear message
    } catch (err: any) {
      console.error("Unexpected error sending renew request", err);
      setError(
        err.message ?? "Unexpected error while sending your request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: "0 16px",
      }}
    >
      <Card
        withBorder
        shadow="sm"
        radius="md"
        component="form"
        onSubmit={handleSubmit}
      >
        <Stack gap="md">
          <Text fw={700} size="lg">
            Contact us about renewing your support
          </Text>
          <Text size="sm" c="dimmed">
            This form is intended for existing donors who already support one or
            more students and would like to continue, adjust, or discuss their
            scholarship.
          </Text>

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              color="green"
              variant="light"
              icon={<IconCheck size={16} />}
            >
              Thank you! Your message has been sent. We will contact you soon.
            </Alert>
          )}

          <TextInput
            label="Your name"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          <TextInput
            label="Your email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />

          <Group align="flex-end" gap="xs">
            <Select
              style={{ flex: 1 }}
              label={
                <Group gap={4}>
                  <Text size="sm">
                    Preferred grant type (optional)
                  </Text>
                  <Tooltip
                    label="If you already have a preferred scholarship or grant type for the renewal, you can select it here. Otherwise, leave this empty."
                    withArrow
                    multiline
                    maw={260}
                  >
                    <ActionIcon size="sm" variant="subtle">
                      <IconInfoCircle size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              }
              placeholder="No preference"
              data={grantTypes}
              value={grantTypeId}
              onChange={setGrantTypeId}
              clearable
              disabled={loadingGrantTypes}
            />
          </Group>

          <Textarea
            label="Your message"
            required
            minRows={4}
            autosize
            placeholder="For example: how long you would like to continue, any change in amount, or questions you might have."
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button type="submit" loading={submitting}>
              Send request
            </Button>
          </Group>
        </Stack>
      </Card>
    </div>
  );
};

export default DonorRenewPage;
