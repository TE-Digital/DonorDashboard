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
  /**
   * Holds this column still while the rest of the table scrolls sideways.
   *
   * Identity on the left, status on the right, reference data scrolling in
   * between: a wide table stays readable because the two columns that tell you
   * *which row this is* and *what you must do about it* never leave the screen.
   *
   * A pinned column needs a numeric `width` — the offsets are arithmetic, and
   * "auto" is not a number. Pinning more than about a third of the table's
   * width leaves nothing to scroll and is worse than not pinning at all.
   */
  pin?: "left" | "right";
  /**
   * Overrides the standard cell padding for this column alone.
   *
   * For the rare pair of columns whose contents belong to each other — a status
   * and the row menu that acts on it — where the default gutters put more air
   * between them than the meaning allows.
   */
  pad?: string;
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

  /**
   * Where each pinned column sits, in pixels from its edge.
   *
   * Left offsets accumulate in column order after the checkbox; right offsets
   * accumulate backwards from the right edge. `stickyFirstColumn` still works
   * on a table with no explicit pins, so nothing that already used it changes.
   */
  /**
   * The width each pinned column actually got, measured from its header cell.
   *
   * `width` on a `<th>` is a hint, not an instruction: the browser widens a
   * column whose content does not fit, and it distributes leftover space. Offsets
   * computed from the declared numbers therefore drift from the real layout, and
   * two pinned columns end up stacked on the same edge — which is exactly what a
   * 150px column rendering at 180px does to the 40px menu beside it.
   *
   * So the declared width is only the first-paint estimate; from the first
   * layout onward the offsets come from measurement.
   */
  const headCells = React.useRef(new Map<string, HTMLTableCellElement>());
  const [measured, setMeasured] = React.useState<Record<string, number>>({});

  React.useLayoutEffect(() => {
    const read = () => {
      const next: Record<string, number> = {};
      headCells.current.forEach((element, key) => {
        next[key] = element.getBoundingClientRect().width;
      });

      // Only re-render when something really moved. Sub-pixel jitter from a
      // scrollbar appearing would otherwise loop the observer forever.
      setMeasured((current) => {
        const keys = Object.keys(next);
        const unchanged =
          keys.length === Object.keys(current).length &&
          keys.every((key) => Math.abs((current[key] ?? -1) - next[key]) < 0.5);
        return unchanged ? current : next;
      });
    };

    read();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    headCells.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [columns, selectable, rows.length]);

  const pinned = React.useMemo(() => {
    const left = new Map<string, number>();
    const right = new Map<string, number>();
    const DEFAULT_W = 140;
    const widthOf = (c: DataColumn<R>) =>
      measured[c.key] ?? (typeof c.width === "number" ? c.width : DEFAULT_W);

    let cursor = selectable ? selW : 0;
    columns.forEach((c) => {
      if (c.pin !== "left") return;
      left.set(c.key, cursor);
      cursor += widthOf(c);
    });

    cursor = 0;
    [...columns].reverse().forEach((c) => {
      if (c.pin !== "right") return;
      right.set(c.key, cursor);
      cursor += widthOf(c);
    });

    const lefts = columns.filter((c) => c.pin === "left");
    const rights = columns.filter((c) => c.pin === "right");

    return {
      left,
      right,
      /** The edge columns carry the shadow that says "more scrolls past here". */
      lastLeft: lefts.length ? lefts[lefts.length - 1].key : null,
      firstRight: rights.length ? rights[0].key : null,
      any: lefts.length > 0 || rights.length > 0,
    };
  }, [columns, selectable, measured]);

  /**
   * Everything one cell needs to hold its position, header and body alike.
   *
   * `stickyFirstColumn` is ignored the moment a table pins anything explicitly:
   * mixing the two would silently stick a second column nobody asked for.
   */
  const pinStyle = (c: DataColumn<R>, index: number, background: string): React.CSSProperties => {
    const legacy = !pinned.any && stickyFirstColumn && index === 0;
    const leftOffset = c.pin === "left" ? pinned.left.get(c.key) : legacy ? (selectable ? selW : 0) : undefined;
    const rightOffset = c.pin === "right" ? pinned.right.get(c.key) : undefined;

    if (leftOffset === undefined && rightOffset === undefined) return {};

    return {
      position: "sticky",
      left: leftOffset,
      right: rightOffset,
      background,
      boxShadow:
        c.key === pinned.lastLeft || legacy
          ? "var(--shadow-sticky)"
          : c.key === pinned.firstRight
            ? "var(--shadow-sticky-left, var(--shadow-sticky))"
            : undefined,
    };
  };

  const cell = (align?: string, num?: boolean, pad?: string): React.CSSProperties => ({
    padding: pad ?? "0 var(--sp-2)",
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
                  height: 36,
                  borderBottom: "1px solid var(--border-default)",
                  padding: "0 0 0 var(--sp-3)",
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
              const pin = pinStyle(c, i, "var(--n-50)");
              const stuck = pin.position === "sticky";
              const active = !!sort && sort.key === c.key;
              const filtered = filters[c.key] && filters[c.key].length;
              return (
                <th
                  key={c.key}
                  ref={(element) => {
                    if (element) headCells.current.set(c.key, element);
                    else headCells.current.delete(c.key);
                  }}
                  style={{
                    ...pin,
                    // A pinned header is stuck both ways at once: to the top of
                    // the scroll box, and to its own edge.
                    position: "sticky",
                    top: 0,
                    zIndex: stuck ? 4 : 3,
                    background: "var(--n-50)",
                    height: 36,
                    borderBottom: "1px solid var(--border-default)",
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
                      padding: c.pad ?? "0 var(--sp-2) 0 var(--sp-3)",
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
                        height: 36,
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
                      padding: "0 0 0 var(--sp-3)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Checkbox checked={on} onChange={() => toggleOne(r.id)} />
                  </td>
                )}
                {columns.map((c, i) => {
                  const pin = pinStyle(c, i, bg);
                  const stuck = pin.position === "sticky";
                  return (
                    <td
                      key={c.key}
                      style={{
                        ...cell(c.align, c.numeric, c.pad),
                        ...pin,
                        height: h,
                        zIndex: stuck ? 2 : 1,
                        borderBottom: "1px solid var(--border-subtle)",
                        color: c.muted ? "var(--text-muted)" : "var(--text-body)",
                        fontWeight: (c.pin === "left" || (stuck && i === 0)
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
      {onSearchChange && (
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
      )}
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

// The mark tile: the lightest step of the family behind the glyph, and a step
// dark enough to hold its own on it. Amber and teal need a deeper glyph than
// their 500 to stay legible on their own tint.
const KPI_TINTS: Record<KpiAccent, string> = {
  blue: "var(--blue-25)",
  teal: "var(--teal-50)",
  amber: "var(--amber-50)",
  green: "var(--green-50)",
  plum: "var(--plum-50)",
  orange: "var(--orange-50)",
  pink: "var(--pink-50)",
  neutral: "var(--n-100)",
};

const KPI_MARKS: Record<KpiAccent, string> = {
  blue: "var(--blue-500)",
  teal: "var(--teal-600)",
  amber: "var(--amber-700)",
  green: "var(--green-600)",
  plum: "var(--plum-500)",
  orange: "var(--orange-600)",
  pink: "var(--pink-600)",
  neutral: "var(--n-600)",
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
  /**
   * The glyph in the tinted tile. Its subject is what the accent colour means
   * on a strip KPI — same metric, same mark, on every screen.
   */
  icon?: string;
  /** The product KPI tile: mark on the left, value and label on the right. */
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
  icon,
  strip = false,
}) => {
  const tone =
    trend === "up" ? "var(--green-700)" : trend === "down" ? "var(--red-500)" : "var(--text-subtle)";

  const meta = (delta || footnote) && (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginTop: strip ? 2 : 8,
        fontSize: 11,
        lineHeight: "15px",
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
  );

  // The product tile: one line. Mark, then value, label and footnote running on
  // together — a KPI reads as a sentence, not a stacked block. The footnote is
  // the only part allowed to truncate, so the number and its name always show.
  if (strip) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: "100%",
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-card)",
          padding: "var(--sp-2) var(--sp-3)",
        }}
      >
        {icon && (
          <span
            style={{
              display: "inline-flex",
              flex: "0 0 auto",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "var(--radius)",
              background: KPI_TINTS[accent] || KPI_TINTS.blue,
              color: KPI_MARKS[accent] || KPI_MARKS.blue,
            }}
          >
            <Icon name={icon} size={18} strokeWidth={1.5} />
          </span>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            minWidth: 0,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              flex: "0 0 auto",
              fontSize: 18,
              lineHeight: "24px",
              fontWeight: "var(--fw-semibold)" as unknown as number,
              letterSpacing: "var(--ls-tight)",
              color: "var(--text-heading)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </span>
          {unit && (
            <span style={{ flex: "0 0 auto", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
              {unit}
            </span>
          )}
          <span
            style={{
              flex: "0 0 auto",
              fontSize: "var(--fs-sm)",
              lineHeight: "var(--lh-sm)",
              color: "var(--text-muted)",
            }}
          >
            {label}
          </span>
          {(delta || footnote) && (
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "var(--fs-xs)",
                lineHeight: "var(--lh-xs)",
                color: "var(--text-subtle)",
              }}
            >
              <span style={{ color: "var(--border-default)", padding: "0 2px" }}>·</span>
              {delta && (
                <span
                  style={{
                    color: tone,
                    fontWeight: "var(--fw-medium)" as unknown as number,
                    paddingRight: 3,
                  }}
                >
                  {delta}
                </span>
              )}
              {deltaLabel || footnote}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        padding: "var(--sp-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: KPI_ACCENTS[accent] || KPI_ACCENTS.blue,
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--text-muted)",
            fontWeight: "var(--fw-medium)" as unknown as number,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
        <span
          style={{
            fontSize: "var(--fs-h1)",
            lineHeight: "var(--lh-h1)",
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
      {meta}
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
