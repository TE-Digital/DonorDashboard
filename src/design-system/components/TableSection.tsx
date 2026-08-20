// src/design-system/components/TableSection.tsx
//
// The standard shape of a list screen in this product, taken straight from
// components/data/data.card.html in the design system:
//
//   KPI row  →  filter bar  →  bordered grid  →  pagination
//
// Everything a list page repeated by hand — per-column filters, sort, filter
// chips, paging, the empty case — lives here once. A page supplies columns,
// rows and its KPIs; it does not own any of that state.
//
// Finding a record by name is the global search's job (the top bar, ⌘K), not
// each table's: a per-table box only ever searched the page you already had
// open. What stays here is narrowing a list you are already looking at —
// column filters and sort.
//
// The grid is the design system's DataTable, so every column header carries a
// sort control and an Excel-style filter menu automatically.

import React from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  Pagination,
  type AppliedFilter,
  type DataColumn,
  type SortState,
} from "../lumen";
import { KpiRow, type KpiItem } from "./KpiRow";

/** The KPI band above a table is the same band detail screens use. */
export type TableKpi = KpiItem;

export interface TableSectionProps<R extends { id: React.Key }> {
  /** The KPI tiles above the grid. Every list screen carries a row of these. */
  kpis?: TableKpi[];
  columns: DataColumn<R>[];
  rows: R[];
  /** Selects and other narrow controls on the filter bar. */
  controls?: React.ReactNode;
  /**
   * Buttons on the right of the filter bar. At most ONE may be
   * `variant="primary"` — the blue is rationed to a single action per region.
   */
  actions?: React.ReactNode;
  onRowClick?: (row: R) => void;
  selectable?: boolean;
  /** Rendered above the grid when rows are selected. */
  bulkActions?: (selected: React.Key[], clear: () => void) => React.ReactNode;
  density?: "compact" | "default" | "relaxed";
  pageSize?: number;
  maxHeight?: number | string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: string;
}

const PAGE_SIZES = [25, 50, 100, 250];

export function TableSection<R extends { id: React.Key }>({
  kpis,
  columns,
  rows,
  controls,
  actions,
  onRowClick,
  selectable = false,
  bulkActions,
  density = "compact",
  pageSize: initialPageSize = 25,
  maxHeight = 560,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  emptyAction,
  emptyIcon = "inbox",
}: TableSectionProps<R>) {
  const [sort, setSort] = React.useState<SortState | null>(null);
  const [filters, setFilters] = React.useState<Record<string, string[]>>({});
  const [selected, setSelected] = React.useState<React.Key[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  // Column filters → sort. Paging happens last, so the count in the footer is
  // the size of the whole filtered set, not of the current page.
  const filtered = React.useMemo(() => {
    let out = rows;

    Object.entries(filters).forEach(([key, values]) => {
      if (values && values.length) {
        out = out.filter((r) => values.includes(String((r as any)[key] ?? "")));
      }
    });

    if (sort) {
      const { key, dir } = sort;
      const column = columns.find((c) => c.key === key);
      out = [...out].sort((a, b) => {
        const x = column?.filterValue ? column.filterValue(a) : (a as any)[key];
        const y = column?.filterValue ? column.filterValue(b) : (b as any)[key];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const c =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), undefined, { numeric: true });
        return dir === "asc" ? c : -c;
      });
    }

    return out;
  }, [rows, filters, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  // Every active column filter surfaces as a removable chip.
  const chips: (AppliedFilter & { columnKey: string; value: string })[] = Object.entries(
    filters,
  ).flatMap(([key, values]) =>
    (values || []).map((value) => ({
      id: key + ":" + value,
      columnKey: key,
      value,
      label: (columns.find((c) => c.key === key)?.label ?? key) + ": " + value,
    })),
  );

  const resetToFirstPage = () => setPage(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {kpis && kpis.length > 0 && <KpiRow items={kpis} />}

      {(controls || actions || chips.length > 0) && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            padding: "var(--sp-2) 0",
            background: "var(--surface-card)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <FilterBar
            controls={controls}
            applied={chips}
            onRemove={(c) => {
              const chip = c as (typeof chips)[number];
              setFilters((f) => ({
                ...f,
                [chip.columnKey]: (f[chip.columnKey] || []).filter((v) => v !== chip.value),
              }));
              resetToFirstPage();
            }}
            onClearAll={() => {
              setFilters({});
              resetToFirstPage();
            }}
            actions={actions}
          />
        </div>
      )}

      {selectable && selected.length > 0 && bulkActions && (
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
            style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-medium)" as unknown as number }}
          >
            {selected.length} selected
          </span>
          {bulkActions(selected, () => setSelected([]))}
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
        {filtered.length === 0 ? (
          <EmptyState
            icon={chips.length ? "filter" : emptyIcon}
            title={chips.length ? "No matches" : emptyTitle}
            description={
              chips.length
                ? "Clear a column filter to see more rows."
                : emptyDescription
            }
            action={
              chips.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilters({});
                    resetToFirstPage();
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                emptyAction
              )
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={visible}
            // Filter menus offer every value in the data set, not just the ones
            // that happen to be on the current page.
            filterRows={rows}
            density={density}
            selectable={selectable}
            selected={selected}
            onSelectedChange={setSelected}
            sort={sort}
            onSortChange={setSort}
            filters={filters}
            onFiltersChange={(f) => {
              setFilters(f);
              resetToFirstPage();
            }}
            onRowClick={onRowClick}
            maxHeight={maxHeight}
            bare
          />
        )}
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <Pagination
            page={current}
            pageCount={pageCount}
            pageSize={pageSize}
            pageSizes={PAGE_SIZES}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              resetToFirstPage();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default TableSection;
