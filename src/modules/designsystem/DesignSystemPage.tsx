// src/modules/designsystem/DesignSystemPage.tsx
//
// Live reference for the Lumen design system — a port of design-system.html from
// https://claude.ai/design/p/354c0197-0167-45a3-95d9-0eac77d9e4b4
//
// Every value on this page is a CSS custom property from design-system/lumen/tokens.css.
// Never hard-code a hex here; if a colour is missing, add the token.

import React from "react";
import { CountrySelect, PhoneInput, phoneMessage, phoneProblem } from "../../design-system";
import {
  Badge,
  Banner,
  Button,
  Checkbox,
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
  Radio,
  Select,
  SideNav,
  Switch,
  Tabs,
  Tag,
  TileCard,
  Toast,
  Tooltip,
  TopBar,
  type BadgeTone,
  type DataColumn,
  type SortState,
} from "../../design-system/lumen";

/* ------------------------------------------------------------- page helpers */

/**
 * Country and phone, wired together as the donor form uses them. Lives here so
 * the pair can be tried without an account: this page is development-only.
 */
const DonorContactDemo: React.FC = () => {
  const [country, setCountry] = React.useState<string | null>("TH");
  const [phone, setPhone] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const problem = touched ? phoneProblem(phone, country) : null;

  return (
    <div
      data-testid="donor-contact-demo"
      style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", width: "100%" }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <CountrySelect id="demo-country" value={country} onChange={setCountry} />
      </div>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <PhoneInput
          id="demo-phone"
          value={phone}
          country={country}
          onChange={setPhone}
          onBlur={() => setTouched(true)}
          error={phoneMessage(problem, country)}
        />
      </div>
    </div>
  );
};

const Section: React.FC<{
  id: string;
  title: string;
  note?: string;
  children?: React.ReactNode;
}> = ({ id, title, note, children }) => (
  <section id={id} style={{ padding: "0 0 56px" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
      <h2 style={{ fontSize: "var(--fs-h1)", lineHeight: "var(--lh-h1)" }}>{title}</h2>
      {note && <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-subtle)" }}>{note}</span>}
    </div>
    {children}
  </section>
);

const Row: React.FC<{
  label: string;
  align?: "center" | "flex-start";
  children?: React.ReactNode;
}> = ({ label, children, align = "center" }) => (
  <div
    style={{
      display: "flex",
      alignItems: align,
      gap: 16,
      padding: "12px 0",
      borderTop: "1px solid var(--border-subtle)",
    }}
  >
    <span
      style={{
        width: 132,
        flex: "0 0 auto",
        fontSize: "var(--fs-xs)",
        fontFamily: "var(--font-mono)",
        color: "var(--text-subtle)",
        paddingTop: align === "flex-start" ? 6 : 0,
      }}
    >
      {label}
    </span>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 }}>
      {children}
    </div>
  </div>
);

const Panel: React.FC<{ pad?: number | string; children?: React.ReactNode }> = ({
  children,
  pad = 24,
}) => (
  <div
    style={{
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius)",
      boxShadow: "var(--shadow-card)",
      padding: pad,
    }}
  >
    {children}
  </div>
);

const Swatch: React.FC<{ token: string; name: string }> = ({ token, name }) => (
  <div style={{ flex: 1, minWidth: 84 }}>
    <div
      style={{
        height: 56,
        borderRadius: "var(--radius)",
        background: "var(" + token + ")",
        border: "1px solid rgba(33,30,27,.08)",
      }}
    />
    <div
      style={{
        marginTop: 7,
        fontSize: "var(--fs-xs)",
        fontWeight: "var(--fw-semibold)" as unknown as number,
        color: "var(--text-heading)",
      }}
    >
      {name}
    </div>
    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-subtle)" }}>
      {token.replace("--", "")}
    </div>
  </div>
);

