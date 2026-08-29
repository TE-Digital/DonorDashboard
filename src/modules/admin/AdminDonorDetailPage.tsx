// src/modules/admin/AdminDonorDetailPage.tsx
//
// The screen an admin opens to answer "what has this donor given, and who is it
// paying for?"
//
// Until now a donor had a create page and an edit page and nothing in between:
// clicking a row in the donors directory opened a form. A form is where you go
// to change a name, not to decide whether there is enough money to fund Nan
// this term, so the directory linked to the wrong place for the question people
// actually arrived with.
//
// The order on this page is the order of the question. Money first, because
// that is what the admin came to check. Then the students it is already paying
// for. Then the ledger the balance is made of, for when the number is doubted.

import React, { useCallback, useEffect, useState } from "react";
import { Stack, Text } from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  LoadingState,
  PageHeader,
  SectionCard,
  formatCurrency,
  formatDate,
} from "../../design-system";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Banner,
  type DataColumn,
} from "../../design-system/lumen";
import { AllocationPanel } from "../donor/AllocationPanel";
import { ContributionDrawer } from "../donor/ContributionDrawer";
import { ContributionsTable } from "../donor/ContributionsTable";
import { DonorBalanceCard } from "../donor/DonorBalanceCard";
import {
  loadContributions,
  loadDonorBalance,
  type Contribution,
  type DonorBalance,
} from "../donor/donorMoney";

interface DonorRecord {
  id: string;
  name: string | null;
  contact: { email?: string | null; phone?: string | null } | null;
  created_at: string | null;
}

interface FundedStudent {
  // The scholarship, not the student: a donor can fund the same student twice
  // — an ended commitment and the one that replaced it — and this is the row
  // key, so two rows about one student must not share it.
  id: string;
  studentId: string;
  name: string;
  monthly: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  status: string | null;
}

export const AdminDonorDetailPage: React.FC = () => {
  const { donorId = "" } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [donor, setDonor] = useState<DonorRecord | null>(null);
  const [balance, setBalance] = useState<DonorBalance | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [students, setStudents] = useState<FundedStudent[]>([]);
  const [moneyAvailable, setMoneyAvailable] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Contribution | null>(null);
  const [allocating, setAllocating] = useState(false);

  const load = useCallback(async () => {
    if (!donorId) return;

    const [donorRead, balanceRead, ledgerRead, scholarshipRead] = await Promise.all([
      supabase.from("donors").select("id, name, contact, created_at").eq("id", donorId).maybeSingle(),
      loadDonorBalance(donorId),
      loadContributions(donorId),
      supabase
        .from("scholarships")
        .select("id, student_id, amount_thb, monthly_amount_thb, coverage_start, coverage_end, status, students(name)")
        .eq("donor_id", donorId)
        .order("coverage_start", { ascending: false }),
    ]);

    if (donorRead.error) console.error("Error loading donor", donorRead.error);
    setDonor((donorRead.data as DonorRecord) ?? null);

    setBalance(balanceRead.data);
    setContributions(ledgerRead.data);
    // Either read failing the same way means the same thing: the migration is
    // not applied. One flag rather than two, so the page says it once.
    setMoneyAvailable(balanceRead.available && ledgerRead.available);

    if (scholarshipRead.error) {
      console.error("Error loading scholarships", scholarshipRead.error);
      setStudents([]);
    } else {
      setStudents(
        (scholarshipRead.data ?? []).map((row: any) => ({
          id: row.id,
          studentId: row.student_id,
          name: row.students?.name ?? "Unnamed student",
          monthly: Number(row.monthly_amount_thb ?? row.amount_thb ?? 0),
          coverageStart: row.coverage_start ?? null,
          coverageEnd: row.coverage_end ?? null,
          status: row.status ?? null,
        })),
      );
    }

    setLoading(false);
  }, [donorId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const openRecord = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: Contribution) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  if (loading) return <LoadingState />;

  if (!donor) {
    return (
      <EmptyState
        icon="users"
        title="Donor not found"
        description="This donor may have been removed."
        action={
          <Button variant="secondary" onClick={() => navigate("/admin/donors")}>
            Back to donors
          </Button>
        }
      />
    );
  }

  const studentColumns: DataColumn<FundedStudent>[] = [
    { key: "name", label: "Student", width: 220 },
    {
      key: "monthly",
      label: "Each month",
      align: "right",
      numeric: true,
      width: 130,
      render: (row) => formatCurrency(row.monthly),
    },
    {
      key: "coverageStart",
      label: "Covers",
      width: 210,
      muted: true,
      render: (row) =>
        `${formatDate(row.coverageStart)} – ${row.coverageEnd ? formatDate(row.coverageEnd) : "ongoing"}`,
    },
    {
      key: "status",
      label: "Status",
      width: 110,
      render: (row) => (
        <Badge tone={row.status === "active" ? "success" : "neutral"}>
          {row.status === "active" ? "Active" : "Ended"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <PageHeader
        title={donor.name || "Anonymous donor"}
        subtitle={donor.contact?.email || "No email on record"}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate("/admin/donors")}>
              All donors
            </Button>
            <Button variant="secondary" icon="pencil" onClick={() => navigate(`/admin/donors/${donorId}/edit`)}>
              Edit details
            </Button>
          </>
        }
      />

      {!moneyAvailable && (
        <Banner tone="warning" title="Funding records are not set up yet">
          The funding migration has not been applied to this database. Balances read as zero and
          contributions cannot be recorded until it is.
        </Banner>
      )}

      {balance && (
        <DonorBalanceCard
          balance={balance}
          unavailable={!moneyAvailable}
          onRecordContribution={moneyAvailable ? openRecord : undefined}
          onAllocate={moneyAvailable ? () => setAllocating(true) : undefined}
        />
      )}

      <SectionCard
        title="Students supported"
        description="Every commitment this donor has made, active or ended."
      >
        {students.length === 0 ? (
          <EmptyState
            icon="graduation-cap"
            title="Not funding anyone yet"
            description="Allocate from this donor's balance to link them to a student."
            action={
              <Button
                variant="secondary"
                icon="hand-coins"
                onClick={() => setAllocating(true)}
                disabled={!moneyAvailable}
              >
                Allocate
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={studentColumns}
            rows={students}
            density="compact"
            onRowClick={(row) => navigate(`/admin/students/${row.studentId}`)}
          />
        )}
      </SectionCard>

      <ContributionsTable
        contributions={contributions}
        unavailable={!moneyAvailable}
        onEdit={openEdit}
        onRecord={openRecord}
        onChanged={load}
      />

      {balance && (
        <AllocationPanel
          opened={allocating}
          onClose={() => setAllocating(false)}
          donorId={donorId}
          donorName={donor.name}
          balance={balance}
          onAllocated={load}
        />
      )}

      <ContributionDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        donorId={donorId}
        donorName={donor.name}
        contribution={editing}
        onSaved={load}
      />

      <Text size="xs" c="dimmed">
        Donor on record since {formatDate(donor.created_at)}.
      </Text>
    </Stack>
  );
};

export default AdminDonorDetailPage;
