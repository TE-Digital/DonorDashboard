// src/modules/designsystem/GrantsConsolePage.tsx
//
// The Lumen grants console — a faithful port of
// ui_kits/grants_console/grants.html from the Claude Design project
// https://claude.ai/design/p/354c0197-0167-45a3-95d9-0eac77d9e4b4
//
// Two screens behind one AppShell: Overview (checklist, attention tiles, KPI
// row) and Active grants (KPI row, tabs, filter bar, spreadsheet grid).
//
// Sorting and per-column filtering are built into DataTable itself: every
// column header carries a sort control and an Excel-style filter menu, and this
// page just holds the resulting `sort` / `filters` state and applies it to the
// rows. See design-system/lumen/data.tsx.

import React from "react";
import {
  Badge,
  Button,
  Checklist,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  FilterBar,
  Icon,
  IconButton,
  IconRail,
  Input,
  KpiCard,
  PageHeader,
  Pagination,
  Select,
  SideNav,
  Tabs,
  TileCard,
  Toast,
  TopBar,
  type AppliedFilter,
  type BadgeTone,
  type DataColumn,
  type NavModule,
  type RailItem,
  type SortState,
} from "../../design-system/lumen";

/* ------------------------------------------------------------------- data */

const railItems: RailItem[] = [
  { id: "home", icon: "house", label: "Overview" },
  { id: "grants", icon: "hand-coins", label: "Grants", badge: 5 },
  { id: "partners", icon: "users", label: "Partners" },
  { id: "reports", icon: "chart-no-axes-column", label: "Reports" },
  { id: "finance", icon: "banknote", label: "Finance" },
];

const railFooter: RailItem[] = [
  { id: "search", icon: "search", label: "Search  ⌘K" },
  { id: "settings", icon: "settings", label: "Settings" },
  { id: "profile", icon: "circle-user", label: "A. Kimani" },
];

