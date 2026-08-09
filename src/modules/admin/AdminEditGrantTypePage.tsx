import React, { useEffect, useState } from "react";
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
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { LoadingState, PageHeader } from "../../design-system";

type GrantType = {
  id: string;
  name: string;
  description: string | null;
  amount_per_period: number | null;
  currency: string;
  default_duration_months: number | null;
};

export const AdminEditGrantTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amountPerPeriod, setAmountPerPeriod] = useState<number | undefined>();
  const [currency, setCurrency] = useState<string>("THB");
  const [defaultDurationMonths, setDefaultDurationMonths] = useState<
    number | undefined
  >();

  // Load existing data
  useEffect(() => {
    if (!id) {
      setError("Grant Type ID is missing.");
      setInitialLoading(false);
      return;
    }

    const loadData = async () => {
      setInitialLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("grant_types")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Grant type not found.");

        const gt = data as GrantType;

        setName(gt.name);
        setDescription(gt.description ?? "");
        setAmountPerPeriod(gt.amount_per_period ?? undefined);
        setCurrency(gt.currency || "THB");
        setDefaultDurationMonths(gt.default_duration_months ?? undefined);
      } catch (err: any) {
        console.error("Error loading grant type", err);
        setError("Could not load grant type details.");
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return; // Should not happen if data loaded

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

      const { error: updateError } = await supabase
        .from("grant_types")
        .update(payload)
        .eq("id", id);

      if (updateError) {
        console.error("Update grant type error", updateError);
        setError(updateError.message);
        setSaving(false);
        return;
      }

      navigate("/admin/grant-types", { replace: true });
    } catch (err: any) {
      console.error("Unexpected error updating grant type", err);
      setError(err.message ?? "Unexpected error while updating grant type.");
      setSaving(false);
    }
  };

  if (initialLoading) {
    return <LoadingState />;
  }

  if (error && !initialLoading) {
    return (
      <Stack>
        <Title order={3}>Edit Grant Type</Title>
        <Text c="red">{error}</Text>
        <Button variant="subtle" onClick={() => navigate("/admin/grant-types")}>
          Back to list
        </Button>
      </Stack>
    );
  }

  return (
    <Stack>
      <PageHeader
        title="Edit grant type"
        actions={
          <Button
              variant="subtle"
              size="xs"
              onClick={() => navigate("/admin/grant-types")}
            >
              Back to list
            </Button>
        }
      />

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
              onClick={() => navigate("/admin/grant-types")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};