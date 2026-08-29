// src/modules/donor/AllocationPanel.tsx
//
// Turning a donor's free balance into scholarships.
//
// The list is ranked by funding gap, not by name and not by when the student
// was added. That single choice is what the screen is for: an admin who has to
// already know who is short will fund whoever they remember, and the students
// nobody remembers are exactly the ones this list exists to surface. A student
// short by 800 THB a month sorts above one short by 200; a student whose need
// nobody has recorded sorts to the top too, because an unknown need is a
// question for somebody, not a settled zero.
//
// The balance at the top updates as amounts are typed, and is announced, so a
// keyboard user hears what is left rather than watching a number they cannot
// see change.

import React, { useEffect, useMemo, useState } from "react";
import { SimpleGrid, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  FormDrawer,
  FormFeedback,
  formatCurrency,
  parseDateInput,
  toDateInputValue,
} from "../../design-system";
import { Badge, Button, EmptyState, Input } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { CoverageBar, coverageSentence } from "./CoverageBar";
import {
  COVERAGE_META,
  coverageRank,
  coverageState,
  loadStudentCoverage,
  type DonorBalance,
  type StudentCoverage,
} from "./donorMoney";
import styles from "./AllocationPanel.module.scss";

export interface AllocationPanelProps {
  opened: boolean;
  onClose: () => void;
  donorId: string;
  donorName: string | null;
  balance: DonorBalance;
  /** Fired after the allocations are written, so the page reloads. */
  onAllocated: () => void;
}

interface Draft {
  amount: string;
  start: string;
  end: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/** A year from today, which is the coverage window a grant defaults to. */
const inAYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * How many months a coverage window spans, at least one.
 *
 * An open-ended window is treated as a year, which is what the coverage dates
 * default to and what a grant is renewed on.
 */
const monthsBetween = (start: string, end: string): number => {
  if (!start || !end) return 12;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 12;
  return Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24 * 30.44)));
};

/** What one draft promises in total — the number written to amount_thb. */
const draftPledge = (draft: Draft): number => {
  const monthly = Number(draft.amount);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  return monthly * monthsBetween(draft.start, draft.end);
};

