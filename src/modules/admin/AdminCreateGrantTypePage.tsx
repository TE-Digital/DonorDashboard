import React, { useState } from "react";
import { Button, NumberInput, Select, SimpleGrid, Textarea, TextInput } from "@mantine/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { toFriendlyError } from "../../i18n/errors";
import {
  FormBody,
  FormError,
  FormFooter,
  FormPage,
  FormSection,
  CURRENCY,
  currencyOptionsFor,
  fieldId,
  focusField,
} from "../../design-system";

/** Namespaces this form's field ids. */
const FORM_ID = "grant-type-new";

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
  const [nameError, setNameError] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      const { error: insertError } = await supabase
        .from("grant_types")
        .insert(payload);

      if (insertError) {
        setError(toFriendlyError(insertError, "errors.create"));
        setSaving(false);
        return;
      }

      if (returnTo) {
        navigate(returnTo, { replace: true });
      } else {
        navigate("/admin/scholarships", { replace: true });
      }
    } catch (err: unknown) {
      setError(toFriendlyError(err, "errors.create"));
      setSaving(false);
    }
  };

  return (
    <FormPage title="Add grant type" subtitle="The template a scholarship is issued from.">
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
              onClick={() => navigate(returnTo || "/admin/scholarships", { replace: true })}
            >
              Cancel
            </Button>
          }
        >
          <Button type="submit" loading={saving}>
            Save grant type
          </Button>
        </FormFooter>
      </FormBody>
    </FormPage>
  );
};