const Ramp: React.FC<{ title: string; tokens: [string, string][] }> = ({ title, tokens }) => (
  <div style={{ marginBottom: 22 }}>
    <div
      style={{
        fontSize: "var(--fs-sm)",
        fontWeight: "var(--fw-semibold)" as unknown as number,
        marginBottom: 10,
      }}
    >
      {title}
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      {tokens.map((t) => (
        <Swatch key={t[0]} token={t[0]} name={t[1]} />
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------- sample data */

interface GrantRow {
  id: number;
  code: string;
  partner: string;
  region: string;
  status: "Disbursed" | "Pending" | "Overdue";
  amount: string;
  due: string;
}

const grantRows: GrantRow[] = [
  {
    id: 1,
    code: "GR-2048",
    partner: "Rural Water Trust",
    region: "Eastern",
    status: "Disbursed",
    amount: "412,000",
    due: "12 Mar 2026",
  },
  {
    id: 2,
    code: "GR-2051",
    partner: "Shanti Health Collective",
    region: "Northern",
    status: "Pending",
    amount: "96,500",
    due: "28 Mar 2026",
  },
  {
    id: 3,
    code: "GR-2063",
    partner: "Anwar Education Fund",
    region: "Eastern",
    status: "Overdue",
    amount: "240,750",
    due: "02 Feb 2026",
  },
  {
    id: 4,
    code: "GR-2077",
    partner: "Coastal Livelihoods",
    region: "Southern",
    status: "Disbursed",
    amount: "88,200",
    due: "19 Apr 2026",
  },
];

const TONE: Record<GrantRow["status"], BadgeTone> = {
  Disbursed: "success",
  Pending: "warning",
  Overdue: "danger",
};

const grantCols: DataColumn<GrantRow>[] = [
  { key: "code", label: "Grant ID", mono: true, width: 108 },
  { key: "partner", label: "Partner", width: 210 },
  { key: "region", label: "Region" },
  {
    key: "status",
    label: "Status",
    render: (r) => (
      <Badge tone={TONE[r.status]} dot>
        {r.status}
      </Badge>
    ),
  },
  { key: "amount", label: "Amount (USD)", align: "right", numeric: true },
  { key: "due", label: "Next milestone", muted: true },
];

const NAV: [string, string][] = [
  ["foundations", "Foundations"],
  ["colour", "Colour"],
  ["type", "Typography"],
  ["space", "Space & shape"],
  ["core", "Core controls"],
  ["forms", "Forms"],
  ["status", "Status"],
  ["data", "Data"],
  ["navigation", "Navigation"],
  ["feedback", "Feedback"],
  ["layout", "Layout"],
];

/* -------------------------------------------------------------------- page */

export const DesignSystemPage: React.FC = () => {
  const [sel, setSel] = React.useState<React.Key[]>([2]);
  const [sort, setSort] = React.useState<SortState | null>({ key: "amount", dir: "desc" });
  const [filters, setFilters] = React.useState<Record<string, string[]>>({});
  const [check, setCheck] = React.useState(true);
  const [radio, setRadio] = React.useState("a");
  const [sw, setSw] = React.useState(true);
  const [tab, setTab] = React.useState("all");
  const [dialog, setDialog] = React.useState(false);
  const [active, setActive] = React.useState("foundations");

  React.useEffect(() => {
    const sc = document.getElementById("scroller");
    if (!sc) return;
    const onScroll = () => {
      let cur = NAV[0][0];
      NAV.forEach(([id]) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 140) cur = id;
      });
      setActive(cur);
    };
    sc.addEventListener("scroll", onScroll);
    return () => sc.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="lumen" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <aside
        style={{
          width: 232,
          flex: "0 0 auto",
          padding: "28px 16px",
          background: "var(--surface-nav)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 10px 20px" }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "var(--radius)",
              background: "var(--blue-500)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "var(--fw-bold)" as unknown as number,
              fontSize: 13,
            }}
          >
            L
          </span>
          <span
            style={{ fontWeight: "var(--fw-semibold)" as unknown as number, color: "var(--text-heading)" }}
          >
            Lumen
          </span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={"#" + id}
              style={{
                padding: "8px 10px",
                borderRadius: "var(--radius)",
                fontSize: "var(--fs-sm)",
                textDecoration: "none",
                background: active === id ? "var(--nav-item-active)" : "transparent",
                boxShadow: active === id ? "var(--shadow-card)" : "none",
                color: active === id ? "var(--text-heading)" : "var(--text-muted)",
                fontWeight: (active === id
                  ? "var(--fw-medium)"
                  : "var(--fw-regular)") as unknown as number,
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div
        id="scroller"
        style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "0 10px 10px 0" }}
      >
        <div
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-panel)",
            margin: "10px 0 0",
            padding: "48px 48px 24px",
          }}
        >
          <PageHeader
            title="Lumen design system"
            description="Operational software for NGO grant, partner and finance teams. Spreadsheet-familiar tables, a rationed blue, and warm off-white chrome. Every value below is a CSS custom property — never hard-code a hex."
          />

          <div style={{ padding: "48px 0 0" }}>
            <Section id="foundations" title="Principles">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                <Panel>
                  <div style={{ fontWeight: "var(--fw-semibold)" as unknown as number, marginBottom: 6 }}>
                    The table is the product
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                    Users come from Excel. Sort, per-column filter, frozen first column, tabular figures —
                    everything else supports the grid.
                  </div>
                </Panel>
                <Panel>
                  <div style={{ fontWeight: "var(--fw-semibold)" as unknown as number, marginBottom: 6 }}>
                    Blue is rationed
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                    Only the primary button is filled, one per screen region — normally Add or Create.
                    Every other button is an outline, so the blue never has to compete.
                  </div>
                </Panel>
                <Panel>
                  <div style={{ fontWeight: "var(--fw-semibold)" as unknown as number, marginBottom: 6 }}>
                    One radius, one stroke
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                    Every box is 8px with a single 1px border. Every size is a multiple of 4. Shadows carry
                    no ring, and boxes are never nested inside boxes.
                  </div>
                </Panel>
              </div>
            </Section>

            <Section id="colour" title="Colour" note="design-system/lumen/tokens.css">
              <Panel>
                <Ramp
                  title="Primary — #072AC8, for the one most important action"
                  tokens={[
                    ["--blue-50", "50"],
                    ["--blue-100", "100"],
                    ["--blue-200", "200"],
                    ["--blue-300", "300"],
                    ["--blue-400", "400"],
                    ["--blue-500", "500"],
                    ["--blue-600", "600"],
                    ["--blue-700", "700"],
                    ["--blue-800", "800"],
                  ]}
                />
                <Ramp
                  title="Warm neutrals — every surface, border and text colour"
                  tokens={[
                    ["--n-0", "0"],
                    ["--n-50", "50"],
                    ["--n-100", "100"],
                    ["--n-200", "200"],
                    ["--n-300", "300"],
                    ["--n-400", "400"],
                    ["--n-500", "500"],
                    ["--n-600", "600"],
                    ["--n-700", "700"],
                    ["--n-800", "800"],
                    ["--n-900", "900"],
                  ]}
                />
                <Ramp
                  title="Status — meaning is fixed; a badge tone is a claim about state"
                  tokens={[
                    ["--green-500", "Success #00b37e"],
                    ["--amber-500", "Warning #ffab00"],
                    ["--red-500", "Danger #f25757"],
                    ["--teal-500", "Active #0fb5ba"],
                    ["--blue-500", "Info #072ac8"],
                    ["--n-400", "Neutral"],
                  ]}
                />
                <Ramp
                  title="Chart series — use in order, 1 through 8"
                  tokens={[
                    ["--chart-1", "1"],
                    ["--chart-2", "2"],
                    ["--chart-3", "3"],
                    ["--chart-4", "4"],
                    ["--chart-5", "5"],
                    ["--chart-6", "6"],
                    ["--chart-7", "7"],
                    ["--chart-8", "8"],
                  ]}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 8,
                    height: 72,
                    marginBottom: 22,
                  }}
                >
                  {[62, 88, 41, 74, 55, 30, 68, 47].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: h + "%",
                        borderRadius: "6px 6px 0 0",
                        background: "var(--chart-" + (i + 1) + ")",
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-semibold)" as unknown as number,
                    margin: "4px 0 10px",
                  }}
                >
                  Chrome surfaces
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Swatch token="--bg-app" name="Canvas / nav #f6f5f2" />
                  <Swatch token="--surface-rail" name="Icon rail #efedea" />
                  <Swatch token="--surface-card" name="Panel #ffffff" />
                  <Swatch token="--border-subtle" name="Border" />
                  <Swatch token="--action-neutral" name="Neutral action" />
                </div>
              </Panel>
            </Section>

            <Section
              id="type"
              title="Typography"
              note="Newsreader display · Figtree UI · IBM Plex Mono"
            >
              <Panel>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 400,
                    fontSize: 44,
                    lineHeight: "52px",
                    letterSpacing: "-.01em",
                  }}
                >
                  Where your funding is going
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-subtle)",
                    marginTop: 6,
                    marginBottom: 22,
                  }}
                >
                  --font-display · Newsreader 400 · 44/52 — overview and landing headings only
                </div>
                {(
                  [
                    ["Heading 24/30", 600, 24],
                    ["Subhead 19/26", 600, 19],
                    ["Section 16/22", 600, 16],
                    ["Body 14/21", 400, 14],
                    ["Small 13/19", 400, 13],
                    ["Micro 11/15", 500, 11],
                  ] as [string, number, number][]
                ).map(([l, w, s]) => (
                  <div
                    key={l}
                    style={{ display: "flex", alignItems: "baseline", gap: 18, padding: "7px 0" }}
                  >
                    <span
                      style={{
                        width: 120,
                        flex: "0 0 auto",
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-subtle)",
                      }}
                    >
                      {l}
                    </span>
                    <span style={{ fontSize: s, fontWeight: w, letterSpacing: "-.015em" }}>
                      Disbursements by district
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    gap: 40,
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-subtle)",
                        marginBottom: 6,
                      }}
                    >
                      tabular-nums, always on
                    </div>
                    <div
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                        lineHeight: "20px",
                      }}
                    >
                      1,482,900.00
                      <br />
                      94,110.50
                      <br />
                      7,204.75
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-subtle)",
                        marginBottom: 6,
                      }}
                    >
                      --font-mono, for IDs
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: "20px" }}>
                      GR-2048-EA
                      <br />
                      PRT-00913
                      <br />
                      DIS-4471
                    </div>
                  </div>
                </div>
              </Panel>
            </Section>

            <Section id="space" title="Space & shape">
              <Panel>
                <div
                  style={{
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-semibold)" as unknown as number,
                    marginBottom: 12,
                  }}
                >
                  Spacing scale
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 26 }}>
                  {["4px", "8px", "12px", "16px", "20px", "24px", "32px", "40px", "48px", "64px", "80px"].map(
                    (v) => (
                      <div
                        key={v}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: v,
                            height: v,
                            background: "var(--blue-100)",
                            border: "1px solid var(--blue-200)",
                            borderRadius: 3,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-subtle)",
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)" as unknown as number,
                        marginBottom: 12,
                      }}
                    >
                      Radius — one value, 8px
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {["Panel", "Card", "Button", "Input", "Dialog"].map((n) => (
                        <div key={n} style={{ flex: 1 }}>
                          <div
                            style={{
                              height: 46,
                              background: "var(--n-50)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <div style={{ fontSize: 10, marginTop: 6, color: "var(--text-subtle)" }}>
                            {n}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)" as unknown as number,
                        marginBottom: 12,
                      }}
                    >
                      Elevation
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {(
                        [
                          ["card", "var(--shadow-card)"],
                          ["panel", "var(--shadow-panel)"],
                          ["raised", "var(--shadow-raised)"],
                          ["overlay", "var(--shadow-overlay)"],
                        ] as [string, string][]
                      ).map(([n, v]) => (
                        <div key={n} style={{ flex: 1 }}>
                          <div
                            style={{
                              height: 46,
                              background: "#fff",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius)",
                              boxShadow: v,
                            }}
                          />
                          <div style={{ fontSize: 10, marginTop: 6, color: "var(--text-subtle)" }}>
                            {n}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            </Section>

            <Section id="core" title="Core controls" note="Button · IconButton">
              <Panel pad="4px 24px 20px">
                <Row label="variants">
                  <Button variant="primary" icon="plus">
                    Add grant
                  </Button>
                  <Button variant="secondary" icon="bookmark">
                    Save view
                  </Button>
                  <Button variant="secondary" icon="download">
                    Export
                  </Button>
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="danger" icon="trash-2">
                    Delete
                  </Button>
                  <Button variant="secondary" disabled>
                    Disabled
                  </Button>
                </Row>
                <Row label="sizes">
                  <Button size="sm" variant="secondary">
                    Small 28
                  </Button>
                  <Button size="md" variant="secondary">
                    Medium 36
                  </Button>
                  <Button size="lg" variant="secondary">
                    Large 44
                  </Button>
                </Row>
                <Row label="icon buttons">
                  <IconButton icon="settings-2" label="Columns" tone="bordered" />
                  <IconButton icon="filter" label="Filter" active />
                  <IconButton icon="ellipsis" label="More" />
                  <IconButton icon="trash-2" label="Delete" />
                  <IconButton icon="pencil" label="Edit" size="sm" />
                </Row>
              </Panel>
            </Section>

            <Section
              id="forms"
              title="Forms"
              note="Input · Field · Select · Checkbox · Radio · Switch"
            >
              <Panel pad="4px 24px 20px">
                <Row label="fields" align="flex-start">
                  <div style={{ width: 230 }}>
                    <Field label="Search">
                      <Input icon="search" placeholder="Grants, partners…" fullWidth />
                    </Field>
                  </div>
                  <div style={{ width: 170 }}>
                    <Field label="Fiscal year">
                      <Select fullWidth options={["FY 2026", "FY 2025"]} />
                    </Field>
                  </div>
                  <div style={{ width: 190 }}>
                    <Field label="Amount" error="Must be above 0">
                      <Input invalid defaultValue="0" fullWidth />
                    </Field>
                  </div>
                  <div style={{ width: 170 }}>
                    <Field label="Start date" hint="Agreement date">
                      <Input type="date" defaultValue="2026-09-01" fullWidth />
                    </Field>
                  </div>
                </Row>
                <Row label="toggles">
                  <Checkbox checked={check} label="Include closed" onChange={setCheck} />
                  <Checkbox indeterminate label="Partial" />
                  <Checkbox label="Unchecked" />
                  <Checkbox disabled label="Disabled" />
                </Row>
                <Row label="choice">
                  <Radio name="d" checked={radio === "a"} label="Compact" onChange={() => setRadio("a")} />
                  <Radio name="d" checked={radio === "b"} label="Default" onChange={() => setRadio("b")} />
                  <Radio name="d" checked={radio === "c"} label="Relaxed" onChange={() => setRadio("c")} />
                  <Switch checked={sw} label="Only my portfolio" onChange={setSw} />
                </Row>
                <Row label="donor contact" align="flex-start">
                  <DonorContactDemo />
                </Row>
              </Panel>
            </Section>

            <Section id="status" title="Status" note="Badge · Tag">
              <Panel pad="4px 24px 20px">
                <Row label="badges">
                  <Badge tone="success" dot>
                    Disbursed
                  </Badge>
                  <Badge tone="warning" dot>
                    Pending
                  </Badge>
                  <Badge tone="danger" dot>
                    Overdue
                  </Badge>
                  <Badge tone="info">In review</Badge>
                  <Badge>Draft</Badge>
                </Row>
                <Row label="accents">
                  <Badge tone="teal">Field visit</Badge>
                  <Badge tone="plum">Multi-year</Badge>
                  <Badge tone="orange">Renewal</Badge>
                  <Badge tone="pink">Co-funded</Badge>
                </Row>
                <Row label="tags">
                  <Tag onRemove={() => {}}>Region: Eastern</Tag>
                  <Tag onRemove={() => {}}>FY 2026</Tag>
                  <Tag>Read-only</Tag>
                </Row>
              </Panel>
            </Section>

            <Section
              id="data"
              title="Data"
              note="DataTable · ColumnFilter · FilterBar · KpiCard · Pagination · EmptyState"
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 14,
                  marginBottom: 16,
                }}
              >
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
              <Panel>
                <div style={{ marginBottom: 14 }}>
                  <FilterBar
                    controls={<Select size="md" options={["FY 2026", "FY 2025"]} />}
                    applied={[{ id: "r", label: "Region: Eastern" }]}
                    actions={
                      <Button variant="primary" icon="plus">
                        Add grant
                      </Button>
                    }
                  />
                </div>
                <div
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                  }}
                >
                  <DataTable
                    columns={grantCols}
                    rows={grantRows}
                    density="default"
                    selected={sel}
                    onSelectedChange={setSel}
                    sort={sort}
                    onSortChange={setSort}
                    filters={filters}
                    onFiltersChange={setFilters}
                    maxHeight={260}
                    bare
                  />
                  <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <Pagination page={1} pageCount={12} total={584} />
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <EmptyState
                    icon="filter"
                    title="No grants match these filters"
                    description="Clear a column filter or widen the date range."
                    action={<Button variant="secondary">Clear filters</Button>}
                    compact
                  />
                </div>
              </Panel>
            </Section>

            <Section id="navigation" title="Navigation" note="IconRail · SideNav · TopBar · Tabs">
              <div
                style={{
                  height: 340,
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--bg-app)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                }}
              >
                <TopBar
                  workspace="Aid Collective"
                  breadcrumbs={["Programmes", "Grants"]}
                  title="Active grants"
                  meta="(584)"
                  notifications={3}
                  user="AK"
                />
                <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                  <IconRail
                    brand="L"
                    activeId="grants"
                    items={[
                      { id: "home", icon: "house", label: "Overview" },
                      { id: "grants", icon: "hand-coins", label: "Grants", badge: 5 },
                      { id: "partners", icon: "users", label: "Partners" },
                      { id: "reports", icon: "chart-no-axes-column", label: "Reports" },
                    ]}
                    footer={[
                      { id: "search", icon: "search", label: "Search" },
                      { id: "settings", icon: "settings", label: "Settings" },
                    ]}
                  />
                  <SideNav
                    workspace="East Africa portfolio"
                    activeId="g-active"
                    modules={[
                      { id: "overview", label: "Overview", icon: "house" },
                      { id: "s1", section: "Programmes" },
                      {
                        id: "grants",
                        label: "Grants",
                        icon: "hand-coins",
                        children: [
                          { id: "g-active", label: "Active grants", badge: "584" },
                          { id: "g-pipeline", label: "Pipeline" },
                        ],
                      },
                      {
                        id: "partners",
                        label: "Partners",
                        icon: "users",
                        children: [{ id: "p-all", label: "All partners" }],
                      },
                      { id: "field", label: "Field reports", icon: "clipboard-list", badge: "12" },
                    ]}
                  />
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      margin: "0 10px 10px 0",
                      background: "#fff",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius)",
                      padding: "14px 20px",
                    }}
                  >
                    <Tabs
                      value={tab}
                      onChange={setTab}
                      tabs={[
                        { value: "all", label: "All grants", count: 584 },
                        { value: "mine", label: "My portfolio", count: 62 },
                        { value: "flag", label: "Overdue", count: 9 },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </Section>

            <Section id="feedback" title="Feedback" note="Banner · Toast · Tooltip · Dialog">
              <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
                <Banner
                  tone="warning"
                  title="12 rows need review"
                  action={
                    <Button size="sm" variant="secondary">
                      Review
                    </Button>
                  }
                >
                  Amounts imported from the March sheet don&apos;t match the ledger.
                </Banner>
                <Banner tone="info">
                  Column filters apply to the current view only. Save the view to keep them.
                </Banner>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Toast tone="success" title="Grant added" description="GR-2048 saved to Active grants." />
                  <Toast
                    tone="danger"
                    title="Export failed"
                    description="Try again or reduce the row count."
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8 }}>
                    <Tooltip label="Disbursed to date">
                      <Icon name="info" size={16} color="var(--text-subtle)" />
                    </Tooltip>
                    <Button variant="secondary" onClick={() => setDialog(true)}>
                      Open dialog
                    </Button>
                  </div>
                </div>
                <Dialog
                  open={dialog}
                  title="Add grant"
                  description="Creates a draft. Nothing is disbursed until the agreement is signed."
                  onClose={() => setDialog(false)}
                  footer={
                    <>
                      <Button onClick={() => setDialog(false)}>Cancel</Button>
                      <Button variant="primary">Add grant</Button>
                    </>
                  }
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Partner" required>
                      <Input fullWidth icon="search" placeholder="Search partners" />
                    </Field>
                    <Field label="Region">
                      <Select fullWidth options={["Eastern", "Northern"]} />
                    </Field>
                  </div>
                </Dialog>
              </div>
            </Section>

            <Section id="layout" title="Layout" note="AppShell · PageHeader · Checklist · TileCard">
              <Panel>
                <Checklist
                  title="Get set up"
                  progress="2 / 6 steps"
                  expandedId="a"
                  onExpand={() => {}}
                  items={[
                    {
                      id: "a",
                      title: "Connect your grants ledger",
                      description:
                        "Import the master sheet once and amounts reconcile against disbursements automatically.",
                      action: (
                        <Button variant="secondary" icon="upload">
                          Import sheet
                        </Button>
                      ),
                    },
                    { id: "b", title: "Invite your programme officers", done: true },
                    { id: "c", title: "Set reporting milestones per grant" },
                  ]}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 14,
                    marginTop: 20,
                  }}
                >
                  <TileCard
                    title="Due diligence"
                    description="Six partners need renewed documentation."
                    meta="Review"
                    media={
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "var(--radius)",
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
                    title="Budget variance"
                    description="Three programmes are tracking over plan."
                    meta="Open"
                    media={
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "var(--radius)",
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
                  <TileCard
                    title="Field reports"
                    description="12 reports are past their milestone date."
                    meta="Chase"
                    media={
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "var(--radius)",
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
                </div>
              </Panel>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignSystemPage;
