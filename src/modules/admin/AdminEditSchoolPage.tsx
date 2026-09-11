import React, { useEffect, useState } from "react";
import { Button, Select, SimpleGrid, TextInput, Textarea } from "@mantine/core";
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
import { PROVINCES } from "./schoolProfile";
import { isMissingColumnError } from "./teacherProfile";
import { toFriendlyError } from "../../i18n/errors";

export const AdminEditSchoolPage: React.FC = () => {
  const navigate = useNavigate();
  const { schoolId } = useParams<{ schoolId: string }>();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  // Province and district are the two fields the dashboard groups and ranks by.
  // They were previously only ever flattened into the address string, which is
  // why nothing could count them.
  const [province, setProvince] = useState<string | null>(null);
  const [district, setDistrict] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!schoolId) {
      setError("We couldn't tell which school to open. Go back to the list and choose one.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let { data, error: fetchError } = await supabase
      .from("schools")
      .select("id, name, address, province, district")
      .eq("id", schoolId)
      .maybeSingle();

    // A deploy that lands ahead of its migration still edits a school.
    if (fetchError && isMissingColumnError(fetchError)) {
      ({ data, error: fetchError } = await supabase
        .from("schools")
        .select("id, name, address")
        .eq("id", schoolId)
        .maybeSingle());
    }

    if (fetchError) {
      setError(toFriendlyError(fetchError, "errors.load"));
      setLoading(false);
      return;
    }
    if (!data) {
      setError("We couldn't find this school. It may have been removed.");
      setLoading(false);
      return;
    }

    setName(data.name ?? "");
    setAddress(data.address ?? "");
    setProvince(((data as { province?: string | null }).province ?? "") || null);
    setDistrict((data as { district?: string | null }).district ?? "");
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
      setError("Add a name for this school.");
      setSaving(false);
      return;
    }

    const base = { name: trimmedName, address: address.trim() || null };

    let { error: updateError } = await supabase
      .from("schools")
      .update({
        ...base,
        province: province?.trim() || null,
        district: district.trim() || null,
      })
      .eq("id", schoolId);

    if (updateError && isMissingColumnError(updateError)) {
      ({ error: updateError } = await supabase
        .from("schools")
        .update(base)
        .eq("id", schoolId));
    }

    if (updateError) {
      setError(toFriendlyError(updateError, "errors.save"));
      setSaving(false);
      return;
    }

    setMessage(`${trimmedName}'s details are saved.`);
    setSaving(false);
  };

  return (
    <FormPage
      title="Edit school"
      steps={["School details", "Teachers", "Students", "Assignments"]}
      activeStep={0}
    >
      <LoadingState variant="overlay" visible={loading || saving} />
      <FormError>{error}</FormError>
      {message && <InlineMessage tone="success">{message}</InlineMessage>}

      {!loading && (
        <FormBody onSubmit={handleSubmit}>
          <FormSection title="School details">
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
              <Select
                label="Province"
                searchable
                clearable
                placeholder="Not recorded"
                data={[...PROVINCES]}
                value={province}
                onChange={setProvince}
              />
              <TextInput
                label="District"
                value={district}
                onChange={(e) => setDistrict(e.currentTarget.value)}
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

