import React, { useState } from "react";
import {
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export const AdminCreateGrantTypePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amountPerPeriod, setAmountPerPeriod] = useState<number | undefined>();
  const [currency, setCurrency] = useState<string>("THB");
  const [defaultDurationMonths, setDefaultDurationMonths] = useState<
    number | undefined
  >(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please provide a name for the grant type.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: trimmedName,
        description: description.trim() || null,
        amount_per_period:
          typeof amountPerPeriod === "number" ? amountPerPeriod : null,
        currency: currency || "THB",
        default_duration_months:
          typeof defaultDurationMonths === "number"
            ? defaultDurationMonths
            : null,
      };

      const { error: insertError } = await supabase
        .from("grant_types")
        .insert(payload);

      if (insertError) {
        console.error("Insert grant type error", insertError);
        setError(insertError.message);
        setSaving(false);
        return;
      }

      if (returnTo) {
        navigate(returnTo, { replace: true });
      } else {
        navigate("/admin/scholarships", { replace: true });
      }
    } catch (err: any) {
      console.error("Unexpected error creating grant type", err);
      setError(err.message ?? "Unexpected error while creating grant type.");
      setSaving(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Title order={3}>Add grant type</Title>
        <Button
          variant="subtle"
          size="xs"
          onClick={() =>
            navigate(returnTo || "/admin/scholarships", { replace: true })
          }
        >
          Back
        </Button>
      </Group>

      <Card withBorder component="form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder='e.g. "KG – Grade 9", "Grade 10–12", "University full scholarship"'
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />

          <Textarea
            label="Description (optional)"
            placeholder="Short explanation, conditions, scope…"
            minRows={3}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />

          <Group grow>
            <NumberInput
              label="Standard scholarship amount (for full period)"
              placeholder="e.g. 6000, 8400, 160000"
              value={amountPerPeriod}
              onChange={(val) =>
                setAmountPerPeriod(
                  typeof val === "number" ? val : undefined
                )
              }
              min={0}
            />
            <TextInput
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.currentTarget.value)}
            />
          </Group>

          <NumberInput
            label="Default duration (month)"
            placeholder="e.g. 3, 12, 16, or 48 for full university"
            value={defaultDurationMonths}
            onChange={(val) =>
              setDefaultDurationMonths(
                typeof val === "number" ? val : undefined
              )
            }
            min={1}
          />

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() =>
                navigate(returnTo || "/admin/scholarships", {
                  replace: true,
                })
              }
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save grant type
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};
