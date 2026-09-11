// src/modules/admin/AdminDonorsPage.tsx
//
// The donors list: the screen an admin spends most of their donor time on.
//
// Most donor work is scanning (who has given, whose money is sitting
// unallocated, who runs short next month) and acting on one row without
// leaving the table. So the row carries its own actions, and a payment from a
// bank statement can be recorded straight from here, one line after another.
//
// Finding one donor by name is the global search's job (⌘K), not this table's:
// that is a platform decision recorded in TableSection. Narrowing is done with
// column filters, plus a few filters that arrive by link (?balance=idle from
// the dashboard's "Allocate" item, ?type=, ?country=, ?phone=invalid), each
// shown as a removable tag so it is always clear why the list is shorter.

import React, { useCallback, useEffect, useState } from "react";
import { ActionIcon, Anchor, Menu, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowRight, IconCoins, IconDotsVertical, IconPencil } from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  LoadingState,
  PageHeader,
  TableSection,
  countryName,
  displayPhone,
  formatCurrency,
  formatDate,
  normalisePhone,
  type TableKpi,
} from "../../design-system";
import { ContributionDrawer } from "../donor/ContributionDrawer";
import { loadDonorBalances, type DonorBalance } from "../donor/donorMoney";
import { DonorFormDrawer } from "./DonorFormDrawer";
import type { CreatedDonor } from "./DonorForm";
import { DONOR_FIELDS_PENDING_NOTE } from "./donorRecord";
import { isMissingColumnError } from "./teacherProfile";
import {
  Badge,
  Button as LumenButton,
  Tag,
  type DataColumn,
} from "../../design-system/lumen";
import styles from "./AdminDirectory.module.scss";

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
  donor_type?: string | null;
  contact_person?: string | null;
  country?: string | null;
};

type Agent = { id: string; name: string };

type DonorStats = {
  donorId: string;
  studentCount: number;
  lastAwardDate: string | null; // ISO date string
};

const BASE_COLUMNS = "id, name, contact, created_at";
const EXTENDED_COLUMNS = `${BASE_COLUMNS}, donor_type, contact_person, country`;

/** What an empty value reads as. Never a dash (docs/VOICE.md, R6). */
const NOT_RECORDED = "Not recorded";

