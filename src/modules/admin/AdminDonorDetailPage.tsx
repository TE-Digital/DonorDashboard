// src/modules/admin/AdminDonorDetailPage.tsx
//
// One donor, in the shape an admin already knows from teachers and students:
// who this is, what they've given, and who it pays for.
//
// Money stays in view whichever tab is open: the KPI row answers "has this
// donor given, and is any of it waiting?" before a tab is chosen. The tabs then
// split the record by the question being asked. Overview is who they are and
// how to reach them. Payments is the ledger the balance is made of. Students is
// who the money supports, and where more of it gets allocated.
//
// The tab lives in the URL (?tab=payments), the same way the student overview
// does it, so a link from anywhere can open the right one.

import React, { useCallback, useEffect, useState } from "react";
import { Avatar, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  InlineMessage,
  KpiRow,
  LoadingState,
  countryName,
  displayPhone,
  formatCurrency,
  formatDate,
  type KpiItem,
} from "../../design-system";
import {
  Badge,
  Banner,
  Button,
  DataTable,
  EmptyState,
  Tabs,
  type DataColumn,
} from "../../design-system/lumen";
import { profileAvatarStyle, profileInitials } from "../../design-system/profileAvatar";
import { useTranslation } from "react-i18next";
import { AssignSponsorDrawer } from "../sponsorship/AssignSponsorDrawer";
import { ContributionDrawer } from "../donor/ContributionDrawer";
import { ContributionsTable } from "../donor/ContributionsTable";
import {
  loadContributions,
  loadDonorBalance,
  type Contribution,
  type DonorBalance,
} from "../donor/donorMoney";
import { DONOR_FIELDS_PENDING_NOTE, toDonorDetails } from "./donorRecord";
import { DonorFormDrawer } from "./DonorFormDrawer";
import type { CreatedDonor } from "./DonorForm";
import { isMissingColumnError } from "./teacherProfile";
import styles from "./AdminDirectory.module.scss";

type TabValue = "overview" | "payments" | "students";
const TAB_VALUES: TabValue[] = ["overview", "payments", "students"];

/** A ?tab= that names a real tab; anything else opens the record on Overview. */
const tabFromUrl = (value: string | null): TabValue =>
  TAB_VALUES.includes(value as TabValue) ? (value as TabValue) : "overview";

const BASE_COLUMNS =
  "id, name, contact, created_at, preferred_language, wants_email_updates, wants_newsletter, is_dashboard_enabled, note_internal";
const EXTENDED_COLUMNS = `${BASE_COLUMNS}, donor_type, contact_person, country`;

/** What an empty value reads as. Never a dash (docs/VOICE.md, R6). */
const NOT_RECORDED = "Not recorded";

interface DonorRecord {
  id: string;
  name: string | null;
  contact: {
    email?: string | null;
    phone?: string | null;
    other_contact?: string | null;
    address?: string | null;
    agent_id?: string | null;
  } | null;
  created_at: string | null;
  preferred_language: string | null;
  wants_email_updates: boolean | null;
  wants_newsletter: boolean | null;
  is_dashboard_enabled: boolean | null;
  note_internal: string | null;
  donor_type?: "individual" | "organisation" | null;
  contact_person?: string | null;
  country?: string | null;
}

interface FundedStudent {
  // The scholarship, not the student: a donor can fund the same student twice
  // (an ended commitment and the one that replaced it), and this is the row
  // key, so two rows about one student must not share it.
  id: string;
  studentId: string;
  name: string;
  monthly: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  status: string | null;
}

const onOff = (value: boolean | null | undefined, fallback: boolean): string =>
  (value ?? fallback) ? "On" : "Off";