const modules: NavModule[] = [
  { id: "overview", label: "Overview", icon: "house" },
  { id: "s-prog", section: "Programmes" },
  {
    id: "grants",
    label: "Grants",
    icon: "hand-coins",
    children: [
      { id: "g-active", label: "Active grants", badge: "584" },
      { id: "g-pipeline", label: "Pipeline", badge: "41" },
      { id: "g-closed", label: "Closed" },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    icon: "users",
    children: [
      { id: "p-all", label: "All partners" },
      { id: "p-due", label: "Due diligence", badge: "6" },
      { id: "p-agree", label: "Agreements" },
    ],
  },
  { id: "field", label: "Field reports", icon: "clipboard-list", badge: "12" },
  { id: "s-fin", section: "Finance" },
  { id: "disb", label: "Disbursements", icon: "banknote" },
  {
    id: "budgets",
    label: "Budgets",
    icon: "wallet",
    children: [
      { id: "b-year", label: "Annual plan" },
      { id: "b-var", label: "Variance" },
    ],
  },
  { id: "s-org", section: "Organisation" },
  { id: "people", label: "People", icon: "contact" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const partners = [
  "Rural Water Trust",
  "Shanti Health Collective",
  "Anwar Education Fund",
  "Coastal Livelihoods Union",
  "Highland Nutrition Project",
  "Terra Verde Cooperative",
  "Nabanna Womens Network",
  "Open Fields Initiative",
  "Sahel Seed Bank",
  "Little Lantern Schools",
  "Riverine Sanitation Group",
  "Mwanzo Youth Trust",
];
const regions = ["Eastern", "Northern", "Southern", "Western", "Central"];
const programmes = [
  "Water & Sanitation",
  "Primary Education",
  "Maternal Health",
  "Food Security",
  "Livelihoods",
];
const statuses = ["Disbursed", "Pending", "Overdue", "In review", "Draft"] as const;
const officers = ["A. Kimani", "R. Devarajan", "M. Osei", "L. Haddad", "S. Bergström"];

type Status = (typeof statuses)[number];

interface Grant {
  id: number;
  code: string;
  partner: string;
  programme: string;
  region: string;
  status: Status;
  amount: number;
  spent: number;
  officer: string;
  milestone: string;
  reports: string;
}

const grants: Grant[] = Array.from({ length: 34 }, (_, i) => {
  const amount = 24000 + ((i * 48731) % 620000);
  return {
    id: i + 1,
    code: "GR-" + (2040 + i * 3),
    partner: partners[i % partners.length],
    programme: programmes[(i * 2) % programmes.length],
    region: regions[(i * 3) % regions.length],
    status: statuses[(i * 4 + (i % 3)) % statuses.length],
    amount,
    spent: Math.round(amount * (0.18 + ((i * 7) % 70) / 100)),
    officer: officers[i % officers.length],
    milestone: ["12 Mar 2026", "28 Mar 2026", "02 Feb 2026", "19 Apr 2026", "30 Apr 2026", "08 May 2026"][
      i % 6
    ],
    reports: (i % 4) + "/4",
  };
});

const usd = (n: number) => "$" + n.toLocaleString("en-US");

const TONE: Record<Status, BadgeTone> = {
  Disbursed: "success",
  Pending: "warning",
  Overdue: "danger",
  "In review": "info",
  Draft: "neutral",
};

/* --------------------------------------------------------------- Overview */

const Overview: React.FC<{ go: (id: string) => void }> = ({ go }) => {
  const [open, setOpen] = React.useState<string | null>("ledger");
  return (
    <div style={{ paddingBottom: 56 }}>
      <PageHeader
        title="Where your funding is going this quarter"
        description="Six things to finish before the March disbursement run. Everything else can wait."
      />
      <div style={{ padding: "36px 48px 0", display: "flex", flexDirection: "column", gap: 44 }}>
        <Checklist
          title="Get set up"
          progress="2 / 6 steps"
          expandedId={open}
          onExpand={setOpen}
          items={[
            {
              id: "ledger",
              title: "Connect your grants ledger",
              description:
                "Import the master sheet once and amounts reconcile against disbursements automatically. Column mapping is remembered for next quarter.",
              action: (
                <Button variant="secondary" icon="upload">
                  Import sheet
                </Button>
              ),
            },
            { id: "team", title: "Invite your programme officers", done: true },
            { id: "partners", title: "Add partner organisations and agreements", done: true },
            {
              id: "milestones",
              title: "Set reporting milestones per grant",
              description:
                "Milestones drive the overdue-report count and the reminders partners receive.",
              action: <Button variant="secondary">Set milestones</Button>,
            },
            { id: "budget", title: "Approve the annual budget plan" },
            { id: "export", title: "Schedule the donor reporting export" },
          ]}
          media={
            <div
              style={{
                flex: 1,
                borderRadius: "var(--radius-lg)",
                background: "var(--n-50)",
                border: "1px dashed var(--border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: "var(--text-subtle)",
                fontSize: "var(--fs-xs)",
                padding: 16,
                minHeight: 240,
              }}
            >
              Image slot — product screenshot or partner photography
            </div>
          }
        />

        <div>
          <h2 style={{ fontSize: "var(--fs-h2)", lineHeight: "var(--lh-h2)", marginBottom: 14 }}>
            Needs attention
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <TileCard
              onClick={() => go("g-active")}
              title="12 field reports overdue"
              description="Eastern and Central partners have milestones past due this quarter."
              meta="Chase reports"
              media={
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "var(--radius-md)",
                    background: "var(--amber-50)",
                    color: "var(--amber-700)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="clipboard-list" size={17} />
                </span>
              }
            />
            <TileCard
              onClick={() => go("p-due")}
              title="6 partners need due diligence"
              description="Documentation expires before the next disbursement window."
              meta="Review partners"
              media={
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "var(--radius-md)",
                    background: "var(--teal-50)",
                    color: "var(--teal-700)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="users" size={17} />
                </span>
              }
            />
            <TileCard
              onClick={() => go("b-var")}
              title="3 programmes over plan"
              description="Food Security is tracking 11% above its approved annual budget."
              meta="Open variance"
              media={
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "var(--radius-md)",
                    background: "var(--plum-50)",
                    color: "var(--plum-700)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="wallet" size={17} />
                </span>
              }
            />
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: "var(--fs-h2)", lineHeight: "var(--lh-h2)", marginBottom: 14 }}>
            This quarter at a glance
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            <KpiCard
              label="Funds disbursed"
              value="$4.82M"
              delta="+6.4%"
              trend="up"
              deltaLabel="vs. last quarter"
              accent="teal"
            />
            <KpiCard
              label="Active grants"
              value="584"
              delta="+12"
              trend="up"
              deltaLabel="this month"
              accent="blue"
            />
            <KpiCard
              label="Awaiting report"
              value="37"
              delta="-4"
              trend="down"
              deltaLabel="since Friday"
              accent="amber"
            />
            <KpiCard label="Partners" value="126" footnote="across 9 regions" accent="plum" />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------- Grants */

const Grants: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState("all");
  const [sort, setSort] = React.useState<SortState | null>({ key: "amount", dir: "desc" });
  const [filters, setFilters] = React.useState<Record<string, string[]>>({});
  const [selected, setSelected] = React.useState<React.Key[]>([]);
  const [density, setDensity] = React.useState<"compact" | "default" | "relaxed">("default");

  // Sort and filter are declared per column and handled inside DataTable's
  // header; `sortable: false` opts a column out.
  const columns: DataColumn<Grant>[] = [
    { key: "code", label: "Grant ID", mono: true, width: 108 },
    { key: "partner", label: "Partner", width: 220 },
    { key: "programme", label: "Programme", width: 165 },
    { key: "region", label: "Region", width: 112 },
    {
      key: "status",
      label: "Status",
      width: 124,
      render: (r) => (
        <Badge tone={TONE[r.status]} dot>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "amount",
      label: "Awarded (USD)",
      align: "right",
      numeric: true,
      width: 132,
      render: (r) => usd(r.amount),
    },
    {
      key: "spent",
      label: "Disbursed (USD)",
      align: "right",
      numeric: true,
      width: 142,
      render: (r) => usd(r.spent),
    },
    { key: "reports", label: "Reports", align: "right", width: 90, muted: true, sortable: false },
    { key: "officer", label: "Programme officer", width: 165 },
    { key: "milestone", label: "Next milestone", width: 145, muted: true },
  ];

  let rows = grants.filter(
    (g) =>
      (view !== "mine" || g.officer === "A. Kimani") && (view !== "flag" || g.status === "Overdue"),
  );
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter((g) => (g.partner + g.code + g.programme).toLowerCase().includes(s));
  }
  Object.entries(filters).forEach(([k, vals]) => {
    if (vals && vals.length) rows = rows.filter((g) => vals.includes(String((g as any)[k])));
  });
  if (sort) {
    const { key, dir } = sort;
    rows = [...rows].sort((a, b) => {
      const x = (a as any)[key];
      const y = (b as any)[key];
      const c = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? c : -c;
    });
  }

  // Every active column filter surfaces as a removable chip above the grid.
  const chips: (AppliedFilter & { key: string; value: string })[] = Object.entries(filters).flatMap(
    ([k, vals]) =>
      (vals || []).map((v) => ({
        id: k + ":" + v,
        key: k,
        value: v,
        label: (columns.find((c) => c.key === k)?.label ?? k) + ": " + v,
      })),
  );

  const awarded = rows.reduce((s, r) => s + r.amount, 0);
  const disbursed = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        size="md"
        serif={false}
        title="Active grants"
        description={
          rows.length +
          " of 584 grants across 126 partners. Filter any column the way you would in a spreadsheet."
        }
        actions={
          <>
            <Button variant="secondary" icon="download">
              Export
            </Button>
            <Button variant="primary" icon="plus" onClick={onAdd}>
              Add grant
            </Button>
          </>
        }
      />
      <div style={{ padding: "26px 32px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          <KpiCard
            label="Awarded"
            value={usd(Math.round(awarded / 1000)) + "k"}
            delta="+6.4%"
            trend="up"
            deltaLabel="vs. last quarter"
            accent="blue"
          />
          <KpiCard
            label="Disbursed to date"
            value={usd(Math.round(disbursed / 1000)) + "k"}
            delta="+2.1%"
            trend="up"
            deltaLabel="vs. last quarter"
            accent="teal"
          />
          <KpiCard
            label="Awaiting report"
            value="37"
            delta="-4"
            trend="down"
            deltaLabel="since Friday"
            accent="amber"
          />
          <KpiCard label="Partners" value="126" footnote="across 9 regions" accent="plum" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: "all", label: "All grants", count: grants.length },
              {
                value: "mine",
                label: "My portfolio",
                count: grants.filter((g) => g.officer === "A. Kimani").length,
              },
              {
                value: "flag",
                label: "Overdue",
                count: grants.filter((g) => g.status === "Overdue").length,
              },
            ]}
          />

          <FilterBar
            search={q}
            onSearchChange={(e) => setQ(e.target.value)}
            controls={
              <>
                <Select size="md" options={["FY 2026", "FY 2025", "FY 2024"]} />
                <Select size="md" options={["All programmes", ...programmes]} />
                <Select
                  size="md"
                  value={density}
                  onChange={(e) => setDensity(e.target.value as typeof density)}
                  options={[
                    { value: "compact", label: "Compact rows" },
                    { value: "default", label: "Default rows" },
                    { value: "relaxed", label: "Relaxed rows" },
                  ]}
                />
              </>
            }
            applied={chips}
            onRemove={(c) => {
              const chip = c as (typeof chips)[number];
              setFilters((f) => ({
                ...f,
                [chip.key]: (f[chip.key] || []).filter((v) => v !== chip.value),
              }));
            }}
            onClearAll={() => setFilters({})}
            actions={
              <>
                <IconButton icon="settings-2" label="Column settings" tone="bordered" />
                <Button variant="secondary" icon="bookmark">
                  Save view
                </Button>
              </>
            }
          />

          {selected.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: "var(--blue-25)",
                border: "1px solid var(--blue-100)",
                borderRadius: "var(--radius)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--fs-sm)",
                  fontWeight: "var(--fw-medium)" as unknown as number,
                }}
              >
                {selected.length} selected
              </span>
              <Button size="sm" variant="secondary" icon="send">
                Request report
              </Button>
              <Button size="sm" variant="secondary" icon="banknote">
                Schedule disbursement
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          )}

          <div
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--surface-card)",
            }}
          >
            {rows.length === 0 ? (
              <EmptyState
                icon="filter"
                title="No grants match these filters"
                description="Clear a column filter or widen the fiscal year to see more rows."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilters({});
                      setQ("");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                density={density}
                selected={selected}
                onSelectedChange={setSelected}
                sort={sort}
                onSortChange={setSort}
                filters={filters}
                onFiltersChange={setFilters}
                maxHeight={440}
                bare
              />
            )}
            <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <Pagination page={1} pageCount={12} pageSize={50} total={584} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- app */

