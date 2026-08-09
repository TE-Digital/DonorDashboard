import React, { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { EmptyState, InlineMessage, LoadingState, PageHeader } from "../../design-system";

type GrantType = {
  id: string;
  name: string;
  description: string | null;
  amount_per_period: number | null;
  currency: string;
  default_duration_months: number | null;
  created_at: string;
};

export const AdminGrantTypesOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [grantTypes, setGrantTypes] = useState<GrantType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGrantTypes = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("grant_types")
        .select("*")
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      setGrantTypes((data as GrantType[]) || []);
    } catch (err: any) {
      console.error("Error loading grant types", err);
      setError("Could not load grant types.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrantTypes();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the grant type: "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("grant_types")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // Optimistically update the list
      setGrantTypes((prev) => prev.filter((gt) => gt.id !== id));
    } catch (err: any) {
      console.error("Error deleting grant type", err);
      setError("Failed to delete grant type. It may be in use by existing scholarships.");
    }
  };

  const rows = grantTypes.map((item) => (
    <Table.Tr key={item.id}>
      <Table.Td>
        <Text fw={500}>{item.name}</Text>
      </Table.Td>
      <Table.Td>
        {item.amount_per_period ? (
          <Badge variant="light" color="blue">
            {new Intl.NumberFormat().format(item.amount_per_period)} {item.currency}
          </Badge>
        ) : (
          <Text c="dimmed" size="sm">—</Text>
        )}
      </Table.Td>
      <Table.Td>
        {item.default_duration_months ? (
          <Text size="sm">{item.default_duration_months} months</Text>
        ) : (
          <Text c="dimmed" size="sm">—</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Group gap="xs" justify="flex-end" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            onClick={() => navigate(`/admin/grant-types/edit/${item.id}`)}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={() => handleDelete(item.id, item.name)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Stack>
      <PageHeader
        title="Grant Types"
        actions={
          <Button onClick={() => navigate("/admin/grant-types/new")}>
              Add new grant type
            </Button>
        }
      />

      <InlineMessage tone="error">{error}</InlineMessage>

      <Paper withBorder p="md">
        {grantTypes.length === 0 ? (
          <EmptyState
            title="No grant types found."
            description='Click "Add new grant type" to create one.'
          />
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Standard Amount</Table.Th>
                <Table.Th>Default Duration</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
};