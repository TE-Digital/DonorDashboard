import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Card, Stack, Text, Button, Table } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  textRole,
} from "../../design-system";

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
    return <LoadingState />;
  }

  return (
    <Stack>
      <PageHeader
        title="Schools"
        subtitle="Manage schools that students can be linked to."
        actions={
          <Button component={Link} to="/admin/schools/new">
            Add school
          </Button>
        }
      />

      <Card>
        {schools.length === 0 ? (
          <EmptyState
            title="No schools found."
            description="Add a school to link students to it."
          />
        ) : (
          <Table withTableBorder withColumnBorders>
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
                    <Text {...textRole("fieldLabel")}>{s.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text {...textRole("body")} c="dimmed">
                      {s.address || "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text {...textRole("body")} c="dimmed">
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
