// src/modules/admin/AdminDonorsPage.tsx
import React, { useEffect, useState } from "react";
import { Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import {
  Badge,
  Button as LumenButton,
  type DataColumn,
} from "../../design-system/lumen";

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

  // Flatten the JSON contact blob and the stats map into sortable, filterable
  // columns. TableSection owns search from here on.
  const rows = donors.map((d) => {
    const c = (d.contact ?? {}) as DonorContact;
    const stats = statsByDonor[d.id];
    return {
      id: d.id,
      name: d.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      agent: agentNameById(c.agent_id) ?? "No agent",
      studentCount: stats?.studentCount ?? 0,
      lastAward: stats?.lastAwardDate ?? null,
    };
  });

  const kpis: TableKpi[] = (() => {
    const supporting = rows.filter((r) => r.studentCount > 0).length;
    const students = rows.reduce((sum, r) => sum + r.studentCount, 0);
    const withAgent = rows.filter((r) => r.agent !== "No agent").length;
    return [
      { label: "Donors", value: rows.length, footnote: "on record", mark: "donors" },
      { label: "Actively giving", value: supporting, footnote: "support a student", mark: "ontrack" },
      { label: "Students supported", value: students, footnote: "across all donors", mark: "students" },
      { label: "With an agent", value: withAgent, footnote: "have a contact", mark: "accounts" },
    ];
  })();

  const columns: DataColumn<(typeof rows)[number]>[] = [
    {
      key: "name",
      label: "Name",
      width: 200,
      render: (d) => (d.name ? <Text size="sm">{d.name}</Text> : <Badge tone="neutral">Anonymous</Badge>),
    },
    {
      key: "email",
      label: "Contact",
      width: 230,
      render: (d) => (
        <div>
          <Text size="sm">{d.email || "—"}</Text>
          <Text size="xs" c="dimmed">
            {d.phone || "—"}
          </Text>
        </div>
      ),
    },
    { key: "agent", label: "Agent", width: 160 },
    { key: "studentCount", label: "Students supported", align: "right", numeric: true, width: 160 },
    {
      key: "lastAward",
      label: "Last scholarship",
      width: 150,
      muted: true,
      render: (d) => (d.lastAward ? new Date(d.lastAward).toLocaleDateString() : "—"),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <PageHeader
        title="Donors"
        subtitle="Everyone funding a scholarship, and who looks after them."
        actions={<LumenButton variant="primary" icon="plus" onClick={() => navigate("/admin/donors/new")}>Add donor</LumenButton>}
      />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={rows}
        onRowClick={(d) => navigate(`/admin/donors/${d.id}/edit`)}
        emptyTitle="No donors found"
        emptyDescription="Add a donor to start recording scholarships."
        emptyIcon="users"
        emptyAction={
          <LumenButton variant="secondary" icon="plus" onClick={() => navigate("/admin/donors/new")}>
            Add donor
          </LumenButton>
        }
      />
    </Stack>
  );
};

export default AdminDonorsPage;
