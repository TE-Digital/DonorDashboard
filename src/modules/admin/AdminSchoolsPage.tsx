import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  Card,
  Stack,
  Text,
  Group,
  Button,
  Table,
  Loader,
} from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";

type School = {
  id: string;
  name: string;
  address: string | null;
  created_at: string | null;
};

export const AdminSchoolsPage: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("schools")
      .select("id, name, address, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading schools", error);
      setSchools([]);
      setLoading(false);
      return;
    }

    setSchools((data ?? []) as School[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Stack gap={2}>
          <Text fw={700} size="lg">
            Schools
          </Text>
          <Text size="sm" c="dimmed">
            Manage schools that students can be linked to.
          </Text>
        </Stack>

        <Button
          component={Link}
          to="/admin/schools/new"
          size="sm"
          variant="filled"
        >
          Add school
        </Button>
      </Group>

      <Card withBorder shadow="xs" radius="md">
        {schools.length === 0 ? (
          <Text size="sm" c="dimmed">
            No schools found.
          </Text>
        ) : (
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            verticalSpacing="xs"
            horizontalSpacing="md"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Address</Table.Th>
                <Table.Th>Created</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {schools.map((s) => (
                <Table.Tr
                  key={s.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/admin/schools/${s.id}`)}
                >
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {s.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {s.address || "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleDateString()
                        : "—"}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
};

export default AdminSchoolsPage;
