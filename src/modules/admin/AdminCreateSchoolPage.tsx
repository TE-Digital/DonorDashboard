import React, { useState } from "react";
import {
  Stack,
  Text,
  TextInput,
  Textarea,
  Group,
  Button,
} from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import {
  LoadingState,
} from "../../design-system";

export const AdminCreateSchoolPage: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("School name is required.");
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("schools")
      .insert({
        name: trimmedName,
        address: address.trim() || null,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("Error creating school", insertError);
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setMessage("School created successfully.");
    if (data?.id) {
      navigate(`/admin/schools/${data.id}`);
    } else {
      navigate("/admin/schools");
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <LoadingState variant="overlay" visible={saving} />

      <Stack gap="lg">
        <div>
          <Text fw={700} size="lg">
            Add school
          </Text>
          <Text size="sm" c="dimmed">
            Create a new school that students and teachers can be linked to.
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

        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
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
              placeholder="Street, village, district, province..."
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                type="button"
                onClick={() => navigate("/admin/schools")}
              >
                Cancel
              </Button>
              <Button type="submit">Save school</Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </div>
  );
};

export default AdminCreateSchoolPage;

