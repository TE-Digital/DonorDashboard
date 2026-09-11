// src/modules/admin/AdminDashboardPage.tsx
//
// The admin's front page: read it before you decide, export it when somebody
// asks how the programme is doing.
//
// What this replaced was eight counts of rows and four Add buttons. Every one
// of the counts was a full stop -- seeing "7 overdue reports" gave no way to
// reach those seven -- and the first thing on the page, for an admin arriving
// to understand the operation, was four ways to create more of it.
//
// Three rules hold this page together:
//
//   Every number is a door. Each figure links to the list it counted, filtered
//   to exactly those rows, through the query parameters the directories read.
//
//   The page says what its numbers exclude. "Committed", never "spent", because
//   nothing writes scholarship_payments. The gap carries the count of students
//   whose need nobody has recorded, because a gap that silently drops them
//   looks smaller than the real one.
//
//   It is a report, not a console. No record is created from here. Actions
//   appear only when there is a queue, and vanish when there is not.
//
// Every number on the page comes from dashboardMetrics.ts, so this file decides
// what is shown and never what it means.

import React, { useEffect, useMemo, useState } from "react";
import { Stack } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { HeroSection } from "../../components/HeroSection";
import {
  InlineMessage,
  KpiRow,
  LoadingState,
  PageHeader,
  formatCurrency,
  formatNumber,
  type KpiItem,
} from "../../design-system";
import { Button } from "../../design-system/lumen";
import styles from "./dashboard/Dashboard.module.scss";
import { TodayRail } from "./dashboard/TodayRail";
import { FundingSummaryBand } from "./dashboard/FundingSummaryBand";
import { FundingTrendChart } from "./dashboard/FundingTrendChart";
import { ProvinceTable } from "./dashboard/ProvinceTable";
import {
  downloadDashboardCsv,
  loadDashboardMetrics,
  loadTodayItems,
  PROVINCE_UNRECORDED,
  type DashboardMetrics,
  type TodayItem,
} from "./dashboardMetrics";

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [today, setToday] = useState<TodayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const next = await loadDashboardMetrics();
        if (!cancelled) {
          setMetrics(next);
          setLoadError(null);
        }

        // The rail is second because it depends on the funding figures for the
        // idle-money item, and because the page is readable without it.
        const items = await loadTodayItems(next.funding, next.operation.openRequests);
        if (!cancelled) setToday(items);
      } catch (error) {
        console.error("Error loading dashboard", error);
        // A read that fails is said out loud. An empty dashboard that looks
        // like a quiet month is the one failure mode worth going out of our
        // way to avoid.
        if (!cancelled) {
          setLoadError("We couldn't load the dashboard. Check your connection and try again.");
        }
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The operation band.
   *
   * Same subjects the old KPI row named, minus the two that only described the
   * data. Each tile carries the filter its number stands for, so the count and
   * the list behind it cannot disagree.
   */
  const operationTiles: KpiItem[] = useMemo(() => {
    if (!metrics) return [];
    const { operation } = metrics;

    return [
      {
        label: "Students enrolled",
        value: formatNumber(operation.students),
        mark: "students",
        footnote: "in school now",
        onClick: () => navigate("/admin/students"),
      },
      {
        label: "Schools",
        value: formatNumber(operation.schools),
        mark: "schools",
        footnote: `${metrics.provinces.filter((row) => row.province !== PROVINCE_UNRECORDED).length} provinces`,
        onClick: () => navigate("/admin/schools"),
      },
      {
        label: "Teachers",
        value: formatNumber(operation.teachers),
        mark: "teachers",
        footnote: "reporting",
        onClick: () => navigate("/admin/teachers"),
      },
      {
        label: "Donors",
        value: formatNumber(operation.donors),
        mark: "donors",
        footnote: "giving",
        onClick: () => navigate("/admin/donors"),
      },
      {
        label: "Active scholarships",
        value: formatNumber(operation.activeScholarships),
        mark: "ontrack",
        footnote: "running now",
        onClick: () => navigate("/admin/scholarships"),
      },
    ];
  }, [metrics, navigate]);

  const handleExport = () => {
    if (!metrics) return;
    setExporting(true);
    setExportError(null);
    try {
      downloadDashboardCsv(metrics);
    } catch (error) {
      console.error("Dashboard export failed", error);
      setExportError("We couldn't create the export. Try again in a minute.");
    }
    setExporting(false);
  };

  if (loading) return <LoadingState />;

  if (loadError || !metrics) {
    return (
      <Stack>
        <HeroSection />
        <PageHeader title="Dashboard" />
        <InlineMessage tone="error">
          {loadError ?? "We couldn't load the dashboard. Check your connection and try again."}
        </InlineMessage>
      </Stack>
    );
  }

  return (
    <Stack>
      <HeroSection />

      <PageHeader
        title="Dashboard"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Preparing export…" : "Export dashboard"}
          </Button>
        }
      />

      {exportError && <InlineMessage tone="error">{exportError}</InlineMessage>}

      {!metrics.moneyAvailable && (
        <InlineMessage tone="warning">
          Donor funding isn't set up yet, so every money figure below reads zero. Real
          balances appear here once it is.
        </InlineMessage>
      )}

      {/*
        Two columns on a wide screen, one on a narrow one.

        The KPI band leads: the counts are the orienting glance, and they tell
        you the size of the thing the money figures are about -- an uncovered
        ฿112,800 means one thing across twenty students and another across a
        hundred and forty. Money second, because it is the question the admin
        arrived to decide rather than the first thing needed to read the page.

        The rail is last in the DOM and repositioned by CSS: on a phone it
        comes first visually, because a small screen shows one thing at a time
        and the actionable thing should be it.
      */}
      <div className={styles.shell}>
        <div className={styles.shellMain}>
          <div className={styles.bandCounts}>
            <KpiRow columns={5} items={operationTiles} />
          </div>

          <div className={styles.bandMoney}>
            <FundingSummaryBand
              funding={metrics.funding}
              year={year}
              onOpenUncovered={() => navigate("/admin/students?focus=gap")}
              onOpenNeedUnknown={() => navigate("/admin/students?focus=need-unknown")}
              onOpenDonors={() => navigate("/admin/donors?balance=idle")}
            />
          </div>

          {metrics.operation.overdueReports > 0 && (
            <div className={styles.bandReports}>
              <KpiRow
                columns={2}
                items={[
                  {
                    label: "Reports overdue",
                    value: formatNumber(metrics.operation.overdueReports),
                    mark: "overdue",
                    footnote: "past the school's reporting period",
                    onClick: () => navigate("/admin/students?focus=overdue"),
                  },
                  {
                    label: "Awaiting verification",
                    value: formatNumber(metrics.operation.submittedReports),
                    mark: "reports",
                    footnote: "submitted, not yet sent to a donor",
                    onClick: () => navigate("/admin/reports-beta?status=submitted"),
                  },
                ]}
              />
            </div>
          )}

          <div className={styles.bandProvinces}>
            <ProvinceTable
              rows={metrics.provinces}
              onOpenProvince={(province) =>
                navigate(
                  province === PROVINCE_UNRECORDED
                    ? "/admin/schools?province=none"
                    : `/admin/schools?province=${encodeURIComponent(province)}`,
                )
              }
            />
          </div>

          <div className={styles.bandTrend}>
            <FundingTrendChart points={metrics.trend} />
          </div>
        </div>

        <div className={styles.bandRail}>
          <TodayRail items={today} />
        </div>
      </div>
    </Stack>
  );
};
