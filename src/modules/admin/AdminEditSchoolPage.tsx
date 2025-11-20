import React, { useEffect, useState } from "react";
import {
  Card,
  Stack,
  Text,
  TextInput,
  Textarea,
  Group,
  Button,
  LoadingOverlay,
} from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, useParams } from "react-router-dom";

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
    <Card withBorder shadow="sm" radius="md" pos="relative" p="lg">
      <LoadingOverlay visible={loading || saving} />

      <Stack gap="lg">
        <div>
          <Text fw={700} size="lg">
            Edit school
          </Text>
          <Text size="sm" c="dimmed">
            Update the school details.
          </Text>
        </div>

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        {message && (
          <Text size="sm" c="green">
            {message}
          </Text>
        )}

        {!loading && (
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                label="School name *"
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

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  type="button"
                  onClick={() => navigate("/admin/schools")}
                >
                  Back to list
                </Button>
                <Button type="submit">Save changes</Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </Card>
  );
};

export default AdminEditSchoolPage;


