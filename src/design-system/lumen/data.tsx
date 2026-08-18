import React from "react";
import { Icon } from "./Icon";
import { Button, Checkbox, IconButton, Input, Select, Tag } from "./core";

/* ------------------------------------------------------------ Column model */

export interface DataColumn<R extends { id: React.Key } = any> {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "right" | "center";
  numeric?: boolean;
  mono?: boolean;
  muted?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  filterValue?: (row: R) => unknown;
  render?: (row: R) => React.ReactNode;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

/* -------------------------------------------------------------- ColumnFilter */

export interface ColumnFilterProps<R extends { id: React.Key } = any> {
  column: DataColumn<R>;
  rows?: R[];
  value?: string[];
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (values: string[]) => void;
  active?: boolean;
}

/** Excel-style per-column filter menu. */
export function ColumnFilter<R extends { id: React.Key }>({
  column,
  rows = [],
  value = [],
  open,
  onOpenChange,
  onChange,
  active,
}: ColumnFilterProps<R>) {
  const [q, setQ] = React.useState("");
  const anchor = React.useRef<HTMLSpanElement>(null);
  const [flip, setFlip] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    let box = anchor.current.parentElement;
    while (box && box !== document.body) {
      const ov = getComputedStyle(box).overflowX;
      if (ov === "auto" || ov === "scroll" || ov === "hidden") break;
      box = box.parentElement;
    }
    const edge = box && box !== document.body ? box.getBoundingClientRect().right : window.innerWidth;
    setFlip(anchor.current.getBoundingClientRect().left - 8 + 224 > edge - 8);
  }, [open]);

  const values = React.useMemo(() => {
    const seen: string[] = [];
    rows.forEach((r) => {
      const v = column.filterValue ? column.filterValue(r) : (r as any)[column.key];
      if (v != null && !seen.includes(String(v))) seen.push(String(v));
    });
    return seen.sort();
  }, [rows, column]);

  const shown = values.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <span ref={anchor} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        aria-label={"Filter " + column.label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          padding: 0,
          borderRadius: "var(--radius-xs)",
          border: "1px solid " + (active ? "var(--blue-200)" : "transparent"),
          background: active ? "var(--blue-50)" : open ? "var(--n-200)" : "transparent",
          color: active ? "var(--blue-600)" : "var(--n-500)",
          cursor: "pointer",
          transition: "var(--motion-hover)",
        }}
      >
        <Icon name={active ? "filter" : "list-filter"} size={12} />
      </button>
      {open && (
        <>
          <span onClick={() => onOpenChange(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              top: 24,
              left: flip ? "auto" : -8,
              right: flip ? -8 : "auto",
              zIndex: 41,
              width: 224,
              background: "var(--n-0)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-overlay)",
              padding: 12,
              textAlign: "left",
              font: "var(--fw-regular) var(--fs-sm)/var(--lh-sm) var(--font-core)",
              color: "var(--text-body)",
              letterSpacing: 0,
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={"Filter " + column.label.toLowerCase()}
              style={{
                width: "100%",
                height: 28,
                padding: "0 8px",
                font: "inherit",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                outline: "none",
                marginBottom: 8,
              }}
            />
            <div
              style={{
                maxHeight: 168,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "4px 0 8px",
              }}
            >
              {shown.length === 0 && (
                <span
                  style={{ color: "var(--text-subtle)", fontSize: "var(--fs-xs)", padding: "4px 2px" }}
                >
                  No matches
                </span>
              )}
              {shown.map((v) => (
                <Checkbox
                  key={v}
                  checked={value.includes(v)}
                  onChange={() => toggle(v)}
                  label={<span style={{ fontSize: "var(--fs-sm)" }}>{v}</span>}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: 12,
              }}
            >
              <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                Clear
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)}>
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- DataTable */

const ROW_H = {
  compact: "var(--row-h-compact)",
  default: "var(--row-h-default)",
  relaxed: "var(--row-h-relaxed)",
} as const;

export interface DataTableProps<R extends { id: React.Key } = any> {
  columns?: DataColumn<R>[];
  rows?: R[];
  /**
   * The rows a column filter menu should offer values from. Defaults to `rows`;
   * pass the unpaged, unfiltered set when the table shows one page at a time,
   * so the menu still lists every value rather than only what is on screen.
   */
  filterRows?: R[];
  density?: keyof typeof ROW_H;
  selectable?: boolean;
  stickyFirstColumn?: boolean;
  zebra?: boolean;
  selected?: React.Key[];
  onSelectedChange?: (next: React.Key[]) => void;
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;
  filters?: Record<string, string[]>;
  onFiltersChange?: (next: Record<string, string[]>) => void;
  onRowClick?: (row: R) => void;
  maxHeight?: number | string;
  bare?: boolean;
}

export function DataTable<R extends { id: React.Key }>({
  columns = [],
  rows = [],
  filterRows,
  density = "default",
  selectable = true,
  stickyFirstColumn = true,
  zebra = false,
  selected = [],
  onSelectedChange,
  sort,
  onSortChange,
  filters = {},
  onFiltersChange,
  onRowClick,
  maxHeight = 460,
  bare,
}: DataTableProps<R>) {
  const [hover, setHover] = React.useState<React.Key | null>(null);
  const [openFilter, setOpenFilter] = React.useState<string | null>(null);
  const h = ROW_H[density] || ROW_H.default;
  const allOn = rows.length > 0 && selected.length === rows.length;

  const toggleAll = () => onSelectedChange && onSelectedChange(allOn ? [] : rows.map((r) => r.id));
  const toggleOne = (id: React.Key) => {
    if (!onSelectedChange) return;
    onSelectedChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };
  const nextSort = (key: string) => {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, dir: "asc" });
    else if (sort.dir === "asc") onSortChange({ key, dir: "desc" });
    else onSortChange(null);
  };

  const selW = 40;
  const cell = (align?: string, num?: boolean): React.CSSProperties => ({
    padding: "0 16px",
    textAlign: (align as React.CSSProperties["textAlign"]) || "left",
    whiteSpace: "nowrap",
    fontVariantNumeric: num ? "tabular-nums" : undefined,
  });

  return (
    <div
      style={{
        position: "relative",
        overflow: "auto",
        maxHeight,
        border: bare ? "none" : "1px solid var(--border-subtle)",
        borderRadius: bare ? 0 : "var(--radius)",
        background: "var(--n-0)",
      }}
    >
      <table
        style={{
          width: "100%",
          fontSize: "var(--text-table)",
          lineHeight: "var(--lh-table)",
          minWidth: "max-content",
        }}
      >
        <thead>
          <tr>
            {selectable && (
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 4,
                  width: selW,
                  background: "var(--n-50)",
                  height: 40,
                  borderBottom: "1px solid var(--border-default)",
                  padding: "0 0 0 16px",
                }}
              >
                <Checkbox
                  checked={allOn}
                  indeterminate={selected.length > 0 && !allOn}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((c, i) => {
              const stick = stickyFirstColumn && i === 0;
              const active = !!sort && sort.key === c.key;
              const filtered = filters[c.key] && filters[c.key].length;
              return (
                <th
                  key={c.key}
                  style={{
                    position: "sticky",
                    top: 0,
                    left: stick ? (selectable ? selW : 0) : undefined,
                    zIndex: stick ? 4 : 3,
                    background: "var(--n-50)",
                    height: 40,
                    borderBottom: "1px solid var(--border-default)",
                    boxShadow: stick ? "var(--shadow-sticky)" : undefined,
                    fontWeight: "var(--fw-semibold)" as unknown as number,
                    color: "var(--text-muted)",
                    fontSize: "var(--fs-xs)",
                    letterSpacing: ".02em",
                    textAlign: c.align || "left",
                    width: c.width,
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "0 8px 0 16px",
                      justifyContent: c.align === "right" ? "flex-end" : "flex-start",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => c.sortable !== false && nextSort(c.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        height: 40,
                        font: "inherit",
                        color: active ? "var(--text-heading)" : "inherit",
                        cursor: c.sortable === false ? "default" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                      {c.sortable !== false && (
                        <Icon
                          name={
                            active
                              ? sort!.dir === "asc"
                                ? "arrow-up"
                                : "arrow-down"
                              : "chevrons-up-down"
                          }
                          size={12}
                          color={active ? "var(--blue-600)" : "var(--n-400)"}
                        />
                      )}
                    </button>
                    {c.filterable !== false && (
                      <ColumnFilter
                        column={c}
                        rows={filterRows ?? rows}
                        open={openFilter === c.key}
                        value={filters[c.key] || []}
                        onOpenChange={(o) => setOpenFilter(o ? c.key : null)}
                        onChange={(vals) =>
                          onFiltersChange && onFiltersChange({ ...filters, [c.key]: vals })
                        }
                        active={!!filtered}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const on = selected.includes(r.id);
            const hov = hover === r.id;
            const bg = on
              ? "var(--surface-selected)"
              : hov
                ? "var(--n-25)"
                : zebra && ri % 2
                  ? "var(--n-25)"
                  : "var(--n-0)";
            return (
              <tr
                key={r.id}
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onRowClick && onRowClick(r)}
                style={{
                  height: h,
                  background: bg,
                  cursor: onRowClick ? "pointer" : "default",
                  transition: "background-color var(--dur-instant) var(--ease-standard)",
                }}
              >
                {selectable && (
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: bg,
                      width: selW,
                      padding: "0 0 0 16px",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Checkbox checked={on} onChange={() => toggleOne(r.id)} />
                  </td>
                )}
                {columns.map((c, i) => {
                  const stick = stickyFirstColumn && i === 0;
                  return (
                    <td
                      key={c.key}
                      style={{
                        ...cell(c.align, c.numeric),
                        height: h,
                        position: stick ? "sticky" : undefined,
                        left: stick ? (selectable ? selW : 0) : undefined,
                        zIndex: stick ? 2 : 1,
                        background: stick ? bg : undefined,
                        boxShadow: stick ? "var(--shadow-sticky)" : undefined,
                        borderBottom: "1px solid var(--border-subtle)",
                        color: c.muted ? "var(--text-muted)" : "var(--text-body)",
                        fontWeight: (stick
                          ? "var(--fw-medium)"
                          : "var(--fw-regular)") as unknown as number,
                        fontFamily: c.mono ? "var(--font-mono)" : undefined,
                      }}
                    >
                      {c.render ? c.render(r) : ((r as any)[c.key] as React.ReactNode)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  icon?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "inbox",
  title,
  description,
  action,
  compact,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      textAlign: "center",
      padding: compact ? "28px 16px" : "56px 24px",
    }}
  >
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "var(--radius-md)",
        background: "var(--n-50)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-subtle)",
      }}
    >
      <Icon name={icon} size={18} />
    </span>
    <div
      style={{
        fontSize: "var(--fs-h3)",
        fontWeight: "var(--fw-semibold)" as unknown as number,
        color: "var(--text-heading)",
      }}
    >
      {title}
    </div>
    {description && (
      <div
        style={{
          fontSize: "var(--fs-sm)",
          color: "var(--text-muted)",
          maxWidth: 380,
          textWrap: "pretty",
        }}
      >
        {description}
      </div>
    )}
    {action && <div style={{ marginTop: 4 }}>{action}</div>}
  </div>
);

/* ---------------------------------------------------------------- FilterBar */

export interface AppliedFilter {
  id: React.Key;
  label: React.ReactNode;
}

export interface FilterBarProps {
  search?: string;
  onSearchChange?: React.ChangeEventHandler<HTMLInputElement>;
  controls?: React.ReactNode;
  applied?: AppliedFilter[];
  onRemove?: (filter: AppliedFilter) => void;
  onClearAll?: () => void;
  actions?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  controls,
  applied = [],
  onRemove,
  onClearAll,
  actions,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px", minWidth: 200 }}>
        <Input
          icon="search"
          size="md"
          fullWidth
          placeholder="Search"
          value={search}
          onChange={onSearchChange}
          ariaLabel="Search"
        />
      </div>
      {controls}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{actions}</div>
    </div>
    {applied.length > 0 && (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-subtle)", marginRight: 2 }}>
          Filters
        </span>
        {applied.map((a) => (
          <Tag key={a.id} onRemove={() => onRemove && onRemove(a)}>
            {a.label}
          </Tag>
        ))}
        <Button size="sm" variant="ghost" onClick={onClearAll}>
          Clear all
        </Button>
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ KpiCard */

export type KpiAccent = "blue" | "teal" | "amber" | "green" | "plum" | "orange" | "pink" | "neutral";

const KPI_ACCENTS: Record<KpiAccent, string> = {
  blue: "var(--blue-500)",
  teal: "var(--teal-500)",
  amber: "var(--amber-500)",
  green: "var(--green-500)",
  plum: "var(--plum-500)",
  orange: "var(--orange-500)",
  pink: "var(--pink-500)",
  neutral: "var(--n-400)",
};

export interface KpiCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: React.ReactNode;
  deltaLabel?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  accent?: KpiAccent;
  footnote?: React.ReactNode;
  /** Joins the KPI into the flat, shared-border strip used above data tables. */
  strip?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  trend = "flat",
  accent = "blue",
  footnote,
  strip = false,
}) => {
  const tone =
    trend === "up" ? "var(--green-700)" : trend === "down" ? "var(--red-500)" : "var(--text-subtle)";
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderTop: strip ? `3px solid ${KPI_ACCENTS[accent] || KPI_ACCENTS.blue}` : undefined,
        borderRadius: strip ? 3 : "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        minHeight: strip ? 116 : undefined,
        padding: strip ? 20 : 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: strip ? 8 : 8 }}>
        {!strip && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: KPI_ACCENTS[accent] || KPI_ACCENTS.blue,
              flex: "0 0 auto",
            }}
          />
        )}
        <span
          style={{
            fontSize: strip ? 11 : "var(--fs-xs)",
            color: strip ? "var(--text-subtle)" : "var(--text-muted)",
            fontWeight: "var(--fw-medium)" as unknown as number,
            letterSpacing: strip ? "0.075em" : undefined,
            textTransform: strip ? "uppercase" : undefined,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
        <span
          style={{
            fontSize: strip ? 26 : "var(--fs-h1)",
            lineHeight: strip ? 1.16 : "var(--lh-h1)",
            fontWeight: "var(--fw-semibold)" as unknown as number,
            letterSpacing: "var(--ls-tight)",
            color: "var(--text-heading)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        {unit && <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{unit}</span>}
      </div>
      {(delta || footnote) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: strip ? 8 : 12,
            fontSize: 11,
            color: "var(--text-subtle)",
          }}
        >
          {delta && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: tone,
                fontWeight: "var(--fw-medium)" as unknown as number,
              }}
            >
              {delta}
            </span>
          )}
          <span>{deltaLabel || footnote}</span>
        </div>
      )}
    </div>
  );
};

/* --------------------------------------------------------------- Pagination */

export interface PaginationProps {
  page?: number;
  pageCount?: number;
  pageSize?: number;
  total?: number;
  pageSizes?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page = 1,
  pageCount = 1,
  pageSize = 50,
  total,
  pageSizes = [25, 50, 100, 250],
  onPageChange,
  onPageSizeChange,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "8px 12px",
      fontSize: "var(--fs-xs)",
      color: "var(--text-muted)",
    }}
  >
    <span>{total != null ? total.toLocaleString() + " rows" : ""}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span>Rows per page</span>
      <Select
        size="sm"
        value={String(pageSize)}
        options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
        onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
      />
      <span style={{ margin: "0 4px" }}>
        Page {page} of {pageCount}
      </span>
      <IconButton
        icon="chevron-left"
        size="sm"
        label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange && onPageChange(page - 1)}
      />
      <IconButton
        icon="chevron-right"
        size="sm"
        label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange && onPageChange(page + 1)}
      />
    </div>
  </div>
);
