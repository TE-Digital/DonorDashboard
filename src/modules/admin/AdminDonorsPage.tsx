// src/modules/admin/AdminDonorsPage.tsx
import React, { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type DonorContact = {
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  other_contact?: string | null;
  agent_id?: string | null;
  scholarship_ids?: string[];
};

type DonorRow = {
  id: string;
  name: string | null;
  created_at: string | null;
  contact: DonorContact | null;
};

type Agent = { id: string; name: string };

type DonorStats = {
  donorId: string;
  studentCount: number;
  lastAwardDate: string | null; // ISO date string
};

export const AdminDonorsPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [statsByDonor, setStatsByDonor] = useState<Record<string, DonorStats>>(
    {}
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      try {
        // Load donors & agents in parallel
        const [{ data: donorRows, error: donorError }, { data: agentRows, error: agentError }] =
          await Promise.all([
            supabase
              .from("donors")
              .select("id, name, contact, created_at")
              .order("name", { ascending: true }),
            supabase
              .from("agents")
              .select("id, name")
              .order("name", { ascending: true }),
          ]);

        if (donorError) {
          console.error("Error loading donors", donorError);
          setDonors([]);
        } else {
          setDonors((donorRows ?? []) as DonorRow[]);
        }

        if (agentError) {
          console.error("Error loading agents", agentError);
          setAgents([]);
        } else {
          setAgents((agentRows ?? []) as Agent[]);
        }

        // Compute stats: students supported + last scholarship date
        const donorIds = (donorRows ?? []).map((d: any) => d.id as string);

        if (donorIds.length > 0) {
          const { data: awardRows, error: awardError } = await supabase
            .from("scholarship_awards")
            .select("donor_id, student_id, period_start, period_end, payment_date")
            .in("donor_id", donorIds);

          if (awardError) {
            console.error("Error loading scholarship awards for donors", awardError);
            setStatsByDonor({});
          } else {
            const temp: Record<
              string,
              { studentIds: Set<string>; last: string | null }
            > = {};

            (awardRows ?? []).forEach((row: any) => {
              const donorId = row.donor_id as string | null;
              if (!donorId) return;

              if (!temp[donorId]) {
                temp[donorId] = {
                  studentIds: new Set<string>(),
                  last: null,
                };
              }

              // collect student ids
              if (row.student_id) {
                temp[donorId].studentIds.add(row.student_id as string);
              }

              // compute "last scholarship" date
              const dateStr: string | null =
                row.payment_date || row.period_end || row.period_start || null;
              if (dateStr) {
                if (!temp[donorId].last) {
                  temp[donorId].last = dateStr;
                } else {
                  const current = new Date(temp[donorId].last as string);
                  const candidate = new Date(dateStr);
                  if (candidate > current) {
                    temp[donorId].last = dateStr;
                  }
                }
              }
            });

            const stats: Record<string, DonorStats> = {};
            Object.entries(temp).forEach(([donorId, value]) => {
              stats[donorId] = {
                donorId,
                studentCount: value.studentIds.size,
                lastAwardDate: value.last,
              };
            });

            setStatsByDonor(stats);
          }
        } else {
          setStatsByDonor({});
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const agentNameById = (id: string | null | undefined) => {
    if (!id) return null;
    const a = agents.find((ag) => ag.id === id);
    return a?.name ?? id;
  };

  const filtered = donors.filter((d) => {
    const term = search.toLowerCase();
    if (!term) return true;

    const c = (d.contact ?? {}) as DonorContact;
    return (
      (d.name ?? "").toLowerCase().includes(term) ||
      (c.email ?? "").toLowerCase().includes(term) ||
      (c.phone ?? "").toLowerCase().includes(term) ||
      (agentNameById(c.agent_id) ?? "").toLowerCase().includes(term)
    );
  });

  if (loading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="lg">
          Donors
        </Text>
        <Button size="xs" onClick={() => navigate("/admin/donors/new")}>
          Add donor
        </Button>
      </Group>

      <Card withBorder>
        <Stack gap="sm">
          <TextInput
            placeholder="Search by name, email, phone, agent…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />

          {filtered.length === 0 ? (
            <Text size="sm" c="dimmed">
              No donors found.
            </Text>
          ) : (
            <Table
              striped
              highlightOnHover
              horizontalSpacing="md"
              verticalSpacing="xs"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Contact</Table.Th>
                  <Table.Th>Agent</Table.Th>
                  <Table.Th>Students supported</Table.Th>
                  <Table.Th>Last scholarship</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((d) => {
                  const c = (d.contact ?? {}) as DonorContact;
                  const agentName = agentNameById(c.agent_id);
                  const stats = statsByDonor[d.id];

                  const studentCountLabel =
                    stats && stats.studentCount > 0
                      ? stats.studentCount.toString()
                      : "—";

                  const lastAwardLabel =
                    stats && stats.lastAwardDate
                      ? new Date(stats.lastAwardDate).toLocaleDateString()
                      : "—";

                  return (
                    <Table.Tr key={d.id}>
                      <Table.Td>
                        {d.name ? (
                          <Text size="sm">{d.name}</Text>
                        ) : (
                          <Badge variant="light" color="gray">
                            Anonymous
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {c.email || <span style={{ color: "#999" }}>—</span>}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {c.phone || "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {agentName ? (
                          <Text size="sm">{agentName}</Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            No agent
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{studentCountLabel}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{lastAwardLabel}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() =>
                            navigate(`/admin/donors/${d.id}/edit`)
                          }
                        >
                          Edit
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

export default AdminDonorsPage;