export const GrantsConsolePage: React.FC = () => {
  const [active, setActive] = React.useState("g-active");
  const [dialog, setDialog] = React.useState(false);
  const [toast, setToast] = React.useState(false);

  const isOverview = active === "overview" || active === "home";
  const crumbs = isOverview
    ? []
    : active.startsWith("p-")
      ? ["Programmes", "Partners"]
      : active.startsWith("b-")
        ? ["Finance", "Budgets"]
        : ["Programmes", "Grants"];
  const title = isOverview
    ? "Overview"
    : active === "p-due"
      ? "Due diligence"
      : active === "b-var"
        ? "Variance"
        : "Active grants";

  return (
    <div className="lumen" style={{ position: "relative", height: "100vh" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg-app)",
        }}
      >
        <TopBar
          workspace="Aid Collective"
          breadcrumbs={crumbs}
          title={title}
          meta={isOverview ? undefined : "(584)"}
          notifications={3}
          user="AK"
        />
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <IconRail
            brand="L"
            items={railItems}
            footer={railFooter}
            activeId={isOverview ? "home" : "grants"}
            onNavigate={(id) => setActive(id === "home" ? "overview" : "g-active")}
          />
          <SideNav
            workspace="East Africa portfolio"
            modules={modules}
            activeId={active}
            onNavigate={setActive}
            footer={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--fs-xs)",
                  color: "var(--text-subtle)",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: "var(--n-0)",
                    border: "1px solid var(--border-subtle)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                  }}
                >
                  AK
                </span>
                A. Kimani · Programme officer
              </div>
            }
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              padding: "0 10px 10px 0",
              gap: 10,
            }}
          >
            <main
              style={{
                flex: 1,
                minHeight: 0,
                background: "var(--surface-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-panel)",
                overflow: "auto",
              }}
            >
              {isOverview ? (
                <Overview go={setActive} />
              ) : (
                <Grants onAdd={() => setDialog(true)} />
              )}
            </main>
          </div>
        </div>
      </div>

      <Dialog
        open={dialog}
        title="Add grant"
        description="Creates a draft. Nothing is disbursed until the agreement is signed."
        width={540}
        onClose={() => setDialog(false)}
        footer={
          <>
            <Button onClick={() => setDialog(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setDialog(false);
                setToast(true);
                window.setTimeout(() => setToast(false), 3200);
              }}
            >
              Add grant
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Partner" required>
            <Input fullWidth icon="search" placeholder="Search partners" />
          </Field>
          <Field label="Programme">
            <Select fullWidth options={programmes} />
          </Field>
          <Field label="Region">
            <Select fullWidth options={regions} />
          </Field>
          <Field label="Awarded amount (USD)" hint="Excludes indirect cost recovery">
            <Input fullWidth defaultValue="120,000" />
          </Field>
          <Field label="Start date">
            <Input fullWidth type="date" defaultValue="2026-09-01" />
          </Field>
          <Field label="Programme officer">
            <Select fullWidth options={officers} />
          </Field>
        </div>
      </Dialog>

      {toast && (
        <div style={{ position: "absolute", right: 20, bottom: 20, zIndex: 70 }}>
          <Toast
            tone="success"
            title="Grant added"
            description="Draft saved to Active grants."
            onDismiss={() => setToast(false)}
          />
        </div>
      )}
    </div>
  );
};

export default GrantsConsolePage;