export const AllocationPanel: React.FC<AllocationPanelProps> = ({
  opened,
  onClose,
  donorId,
  donorName,
  balance,
  onAllocated,
}) => {
  const [coverage, setCoverage] = useState<StudentCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    setDrafts({});
    setError(null);
    setSearch("");

    loadStudentCoverage().then(({ data, available: ok }) => {
      setCoverage(Array.from(data.values()));
      setAvailable(ok);
      setLoading(false);
    });
  }, [opened]);

  /**
   * Biggest gap first; unknown need immediately after, because it needs an
   * answer before it can be ranked at all; fully covered last, still present.
   */
  const ranked = useMemo(() => {
    const term = search.trim().toLowerCase();
    return coverage
      .filter((row) => !term || (row.student_name ?? "").toLowerCase().includes(term))
      .slice()
      // The same ranking the students table sorts by, so "who needs this next"
      // reads the same on both screens.
      .sort((a, b) => coverageRank(b) - coverageRank(a));
  }, [coverage, search]);

  // What this allocation actually promises. The row committed below stores
  // amount_thb as the monthly figure across the whole coverage window, so a
  // running total that added up monthly amounts told the admin a 5,000-a-month
  // twelve-month pledge would leave 95,000 of a 100,000 balance, and then took
  // 60,000 of it.
  const allocated = useMemo(
    () => Object.values(drafts).reduce((sum, draft) => sum + draftPledge(draft), 0),
    [drafts],
  );

  /** The same figure per month, for a screen that talks in monthly support. */
  const allocatedMonthly = useMemo(
    () =>
      Object.values(drafts).reduce((sum, draft) => {
        const value = Number(draft.amount);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [drafts],
  );

  const remaining = balance.free_balance_thb - allocated;
  const overspent = remaining < 0;
  const selectedCount = Object.keys(drafts).length;

  const toggle = (row: StudentCoverage) => {
    setDrafts((prev) => {
      if (prev[row.student_id]) {
        const next = { ...prev };
        delete next[row.student_id];
        return next;
      }
      return {
        ...prev,
        // Pre-filled with the gap: the common case is "cover what is missing",
        // and typing it out again is work the screen already knows how to do.
        [row.student_id]: {
          amount: row.monthly_gap_thb > 0 ? String(row.monthly_gap_thb) : "",
          start: today(),
          end: inAYear(),
        },
      };
    });
  };

  const setDraft = (studentId: string, key: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [key]: value } }));
  };

  const commit = async () => {
    if (saving || selectedCount === 0) return;

    const rows = Object.entries(drafts).map(([studentId, draft]) => {
      const monthly = Number(draft.amount);

      return {
        student_id: studentId,
        donor_id: donorId,
        monthly_amount_thb: monthly,
        // amount_thb is the pledge over the whole window; the monthly figure is
        // what the coverage maths reads. Both are stored so neither screen has
        // to derive the other.
        amount_thb: draftPledge(draft),
        coverage_start: draft.start || today(),
        coverage_end: draft.end || null,
        status: "active",
      };
    });

    const invalid = rows.find((row) => !Number.isFinite(row.monthly_amount_thb) || row.monthly_amount_thb <= 0);
    if (invalid) {
      setError("Every selected student needs a monthly amount above zero.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: writeError } = await supabase.from("scholarships").insert(rows);

    setSaving(false);

    if (writeError) {
      setError(writeError.message ?? "Could not save these allocations.");
      return;
    }

    onAllocated();
    onClose();
  };

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      busy={saving}
      dirty={selectedCount > 0}
      size={720}
      title="Allocate"
      subtitle={`Assign ${donorName || "this donor"}'s balance to the students who need it.`}
      status={
        selectedCount > 0
          ? `${selectedCount} student${selectedCount === 1 ? "" : "s"} selected`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={commit} disabled={saving || selectedCount === 0}>
            {saving ? "Allocating…" : `Allocate ${formatCurrency(allocated)}`}
          </Button>
        </>
      }
    >
      <div className={`${styles.running} ${overspent ? styles.overspent : ""}`}>
        <div>
          <div className={styles.runningLabel}>
            {overspent ? "Over this donor's balance by" : "Remaining after this"}
          </div>
          {/* Announced, so a keyboard user hears the figure change as they
              type rather than only seeing it. */}
          <div className={styles.runningValue} aria-live="polite">
            {formatCurrency(Math.abs(remaining))}
          </div>
        </div>
        <div className={styles.summary}>
          <span>Free balance {formatCurrency(balance.free_balance_thb)}</span>
          {allocatedMonthly > 0 && (
            <span>
              {formatCurrency(allocated)} pledged · {formatCurrency(allocatedMonthly)} a month
            </span>
          )}
          {overspent && (
            <span className={styles.overspentNote}>
              More is being promised than has arrived.
            </span>
          )}
        </div>
      </div>

      {error && <FormFeedback tone="error">{error}</FormFeedback>}

      {!available ? (
        <EmptyState
          icon="hand-coins"
          title="Coverage is not set up yet"
          description="The funding migration has not been applied, so there is no way to tell which students are short."
        />
      ) : loading ? (
        <EmptyState icon="hourglass" title="Loading students…" />
      ) : (
        <>
          <div className={styles.search}>
            <Input
              icon="search"
              placeholder="Find a student"
              value={search}
              fullWidth
              ariaLabel="Find a student"
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </div>

          <ul className={styles.list} role="listbox" aria-label="Students, ranked by funding gap">
            {ranked.map((row) => {
              const draft = drafts[row.student_id];
              const state = coverageState(row);
              const settled = state === "funded" || state === "over";

              return (
                <li
                  key={row.student_id}
                  role="option"
                  aria-selected={Boolean(draft)}
                  tabIndex={0}
                  className={[
                    styles.student,
                    draft ? styles.selected : "",
                    settled && !draft ? styles.settled : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggle(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggle(row);
                    }
                  }}
                >
                  <div className={styles.studentTop}>
                    <span className={styles.studentName}>{row.student_name ?? "Unnamed student"}</span>
                    <Badge tone={COVERAGE_META[state].tone}>{COVERAGE_META[state].label}</Badge>
                  </div>

                  <CoverageBar coverage={row} />

                  {draft && (
                    // Stop a click inside the fields from collapsing the row
                    // the person is filling in.
                    <div className={styles.amountRow} onClick={(event) => event.stopPropagation()}>
                      <TextInput
                        label="Monthly amount"
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(event) => setDraft(row.student_id, "amount", event.currentTarget.value)}
                      />
                      <DateInput
                        label="Covers from"
                        valueFormat="D MMM YYYY"
                        value={parseDateInput(draft.start)}
                        onChange={(value) => setDraft(row.student_id, "start", toDateInputValue(value))}
                      />
                      <DateInput
                        label="Until"
                        valueFormat="D MMM YYYY"
                        value={parseDateInput(draft.end)}
                        onChange={(value) => setDraft(row.student_id, "end", toDateInputValue(value))}
                      />
                    </div>
                  )}

                  {!draft && (
                    <span className={styles.studentMeta}>
                      {coverageSentence(row)}
                      {row.donor_count > 0 &&
                        ` · ${row.donor_count} donor${row.donor_count === 1 ? "" : "s"}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {ranked.length === 0 && (
            <EmptyState
              icon="search"
              title="No student matches that"
              description="Try a different name."
            />
          )}
        </>
      )}
    </FormDrawer>
  );
};

export default AllocationPanel;
