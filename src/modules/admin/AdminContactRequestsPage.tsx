// src/modules/admin/AdminContactRequestsPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  Table,
  Badge,
  Loader,
  Center,
  ScrollArea,
  Anchor,
  Modal,
  Button,
} from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";

type ContactRequestRow = {
  id: string;
  contact_type: string;
  name: string;
  email: string;
  message: string;
  source: string | null;
  created_at: string;
  handled: boolean;
  handled_at: string | null;
  grant_types?: {
    name: string | null;
  } | null;
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  donor_renewal: "Donor renewal",
  donor_new: "New donor lead",
  general: "General inquiry",
};

const getContactTypeLabel = (type: string) =>
  CONTACT_TYPE_LABELS[type] ?? type;

export const AdminContactRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<ContactRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string | null>("donor_renewal");
  const [statusFilter, setStatusFilter] = useState<string | null>("unhandled");
  const [search, setSearch] = useState("");

  const [openedMessageId, setOpenedMessageId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("contact_requests")
      .select(
        `
        id,
        contact_type,
        name,
        email,
        message,
        source,
        created_at,
        handled,
        handled_at,
        grant_types ( name )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading contact_requests", error);
      setError("Could not load contact requests.");
      setRequests([]);
      setLoading(false);
      return;
    }

    setRequests((data ?? []) as ContactRequestRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();

    return requests.filter((r) => {
      if (typeFilter && typeFilter !== "all" && r.contact_type !== typeFilter) {
        return false;
      }

      if (statusFilter === "unhandled" && r.handled) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        r.name,
        r.email,
        r.message,
        r.source ?? "",
        r.grant_types?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [requests, typeFilter, statusFilter, search]);

  const openMessage = (id: string) => setOpenedMessageId(id);
  const closeMessage = () => setOpenedMessageId(null);

  const openedRequest = useMemo(
    () => filteredRequests.find((r) => r.id === openedMessageId) ?? null,
    [openedMessageId, filteredRequests]
  );

  // -------- toggle handled <-> unhandled --------
  const toggleHandled = async (id: string, nextHandled: boolean) => {
    setUpdating(true);
    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("contact_requests")
        .update({
          handled: nextHandled,
          handled_at: nextHandled ? nowIso : null,
        })
        .eq("id", id);

      if (error) {
        console.error("Error toggling handled status", error);
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                handled: nextHandled,
                handled_at: nextHandled ? nowIso : null,
              }
            : r
        )
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card withBorder shadow="sm" radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={700} size="lg">
              Contact & renewal requests
            </Text>
            <Text size="sm" c="dimmed">
              Overview of donor renewal requests and other contact leads
              submitted via the dashboards or future public forms.
            </Text>
          </div>

          <Button variant="outline" size="xs" onClick={loadRequests}>
            Refresh
          </Button>
        </Group>

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}

        {/* Filters */}
        <Group grow align="flex-end">
          <Select
            label="Type"
            placeholder="All types"
            value={typeFilter}
            onChange={setTypeFilter}
            data={[
              { value: "all", label: "All types" },
              { value: "donor_renewal", label: "Donor renewal" },
              { value: "donor_new", label: "New donor lead" },
              { value: "general", label: "General inquiry" },
            ]}
          />

          <Select
            label="Status"
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: "unhandled", label: "Unhandled only" },
              { value: "all", label: "All requests" },
            ]}
          />

          <TextInput
            label="Search"
            placeholder="Search name, email, message, grant, source…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </Group>

        {loading ? (
          <Center mt="md">
            <Loader />
          </Center>
        ) : filteredRequests.length === 0 ? (
          <Text size="sm" c="dimmed" mt="md">
            No contact requests found for the selected filters.
          </Text>
        ) : (
          <ScrollArea mah={500}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Grant type</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Message</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredRequests.map((r) => (
                  <Table.Tr
                    key={r.id}
                    style={r.handled ? { opacity: 0.8 } : undefined}
                  >
                    <Table.Td>
                      {new Date(r.created_at).toLocaleString()}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light">
                        {getContactTypeLabel(r.contact_type)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{r.name}</Table.Td>
                    <Table.Td>
                      <Anchor href={`mailto:${r.email}`} size="sm">
                        {r.email}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>
                      {r.grant_types?.name ? (
                        <Badge size="sm" variant="outline">
                          {r.grant_types.name}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">
                          –
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {r.source ? (
                        <Text size="xs">{r.source}</Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          –
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" lineClamp={2}>
                        {r.message}
                      </Text>
                      <Button
                        variant="subtle"
                        size="xs"
                        mt={4}
                        onClick={() => openMessage(r.id)}
                      >
                        View
                      </Button>
                    </Table.Td>
                    <Table.Td>
                      {r.handled ? (
                        <Button
                          size="xs"
                          variant="outline"
                          color="gray"
                          onClick={() => toggleHandled(r.id, false)}
                          loading={updating}
                        >
                          Mark as unhandled
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => toggleHandled(r.id, true)}
                          loading={updating}
                        >
                          Mark as handled
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Stack>

      {/* Modal with full message */}
      <Modal
        opened={!!openedRequest}
        onClose={closeMessage}
        title="Request details"
        size="lg"
        centered
      >
        {openedRequest && (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {new Date(openedRequest.created_at).toLocaleString()}
            </Text>

            <Group gap="xs">
              <Badge size="sm" variant="light">
                {getContactTypeLabel(openedRequest.contact_type)}
              </Badge>
              {openedRequest.grant_types?.name && (
                <Badge size="sm" variant="outline">
                  {openedRequest.grant_types.name}
                </Badge>
              )}
              {openedRequest.handled ? (
                <Badge size="sm" color="gray" variant="light">
                  Handled
                </Badge>
              ) : (
                <Badge size="sm" color="red" variant="light">
                  New
                </Badge>
              )}
            </Group>

            <Text fw={500}>
              {openedRequest.name}{" "}
              <Text span size="sm" c="dimmed">
                &lt;{openedRequest.email}&gt;
              </Text>
            </Text>

            {openedRequest.source && (
              <Text size="sm" c="dimmed">
                Source: {openedRequest.source}
              </Text>
            )}

            {openedRequest.handled_at && (
              <Text size="xs" c="dimmed">
                Handled at:{" "}
                {new Date(openedRequest.handled_at).toLocaleString()}
              </Text>
            )}

            <Text size="sm" mt="sm">
              {openedRequest.message}
            </Text>

            <Group justify="space-between" mt="md">
              <Anchor
                href={`mailto:${openedRequest.email}`}
                size="sm"
                target="_blank"
              >
                Reply via email
              </Anchor>

              <Group gap="xs">
                {openedRequest.handled ? (
                  <Button
                    size="xs"
                    variant="outline"
                    color="gray"
                    onClick={() => toggleHandled(openedRequest.id, false)}
                    loading={updating}
                  >
                    Mark as unhandled
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    onClick={() => toggleHandled(openedRequest.id, true)}
                    loading={updating}
                  >
                    Mark as handled
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="xs"
                  onClick={closeMessage}
                >
                  Close
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Card>
  );
};
