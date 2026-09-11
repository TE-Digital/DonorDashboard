// src/modules/admin/dashboard/ProvinceTable.tsx
//
// Where the work is, ranked by what is missing.
//
// This reads schools.province -- a real column as of the school-location
// migration -- and nothing else. It deliberately does not fall back to the
// derived province in schoolProfile.ts: that value is split out of a free-text
// address and, failing that, generated from the row id, and a funding ranking
// drawn from generated data is worse than no ranking, because somebody
// allocates money against it.
//
// A school whose province nobody has entered is its own row, named as such. It
// is not folded into a neighbouring province and it is not dropped.
//
// On a phone the table becomes cards. A six-column money table at 375px is a
// horizontal scroll that nobody performs.

import React from "react";
import { SectionCard, formatCurrency, formatNumber } from "../../../design-system";
import { Badge, DataTable, type DataColumn } from "../../../design-system/lumen";
import { PROVINCE_UNRECORDED, type ProvinceRow } from "../dashboardMetrics";
import styles from "./Dashboard.module.scss";

export interface ProvinceTableProps {
  rows: ProvinceRow[];
  onOpenProvince: (province: string) => void;
}

type Row = ProvinceRow & { id: string };

export const ProvinceTable: React.FC<ProvinceTableProps> = ({ rows, onOpenProvince }) => {
  const data: Row[] = rows.map((row) => ({ ...row, id: row.province }));

  const columns: DataColumn<Row>[] = [
    {
      key: "province",
      label: "Province",
      pin: "left",
      width: 200,
      sortable: true,
      render: (row) =>
        row.province === PROVINCE_UNRECORDED ? (
          <span style={{ color: "var(--text-muted)" }}>{row.province}</span>
        ) : (
          row.province
        ),
    },
    { key: "schools", label: "Schools", numeric: true, align: "right", sortable: true, width: 90 },
    { key: "students", label: "Students", numeric: true, align: "right", sortable: true, width: 96 },
    {
      key: "monthlyCoveredThb",
      label: "Covered / month",
      numeric: true,
      align: "right",
      sortable: true,
      width: 150,
      render: (row) => formatCurrency(row.monthlyCoveredThb),
    },
    {
      key: "monthlyGapThb",
      label: "Gap / month",
      numeric: true,
      align: "right",
      sortable: true,
      width: 140,
      render: (row) =>
        row.monthlyGapThb > 0 ? (
          <span style={{ color: "var(--status-danger)", fontWeight: 600 }}>
            {formatCurrency(row.monthlyGapThb)}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>{formatCurrency(0)}</span>
        ),
    },
    {
      key: "needUnknown",
      label: "Need not recorded",
      numeric: true,
      align: "right",
      sortable: true,
      width: 160,
      render: (row) =>
        row.needUnknown > 0 ? <Badge tone="neutral">{row.needUnknown}</Badge> : <span>0</span>,
    },
  ];

  return (
    <SectionCard
      title="Where we work"
      description="Provinces ranked by monthly funding gap."
      gap="sm"
    >
      {rows.length === 0 ? (
        <p className={styles.headlineNote}>No schools recorded yet.</p>
      ) : (
        <>
          <div className={styles.desktopOnly}>
            <DataTable
              columns={columns}
              rows={data}
              selectable={false}
              density="compact"
              onRowClick={(row) => onOpenProvince(row.province)}
            />
          </div>

          <div className={`${styles.mobileOnly} ${styles.provinceCards}`}>
            {rows.map((row) => (
              <button
                key={row.province}
                type="button"
                className={styles.provinceCard}
                onClick={() => onOpenProvince(row.province)}
              >
                <span className={styles.provinceCardHead}>
                  <span className={styles.provinceName}>{row.province}</span>
                  {row.monthlyGapThb > 0 && (
                    <span className={styles.provinceGap}>
                      {formatCurrency(row.monthlyGapThb)} short each month
                    </span>
                  )}
                </span>
                <span className={styles.provinceMeta}>
                  {formatNumber(row.students)} students · {formatNumber(row.schools)} schools ·{" "}
                  {formatCurrency(row.monthlyCoveredThb)} covered
                  {row.needUnknown > 0 && ` · ${formatNumber(row.needUnknown)} need not recorded`}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
};

export default ProvinceTable;