export const AdminDonorsPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<DonorRow[]>([]);
  /** False when donor type, contact person and country aren't in the database yet. */
  const [extended, setExtended] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [statsByDonor, setStatsByDonor] = useState<Record<string, DonorStats>>({});
  // Money comes from the donor_balance view rather than being summed here, so
  // this table and the donor page cannot disagree about what a donor has given.
  const [balances, setBalances] = useState<Map<string, DonorBalance>>(new Map());
  const [moneyAvailable, setMoneyAvailable] = useState(true);
  /** The donor a payment is being recorded for, straight from their row. */
  const [recordFor, setRecordFor] = useState<{ id: string; name: string | null } | null>(null);

  // Adding happens in a drawer over this list; ?add=1 opens it, so the old
  // /admin/donors/new route and a bookmark can both land here.
  const [searchParams, setSearchParams] = useSearchParams();
  const adding = searchParams.get("add") === "1";
  /** The donor just created or paid, marked in the table so it is easy to find. */
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Filters that arrive by link. One-way, like ?province= on schools: read on
  // arrival, shown as a tag, and removing the tag removes the parameter.
  const balanceFilter = searchParams.get("balance") === "idle";
  const typeParam = searchParams.get("type");
  const typeFilter = typeParam === "individual" || typeParam === "organisation" ? typeParam : null;
  const countryFilter = searchParams.get("country")?.toUpperCase() || null;
  const phoneFilter = searchParams.get("phone") === "invalid";

  const setParam = (key: string, value: string | null) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const setAdding = (open: boolean) => setParam("add", open ? "1" : null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);

    try {
      /** The donors, with the new columns if the database has them. */
      const readDonors = async (): Promise<{ rows: DonorRow[]; extended: boolean }> => {
        const full = await supabase.from("donors").select(EXTENDED_COLUMNS).order("name", { ascending: true });
        if (!full.error) return { rows: (full.data ?? []) as DonorRow[], extended: true };
        if (!isMissingColumnError(full.error)) {
          console.error("Error loading donors", full.error);
          return { rows: [], extended: true };
        }
        const base = await supabase.from("donors").select(BASE_COLUMNS).order("name", { ascending: true });
        if (base.error) console.error("Error loading donors", base.error);
        return { rows: (base.data ?? []) as DonorRow[], extended: false };
      };

      const [donorRead, { data: agentRows, error: agentError }] = await Promise.all([
        readDonors(),
        supabase.from("agents").select("id, name").order("name", { ascending: true }),
      ]);

      setDonors(donorRead.rows);
      setExtended(donorRead.extended);

      if (agentError) {
        console.error("Error loading agents", agentError);
        setAgents([]);
      } else {
        setAgents((agentRows ?? []) as Agent[]);
      }

      const donorIds = donorRead.rows.map((d) => d.id);

      const balanceRead = await loadDonorBalances(donorIds);
      setBalances(balanceRead.data);
      setMoneyAvailable(balanceRead.available);

      // Students supported and the last scholarship date still come from the
      // old awards table: it is the one every donor's history is in until the
      // copy into scholarships has run.
      if (donorIds.length > 0) {
        const { data: awardRows, error: awardError } = await supabase
          .from("scholarship_awards")
          .select("donor_id, student_id, period_start, period_end, payment_date")
          .in("donor_id", donorIds);

        if (awardError) {
          console.error("Error loading scholarship awards for donors", awardError);
          setStatsByDonor({});
        } else {
          const temp: Record<string, { studentIds: Set<string>; last: string | null }> = {};
          (awardRows ?? []).forEach((row: any) => {
            const donorId = row.donor_id as string | null;
            if (!donorId) return;
            temp[donorId] ??= { studentIds: new Set<string>(), last: null };
            if (row.student_id) temp[donorId].studentIds.add(row.student_id as string);
            const dateStr: string | null = row.payment_date || row.period_end || row.period_start || null;
            if (dateStr && (!temp[donorId].last || new Date(dateStr) > new Date(temp[donorId].last as string))) {
              temp[donorId].last = dateStr;
            }
          });

          const stats: Record<string, DonorStats> = {};
          Object.entries(temp).forEach(([donorId, value]) => {
            stats[donorId] = { donorId, studentCount: value.studentIds.size, lastAwardDate: value.last };
          });
          setStatsByDonor(stats);
        }
      } else {
        setStatsByDonor({});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = (donor: CreatedDonor) => {
    setAdding(false);
    setHighlightId(donor.id);
    void load(true);
    notifications.show({
      color: "green",
      title: `${donor.name || "Donor"} added`,
      message: (
        <Anchor component="button" type="button" size="sm" onClick={() => navigate(`/admin/donors/${donor.id}`)}>
          Open donor
        </Anchor>
      ),
    });
    if (!donor.extended) {
      notifications.show({ color: "yellow", title: "Saved without some fields", message: DONOR_FIELDS_PENDING_NOTE, autoClose: false });
    }
  };

  const agentNameById = (id: string | null | undefined) => {
    if (!id) return null;
    return agents.find((agent) => agent.id === id)?.name ?? null;
  };

  // Flatten the JSON contact blob, the balance and the stats into sortable,
  // filterable columns.
  const rows = donors.map((d) => {
    const c = (d.contact ?? {}) as DonorContact;
    const stats = statsByDonor[d.id];
    const balance = balances.get(d.id);
    const type = extended ? (d.donor_type === "organisation" ? "organisation" : "individual") : null;
    const country = extended ? d.country ?? null : null;
    // Phones are checked against the donor's country, or as Thai where the
    // country column doesn't exist yet (the old rule). A stored number that
    // doesn't pass is one the migration couldn't clean up.
    const phoneCountry = extended ? country : "TH";
    const phone = c.phone?.trim() || null;
    const phoneBad = Boolean(phone) && normalisePhone(phone ?? "", phoneCountry) === null;
    const free = balance?.free_balance_thb ?? 0;
    return {
      id: d.id,
      name: d.name,
      type,
      typeLabel: type === "organisation" ? "Organisation" : "Individual",
      contactPerson: d.contact_person?.trim() || null,
      country,
      countryLabel: country ? countryName(country) : NOT_RECORDED,
      email: c.email?.trim() || null,
      phone,
      phoneDisplay: phone ? (phoneBad ? phone : displayPhone(phone, phoneCountry)) : null,
      phoneBad,
      given: balance?.total_given_thb ?? 0,
      free,
      freeLabel: free > 0 ? "Has money" : free < 0 ? "More allocated than given" : "Fully allocated",
      // A donor whose free balance will not cover next month's commitments.
      // Fires before the shortfall bites rather than after a student's funding
      // has already lapsed.
      short: balance ? !balance.covers_next_month : false,
      shortfall: balance?.shortfall_next_month_thb ?? 0,
      lastPayment: balance?.last_received_on ?? null,
      agent: agentNameById(c.agent_id) ?? "No agent",
      studentCount: stats?.studentCount ?? 0,
      lastAward: stats?.lastAwardDate ?? null,
    };
  });

  const phoneBadCount = rows.filter((r) => r.phoneBad).length;
  const anyEntryFilter = balanceFilter || Boolean(typeFilter) || Boolean(countryFilter) || phoneFilter;

  const visibleRows = rows.filter(
    (r) =>
      (!balanceFilter || r.free > 0) &&
      (!typeFilter || r.type === typeFilter) &&
      (!countryFilter || r.country === countryFilter) &&
      (!phoneFilter || r.phoneBad),
  );

  // The KPIs describe every donor, not the filtered few: they answer "is
  // anything wrong across all donors?" before a row is read.
  const kpis: TableKpi[] = (() => {
    const supporting = rows.filter((r) => r.studentCount > 0).length;
    const students = rows.reduce((sum, r) => sum + r.studentCount, 0);
    const given = rows.reduce((sum, r) => sum + r.given, 0);
    const unallocated = rows.reduce((sum, r) => sum + Math.max(0, r.free), 0);
    return [
      { label: "Donors", value: rows.length, footnote: "on record", mark: "donors" },
      { label: "Actively giving", value: supporting, footnote: "support a student", mark: "ontrack" },
      { label: "Students supported", value: students, footnote: "across all donors", mark: "students" },
      // The number this page exists to surface: money that has arrived and is
      // not yet doing anything.
      {
        label: "Unallocated",
        value: moneyAvailable ? formatCurrency(unallocated) : NOT_RECORDED,
        footnote: moneyAvailable ? `of ${formatCurrency(given)} given` : "Funding isn't set up yet",
        mark: "accounts",
      },
      {
        label: "Short next month",
        value: moneyAvailable ? rows.filter((r) => r.short).length : NOT_RECORDED,
        footnote: "can't cover their commitments",
        mark: "overdue",
      },
    ];
  })();

  type Row = (typeof rows)[number];

  const columns: DataColumn<Row>[] = [
    {
      key: "name",
      label: "Name",
      width: 220,
      render: (d) => (
        <div>
          <Text size="sm">{d.name?.trim() || "Anonymous donor"}</Text>
          {d.type === "organisation" && (
            <Text size="xs" c="dimmed">
              {d.contactPerson ? `Contact: ${d.contactPerson}` : "No contact person"}
            </Text>
          )}
        </div>
      ),
    },
    ...(extended
      ? ([
          {
            key: "typeLabel",
            label: "Type",
            width: 140,
            filterValue: (d: Row) => d.typeLabel,
            render: (d: Row) => (
              <Badge tone={d.type === "organisation" ? "info" : "neutral"}>{d.typeLabel}</Badge>
            ),
          },
          {
            key: "countryLabel",
            label: "Country",
            width: 150,
            filterValue: (d: Row) => d.countryLabel,
          },
        ] as DataColumn<Row>[])
      : []),
    {
      key: "email",
      label: "Contact",
      width: 230,
      filterable: false,
      render: (d) => (
        <div>
          <Text size="sm">{d.email || "No email"}</Text>
          <Text size="xs" c={d.phoneBad ? "orange" : "dimmed"}>
            {d.phoneDisplay ? (d.phoneBad ? `${d.phoneDisplay} · needs fixing` : d.phoneDisplay) : "No phone"}
          </Text>
        </div>
      ),
    },
    { key: "studentCount", label: "Students supported", align: "right", numeric: true, width: 160 },
    {
      key: "given",
      label: "Given",
      align: "right",
      numeric: true,
      width: 120,
      filterable: false,
      render: (d) => (moneyAvailable ? formatCurrency(d.given) : NOT_RECORDED),
    },
    {
      // Sorted to the top by default when present: the point of an alert is
      // that somebody does not have to go looking for it.
      key: "short",
      label: "Next month",
      width: 170,
      sortValue: (d) => (d.short ? 0 : 1),
      filterValue: (d) => (d.short ? "Short" : "Covered"),
      render: (d) => {
        if (!moneyAvailable) return NOT_RECORDED;
        if (!d.short) return <Text size="sm" c="dimmed">Covered</Text>;
        // Amber and worded. "Short for next month" says what is wrong; an
        // amber dot says only that something is.
        return <Badge tone="warning">Short {formatCurrency(d.shortfall)}</Badge>;
      },
    },
    {
      key: "free",
      label: "Unallocated",
      align: "right",
      numeric: true,
      width: 150,
      filterValue: (d) => d.freeLabel,
      render: (d) => {
        if (!moneyAvailable) return NOT_RECORDED;
        // More allocated than given is a state somebody has to act on, so it
        // is a badge rather than a negative number in a column of positives.
        if (d.free < 0) return <Badge tone="danger">Over by {formatCurrency(Math.abs(d.free))}</Badge>;
        if (d.free === 0) return <Text size="sm" c="dimmed">Fully allocated</Text>;
        return <Text size="sm" fw={500}>{formatCurrency(d.free)}</Text>;
      },
    },
    {
      // "When did money last arrive" is the question this list is scanned for.
      key: "lastPayment",
      label: "Last payment",
      width: 150,
      muted: true,
      filterable: false,
      sortValue: (d) => d.lastPayment ?? "",
      render: (d) => (d.lastPayment ? formatDate(d.lastPayment) : "No payments yet"),
    },
    { key: "agent", label: "Agent", width: 160 },
    {
      key: "lastAward",
      label: "Last scholarship",
      width: 160,
      muted: true,
      filterable: false,
      render: (d) => (d.lastAward ? formatDate(d.lastAward) : "None yet"),
    },
    {
      key: "actions",
      label: "",
      // 12px of left padding + a 28px icon + 8px trailing, as the students list.
      width: 48,
      pin: "right",
      pad: "0 var(--sp-2) 0 var(--sp-3)",
      sortable: false,
      filterable: false,
      render: (d) => (
        <div className={styles.rowActions} onClick={(event) => event.stopPropagation()}>
          <Menu position="bottom-end" withinPortal shadow="md" width={210}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${d.name?.trim() || "this donor"}`}>
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {/* Recorded over the list, so a bank statement can be worked
                  through one line after another without opening each donor. */}
              <Menu.Item
                leftSection={<IconCoins size={16} />}
                disabled={!moneyAvailable}
                onClick={() => setRecordFor({ id: d.id, name: d.name })}
              >
                Record payment
              </Menu.Item>
              <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => navigate(`/admin/donors/${d.id}?edit=1`)}>
                Edit donor
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconArrowRight size={16} />} onClick={() => navigate(`/admin/donors/${d.id}`)}>
                Open donor
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <PageHeader
        title="Donors"
        subtitle="Everyone funding a scholarship, and who looks after them."
        actions={<LumenButton variant="primary" icon="plus" onClick={() => setAdding(true)}>Add donor</LumenButton>}
      />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={visibleRows}
        controls={
          <>
            {/* Named and removable, so a shorter list always says why. */}
            {balanceFilter && <Tag onRemove={() => setParam("balance", null)}>Has unallocated money</Tag>}
            {typeFilter && (
              <Tag onRemove={() => setParam("type", null)}>
                {typeFilter === "organisation" ? "Organisations" : "Individuals"}
              </Tag>
            )}
            {countryFilter && <Tag onRemove={() => setParam("country", null)}>{countryName(countryFilter)}</Tag>}
            {phoneFilter ? (
              <Tag onRemove={() => setParam("phone", null)}>Phone needs fixing</Tag>
            ) : (
              phoneBadCount > 0 && (
                <LumenButton variant="secondary" size="sm" onClick={() => setParam("phone", "invalid")}>
                  Phone needs fixing ({phoneBadCount})
                </LumenButton>
              )
            )}
          </>
        }
        onRowClick={(d) => navigate(`/admin/donors/${d.id}`)}
        highlightRowId={highlightId}
        emptyTitle={anyEntryFilter ? "No donors match this filter" : "No donors yet"}
        emptyDescription={
          anyEntryFilter ? "Remove the filter above to see every donor." : "Add a donor to start recording scholarships."
        }
        emptyIcon="users"
        emptyAction={
          anyEntryFilter ? undefined : (
            <LumenButton variant="secondary" icon="plus" onClick={() => setAdding(true)}>
              Add donor
            </LumenButton>
          )
        }
      />

      <DonorFormDrawer opened={adding} onClose={() => setAdding(false)} onCreated={handleCreated} />

      {recordFor && (
        <ContributionDrawer
          opened
          onClose={() => setRecordFor(null)}
          donorId={recordFor.id}
          donorName={recordFor.name}
          contribution={null}
          onSaved={() => {
            // The row's Given, Unallocated and Last payment update in place.
            setHighlightId(recordFor.id);
            setRecordFor(null);
            void load(true);
          }}
        />
      )}
    </Stack>
  );
};

export default AdminDonorsPage;
