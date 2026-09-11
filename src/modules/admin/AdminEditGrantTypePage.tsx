import React, { useEffect, useState } from "react";
import { Button, NumberInput, Select, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { toFriendlyError } from "../../i18n/errors";
import {
  FormBody,
  FormError,
  FormFooter,
  FormPage,
  FormSection,
  LoadingState,
  CURRENCY,
  currencyOptionsFor,
  fieldId,
  focusField,
} from "../../design-system";

/** Namespaces this form's field ids. */
const FORM_ID = "grant-type-edit";

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
  const [nameError, setNameError] = useState<string | undefined>();

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
      setError("We couldn't tell which grant type to open. Go back to the list and choose one.");
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
      } catch (err: unknown) {
        setError(toFriendlyError(err, "errors.load"));
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
      // On the field, not only in the banner: one input, but the same rule as
      // every other form in the product.
      setNameError("Give this grant type a name.");
      setError("One thing needs attention before this can be saved.");
      focusField(FORM_ID, "name");
      return;
    }
    setNameError(undefined);

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
        setError(toFriendlyError(updateError, "errors.save"));
        setSaving(false);
        return;
      }

      navigate("/admin/grant-types", { replace: true });
    } catch (err: unknown) {
      setError(toFriendlyError(err, "errors.save"));
      setSaving(false);
    }
  };

  if (initialLoading) {
    return <LoadingState />;
  }

  if (error && !initialLoading) {
    return (
      <FormPage title="Edit grant type">
        <FormError>{error}</FormError>
        <FormFooter>
          <Button variant="subtle" onClick={() => navigate("/admin/grant-types")}>
            Back to list
          </Button>
        </FormFooter>
      </FormPage>
    );
  }

  return (
    <FormPage title="Edit grant type" subtitle="The template a scholarship is issued from.">
      <FormBody onSubmit={handleSubmit}>
        <FormError>{error}</FormError>

        <FormSection title="Grant type">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <TextInput
              label="Name"
              id={fieldId(FORM_ID, "name")}
              error={nameError}
              placeholder='"KG to Grade 9", "Grade 10 to 12", "University full scholarship"'
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />
            <Textarea
              label="Description"
              placeholder="Short explanation, conditions, scope…"
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Amount and duration">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <NumberInput
              label="Standard scholarship amount"
              placeholder="6000, 8400 or 160000"
              value={amountPerPeriod}
              onChange={(val) => setAmountPerPeriod(typeof val === "number" ? val : undefined)}
              min={0}
            />
            <Select
              label="Currency"
              data={currencyOptionsFor(currency)}
              allowDeselect={false}
              value={currency}
              onChange={(value: string | null) => setCurrency(value ?? CURRENCY)}
            />
            <NumberInput
              label="Default duration (months)"
              placeholder="3, 12, 16, or 48 for full university"
              value={defaultDurationMonths}
              onChange={(val) => setDefaultDurationMonths(typeof val === "number" ? val : undefined)}
              min={1}
            />
          </SimpleGrid>
        </FormSection>

        <FormFooter
          left={
            <Button
              variant="subtle"
              type="button"
              disabled={saving}
              onClick={() => navigate("/admin/grant-types")}
            >
              Cancel
            </Button>
          }
        >
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </FormFooter>
      </FormBody>
    </FormPage>
  );
};
