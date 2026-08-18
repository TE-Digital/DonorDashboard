import React, { useEffect, useState } from "react";
import { Button, SimpleGrid, TextInput, Textarea } from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
import {
  FormBody,
  FormError,
  FormFooter,
  FormPage,
  FormSection,
  InlineMessage,
  LoadingState,
} from "../../design-system";

export const AdminEditSchoolPage: React.FC = () => {
  const navigate = useNavigate();
  const { schoolId } = useParams<{ schoolId: string }>();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!schoolId) {
      setError("Missing school id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("schools")
      .select("id, name, address")
      .eq("id", schoolId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error loading school", fetchError);
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setError("School not found.");
      setLoading(false);
      return;
    }

    setName(data.name ?? "");
    setAddress(data.address ?? "");
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("School name is required.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("schools")
      .update({
        name: trimmedName,
        address: address.trim() || null,
      })
      .eq("id", schoolId);

    if (updateError) {
      console.error("Error updating school", updateError);
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage("School updated successfully.");
    setSaving(false);
  };

  return (
    <FormPage
      title="Edit school"
      subtitle="Update the school details."
      steps={["School details", "Teachers", "Students", "Assignments"]}
      activeStep={0}
    >
      <LoadingState variant="overlay" visible={loading || saving} />
      <FormError>{error}</FormError>
      {message && <InlineMessage tone="success">{message}</InlineMessage>}

      {!loading && (
        <FormBody onSubmit={handleSubmit}>
          <FormSection title="School details" hint="Name and postal address on record">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <TextInput
                label="School name"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              <Textarea
                label="Address"
                minRows={3}
                autosize
                value={address}
                onChange={(e) => setAddress(e.currentTarget.value)}
              />
            </SimpleGrid>
          </FormSection>

          <FormFooter
            left={
              <Button variant="subtle" type="button" onClick={() => navigate("/admin/schools")}>
                Back to list
              </Button>
            }
          >
            <Button type="submit">Save changes</Button>
          </FormFooter>
        </FormBody>
      )}
    </FormPage>
  );
};

export default AdminEditSchoolPage;