export const AdminDonorDetailPage: React.FC = () => {
  const { donorId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [donor, setDonor] = useState<DonorRecord | null>(null);
  /** False when donor type, contact person and country aren't in the database yet. */
  const [extended, setExtended] = useState(true);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [balance, setBalance] = useState<DonorBalance | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [students, setStudents] = useState<FundedStudent[]>([]);
  const [moneyAvailable, setMoneyAvailable] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Contribution | null>(null);
  const [allocating, setAllocating] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState<TabValue>(() => tabFromUrl(searchParams.get("tab")));

  /** Keeps the URL and the open tab saying the same thing, without a history entry per click. */
  const setTab = useCallback(
    (next: TabValue) => {
      setTabState(next);
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === "overview") params.delete("tab");
          else params.set("tab", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Editing happens in the same side panel as adding. ?edit=1 opens it, so the
  // old /admin/donors/:id/edit route and a bookmark can both land here, and the
  // open tab is kept underneath.
  const editOpen = searchParams.get("edit") === "1";
  const setEditOpen = useCallback(
    (open: boolean) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (open) params.set("edit", "1");
          else params.delete("edit");
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  // The Today rail's "can fund waiting students" links here with ?assign=1: open
  // the drawer on the Students tab, then drop the parameter so a reload doesn't.
  useEffect(() => {
    if (searchParams.get("assign") !== "1" || loading) return;
    setTabState("students");
    setAllocating(true);
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete("assign");
        params.set("tab", "students");
        return params;
      },
      { replace: true },
    );
    // loading is read so the drawer opens once the balance it shows has arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  const load = useCallback(async () => {
    if (!donorId) return;

    /** The donor row, with the new columns if the database has them. */
    const readDonor = async (): Promise<{ row: DonorRecord | null; extended: boolean }> => {
      const full = await supabase.from("donors").select(EXTENDED_COLUMNS).eq("id", donorId).maybeSingle();
      if (!full.error) return { row: (full.data as DonorRecord | null) ?? null, extended: true };
      if (!isMissingColumnError(full.error)) {
        console.error("Error loading donor", full.error);
        return { row: null, extended: true };
      }
      const base = await supabase.from("donors").select(BASE_COLUMNS).eq("id", donorId).maybeSingle();
      if (base.error) console.error("Error loading donor", base.error);
      return { row: (base.data as DonorRecord | null) ?? null, extended: false };
    };

    const [donorRead, balanceRead, ledgerRead, scholarshipRead] = await Promise.all([
      readDonor(),
      loadDonorBalance(donorId),
      loadContributions(donorId),
      supabase
        .from("scholarships")
        .select("id, student_id, amount_thb, monthly_amount_thb, coverage_start, coverage_end, status, students(name)")
        .eq("donor_id", donorId)
        .order("coverage_start", { ascending: false }),
    ]);

    setDonor(donorRead.row);
    setExtended(donorRead.extended);

    const agentId = donorRead.row?.contact?.agent_id;
    if (agentId) {
      const { data: agent } = await supabase.from("agents").select("name").eq("id", agentId).maybeSingle();
      setAgentName((agent as { name?: string } | null)?.name ?? null);
    } else {
      setAgentName(null);
    }

    setBalance(balanceRead.data);
    setContributions(ledgerRead.data);
    // Either read failing the same way means the same thing: the funding
    // migration is not applied. One flag, so the page says it once.
    setMoneyAvailable(balanceRead.available && ledgerRead.available);

    if (scholarshipRead.error) {
      console.error("Error loading scholarships", scholarshipRead.error);
      setStudents([]);
    } else {
      setStudents(
        (scholarshipRead.data ?? []).map((row: any) => ({
          id: row.id,
          studentId: row.student_id,
          name: row.students?.name ?? "Student with no name",
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
    void load();
  }, [load]);

  const openRecord = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: Contribution) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const handleUpdated = (updated: CreatedDonor) => {
    setEditOpen(false);
    // Reloaded in place: a full reload would swap the page for a spinner.
    void load();
    notifications.show({
      color: "green",
      title: `${updated.name || "Donor"} updated`,
      message: "Your changes are saved.",
    });
    if (!updated.extended) {
      notifications.show({ color: "yellow", title: "Saved without some fields", message: DONOR_FIELDS_PENDING_NOTE, autoClose: false });
    }
  };

  if (loading) return <LoadingState />;

  if (!donor) {
    return (
      <EmptyState
        icon="users"
        title="We couldn't find this donor"
        description="They may have been removed, or the link may be out of date."
        action={
          <Button variant="secondary" onClick={() => navigate("/admin/donors")}>
            Back to donors
          </Button>
        }
      />
    );
  }

  const contact = donor.contact ?? {};
  const isOrganisation = extended && donor.donor_type === "organisation";
  const displayName = donor.name?.trim() || "Anonymous donor";
  const email = contact.email?.trim() || null;
  const language = donor.preferred_language === "th" ? "Thai" : "English";
  const reportEmailsOn = donor.wants_email_updates ?? true;
  const free = balance?.free_balance_thb ?? 0;
  const activeStudents = new Set(students.filter((s) => s.status === "active").map((s) => s.studentId)).size;
  // Who the money supports now comes first; history sits underneath. The sort
  // is stable, so within each group the newest coverage stays on top.
  const sortedStudents = [...students].sort(
    (a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1),
  );
  const nothingToAllocate = moneyAvailable && free <= 0;

  // The subtitle confirms which donor this is without opening a tab.
  const meta: string[] = [
    isOrganisation && donor.contact_person?.trim() ? `Contact: ${donor.contact_person.trim()}` : null,
    extended && donor.country ? countryName(donor.country) : null,
    email ?? "No email on record",
    language,
  ].filter((part): part is string => Boolean(part));

  const unallocatedKpi: KpiItem = !moneyAvailable
    ? { label: "Unallocated", value: NOT_RECORDED, mark: "money" }
    : free > 0
      ? { label: "Unallocated", value: formatCurrency(free), icon: "banknote", accent: "orange", footnote: "Waiting to be allocated" }
      : free < 0
        ? { label: "Unallocated", value: formatCurrency(free), icon: "banknote", accent: "orange", footnote: "More allocated than given" }
        : { label: "Unallocated", value: formatCurrency(0), mark: "money" };

  const kpis: KpiItem[] = [
    {
      label: "Total given",
      value: moneyAvailable ? formatCurrency(balance?.total_given_thb ?? 0) : NOT_RECORDED,
      mark: "money",
    },
    unallocatedKpi,
    { label: "Students funded", value: String(activeStudents), mark: "students" },
    {
      label: "Last payment",
      value: balance?.last_received_on ? formatDate(balance.last_received_on) : "No payments yet",
      mark: "time",
    },
  ];

  const overviewSections: Array<{ title: string; fields: Array<[string, string, number]> }> = [
    {
      title: "Contact",
      fields: [
        ["Email", email ?? NOT_RECORDED, 4],
        ["Phone", displayPhone(contact.phone, extended ? donor.country ?? null : "TH") || NOT_RECORDED, 4],
        ["Other contact", contact.other_contact?.trim() || NOT_RECORDED, 4],
        ["Address", contact.address?.trim() || NOT_RECORDED, 12],
      ],
    },
    {
      title: "Donor",
      fields: [
        ...(extended
          ? ([
              ["Type", isOrganisation ? "Organisation" : "Individual", 4],
              ...(isOrganisation
                ? ([["Contact person", donor.contact_person?.trim() || NOT_RECORDED, 4]] as Array<[string, string, number]>)
                : []),
              ["Country", donor.country ? countryName(donor.country) : NOT_RECORDED, 4],
            ] as Array<[string, string, number]>)
          : []),
        ["Agent", agentName ?? "No agent", 4],
        ["On record since", donor.created_at ? formatDate(donor.created_at) : NOT_RECORDED, 4],
      ],
    },
    {
      title: "Preferences",
      fields: [
        ["Preferred language", language, 4],
        ["Report emails", onOff(donor.wants_email_updates, true), 4],
        ["Newsletter", onOff(donor.wants_newsletter, false), 4],
        ["Dashboard access", onOff(donor.is_dashboard_enabled, true), 4],
      ],
    },
    {
      title: "Internal note",
      fields: [["Note", donor.note_internal?.trim() || "No note yet", 12]],
    },
  ];

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
        row.coverageEnd
          ? `${formatDate(row.coverageStart)} to ${formatDate(row.coverageEnd)}`
          : `From ${formatDate(row.coverageStart)}, no end date`,
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
    <Stack className={`${styles.page} ${styles.detailPage}`}>
      <header className={styles.detailHeader}>
        <div className={styles.studentIdentity}>
          <Avatar size={56} style={profileAvatarStyle(donor.id)} className={styles.profileAvatar}>
            {profileInitials(displayName)}
          </Avatar>
          <div className={styles.detailIdentity}>
            <div className={styles.detailTitleRow}>
              <h1 className={styles.detailTitle}>{displayName}</h1>
              {extended && (
                <Badge tone={isOrganisation ? "info" : "neutral"}>
                  {isOrganisation ? "Organisation" : "Individual"}
                </Badge>
              )}
            </div>
            <p className={styles.detailMeta}>
              {meta.map((part, index) => (
                <React.Fragment key={part}>
                  {index > 0 && <span className={styles.detailDot}>·</span>}
                  <span>{part}</span>
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>
        <div className={styles.detailActions}>
          <Button variant="secondary" icon="pencil" onClick={() => setEditOpen(true)}>
            Edit donor
          </Button>
          <Button variant="primary" icon="plus" onClick={openRecord} disabled={!moneyAvailable}>
            Record payment
          </Button>
        </div>
      </header>

      {!extended && <InlineMessage tone="warning">{DONOR_FIELDS_PENDING_NOTE}</InlineMessage>}

      {!moneyAvailable && (
        <Banner tone="warning" title="Payments can't be recorded yet">
          Balances show as zero because this hasn't been set up yet. Ask whoever looks after the system
          to set it up.
        </Banner>
      )}

      {/* Both change what happens the next time a report is sent, so they sit
          above the fold rather than inside a tab. */}
      {!email && (
        <InlineMessage tone="warning">No email on record, so reports can't be sent to this donor.</InlineMessage>
      )}
      {email && !reportEmailsOn && (
        <InlineMessage tone="info">Report emails are off for this donor.</InlineMessage>
      )}

      <KpiRow items={kpis} />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as TabValue)}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "payments", label: "Payments", count: contributions.length },
          { value: "students", label: "Students", count: students.length },
        ]}
      />

      {tab === "overview" && (
        <div className={styles.detailFields}>
          {overviewSections.map((section) => (
            <section key={section.title}>
              <h2 className={styles.detailSectionTitle}>{section.title}</h2>
              <div className={styles.detailFieldGrid}>
                {section.fields.map(([label, value, span]) => (
                  <div key={label} style={{ gridColumn: `span ${span}` }}>
                    <span className={styles.detailFieldLabel}>{label}</span>
                    <span className={styles.detailFieldValue}>{value}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "payments" && (
        <ContributionsTable
          contributions={contributions}
          unavailable={!moneyAvailable}
          onEdit={openEdit}
          onRecord={openRecord}
          onChanged={load}
        />
      )}

      {tab === "students" && (
        <Stack gap="md">
          {/* The figure being spent sits beside the button that spends it. */}
          <div className={styles.detailActions}>
            {moneyAvailable && (
              <span className={styles.detailMeta}>Unallocated: {formatCurrency(free)}</span>
            )}
            <Button
              variant="secondary"
              icon="hand-coins"
              onClick={() => setAllocating(true)}
              disabled={!moneyAvailable || nothingToAllocate}
            >
              {t("sponsorship.donorPage.assign")}
            </Button>
          </div>
          {/* A disabled button says why, rather than greying out in silence. */}
          {nothingToAllocate && (
            <InlineMessage tone="info" size="xs">
              {t("sponsorship.donorPage.nothingFree")}
            </InlineMessage>
          )}
          {students.length === 0 ? (
            <EmptyState
              icon="graduation-cap"
              title={t("sponsorship.donorPage.emptyTitle")}
              description={t("sponsorship.donorPage.emptyBody")}
            />
          ) : (
            <DataTable
              columns={studentColumns}
              rows={sortedStudents}
              density="compact"
              onRowClick={(row) => navigate(`/admin/students/${row.studentId}`)}
            />
          )}
        </Stack>
      )}

      {balance && (
        <AssignSponsorDrawer
          opened={allocating}
          onClose={() => setAllocating(false)}
          mode={{ kind: "donor", donorId, donorName: donor.name, freeBalance: balance.free_balance_thb }}
          onAssigned={load}
        />
      )}

      <DonorFormDrawer
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        donorId={donorId}
        donorName={donor.name}
        initial={toDonorDetails(donor, extended)}
        onUpdated={handleUpdated}
      />

      <ContributionDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        donorId={donorId}
        donorName={donor.name}
        contribution={editing}
        onSaved={load}
        onViewPayments={tab === "payments" ? undefined : () => setTab("payments")}
        followUp={{
          label: t("sponsorship.donorPage.assign"),
          onClick: () => {
            setTab("students");
            setAllocating(true);
          },
        }}
      />
    </Stack>
  );
};

export default AdminDonorDetailPage;
