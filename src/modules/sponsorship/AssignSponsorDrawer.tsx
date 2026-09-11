// src/modules/sponsorship/AssignSponsorDrawer.tsx
//
// Connecting a donor's money to the students who need it.
//
// Two ways in, one drawer. From a donor: their free balance is pinned at the
// top and the students waiting for a donor are listed first, each labelled with
// how far this money reaches for them. From a student: pick the donor, set the
// terms. Either way the balance and every "fully covered" label recompute as
// rows are added, because each student ticked spends money the next one cannot.
//
// Only money that has arrived is assigned. Going over the free balance is shown
// in words and blocks saving; the answer is to record the payment first, not to
// promise ahead of it. Students who are not ready to be shown to a donor stay in
// the list, greyed, saying which gate is missing, so nobody wonders where they
// went.
//
// It replaced the old allocation panel (gap ranking, live balance, one commit
// for many students) on the donor page.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { FormDrawer, FormFeedback, InlineMessage, formatCurrency, formatDate } from "../../design-system";
import { Badge, Button, EmptyState, Icon, Input } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import { CoverageBar } from "../donor/CoverageBar";
import {
  isMissingRelation,
  loadDonorBalances,
  loadStudentCoverage,
  type StudentCoverage,
} from "../donor/donorMoney";
import {
  DEFAULT_CALENDAR,
  currentSchoolYear,
  loadProgrammeCalendar,
  type ProgrammeCalendar,
} from "../calendar/schoolCalendar";
import { FIT_TONE, fitFor, pledgeFor, windowEnd, type Fit } from "./fit";
import { SponsorshipFields, type SponsorshipDraft } from "./SponsorshipFields";
import { missingGateKey, type MissingGate } from "./sponsorships";
import styles from "./AssignSponsorDrawer.module.scss";

export type AssignMode =
  | { kind: "donor"; donorId: string; donorName: string | null; freeBalance: number }
  | { kind: "student"; studentId: string; studentName: string };

export interface AssignSponsorDrawerProps {
  opened: boolean;
  onClose: () => void;
  mode: AssignMode;
  /** Fired after the sponsorships are written, so the page reloads. */
  onAssigned: () => void;
}

interface Candidate {
  id: string;
  name: string;
  schoolName: string | null;
  grade: string | null;
  coverage: StudentCoverage | undefined;
  missingGates: MissingGate[];
}

interface DonorOption {
  id: string;
  name: string;
  email: string | null;
  freeBalance: number;
}

type Draft = SponsorshipDraft;

const todayIso = () => new Date().toISOString().slice(0, 10);

const gapOf = (candidate: Candidate | undefined) =>
  candidate?.coverage && !candidate.coverage.need_unknown ? candidate.coverage.monthly_gap_thb : 0;

/** Students, their gates and their coverage, in one pass. */
const loadCandidates = async (onlyStudentId?: string) => {
  const full =
    "id, name, nickname, grade_level, status, consent_status, donor_profile_status, schools(name)";
  let query = supabase.from("students").select(full);
  if (onlyStudentId) query = query.eq("id", onlyStudentId);
  let read = await query;
  let gatesKnown = true;

  if (read.error && isMissingRelation(read.error)) {
    // Before the lifecycle migration nobody can say who has consent, so the
    // gates are not checked and the drawer says so rather than blocking everyone.
    let base = supabase.from("students").select("id, name, nickname, grade_level, schools(name)");
    if (onlyStudentId) base = base.eq("id", onlyStudentId);
    read = (await base) as typeof read;
    gatesKnown = false;
  }

  const coverage = await loadStudentCoverage(onlyStudentId ? [onlyStudentId] : undefined);

  const candidates: Candidate[] = ((read.data ?? []) as any[])
    // Archived students are not in the programme; they are not candidates at all.
    .filter((row) => (row.status ?? "enrolled") === "enrolled" || onlyStudentId)
    .map((row) => {
      const gates: MissingGate[] = [];
      if (gatesKnown) {
        if ((row.status ?? "enrolled") !== "enrolled") gates.push("archived");
        if ((row.consent_status ?? "pending") === "pending") gates.push("consent_pending");
        if (row.consent_status === "declined") gates.push("consent_declined");
        if ((row.donor_profile_status ?? "draft") !== "published") gates.push("profile_unpublished");
      }
      return {
        id: row.id,
        name: row.nickname || row.name,
        schoolName: row.schools?.name ?? null,
        grade: row.grade_level ?? null,
        coverage: coverage.data.get(row.id),
        missingGates: gates,
      };
    });

  return { candidates, gatesKnown, coverageAvailable: coverage.available, error: read.error };
};

export const AssignSponsorDrawer: React.FC<AssignSponsorDrawerProps> = ({ opened, onClose, mode, onAssigned }) => {
  const { t } = useTranslation();
  const narrow = useMediaQuery("(max-width: 640px)");

  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<ProgrammeCalendar>(DEFAULT_CALENDAR);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [gatesKnown, setGatesKnown] = useState(true);
  const [coverageAvailable, setCoverageAvailable] = useState(true);
  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [donorId, setDonorId] = useState<string | null>(mode.kind === "donor" ? mode.donorId : null);

  const [search, setSearch] = useState("");
  const [showSponsored, setShowSponsored] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [step, setStep] = useState<"choose" | "details">("choose");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    setLoading(true);
    setDrafts({});
    setError(null);
    setSearch("");
    setShowSponsored(false);
    setStep("choose");
    setDonorId(mode.kind === "donor" ? mode.donorId : null);

    const run = async () => {
      const [cal, students] = await Promise.all([
        loadProgrammeCalendar(),
        loadCandidates(mode.kind === "student" ? mode.studentId : undefined),
      ]);

      let donorOptions: DonorOption[] = [];
      if (mode.kind === "student") {
        const [balances, donorRows] = await Promise.all([
          loadDonorBalances(),
          supabase.from("donors").select("id, name, contact").order("name"),
        ]);
        donorOptions = ((donorRows.data ?? []) as any[])
          .map((row) => ({
            id: row.id,
            name: row.name ?? t("donorCard.aDonor"),
            email: row.contact?.email ?? null,
            freeBalance: balances.data.get(row.id)?.free_balance_thb ?? 0,
          }))
          // Money first: a donor with nothing free cannot fund anyone today.
          .sort((a, b) => b.freeBalance - a.freeBalance || a.name.localeCompare(b.name));
      }

      if (cancelled) return;
      setCalendar(cal.data);
      setCandidates(students.candidates);
      setGatesKnown(students.gatesKnown);
      setCoverageAvailable(students.coverageAvailable);
      setDonors(donorOptions);
      if (students.error && !isMissingRelation(students.error)) {
        setError(t("sponsorship.assign.loadFailed"));
      }
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // mode is recreated by the parent on every render; its identity is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, mode.kind === "donor" ? mode.donorId : mode.studentId]);

  const donor = mode.kind === "student" ? donors.find((d) => d.id === donorId) ?? null : null;
  const freeBalance = mode.kind === "donor" ? mode.freeBalance : donor?.freeBalance ?? 0;
  const donorName = mode.kind === "donor" ? mode.donorName ?? t("donorCard.aDonor") : donor?.name ?? "";

  const schoolYear = useMemo(() => currentSchoolYear(calendar), [calendar]);
  const start = todayIso();

  const pledges = useMemo(
    () => Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [id, pledgeFor(draft)])),
    [drafts],
  );
  const committed = Object.values(pledges).reduce((sum, value) => sum + value, 0);
  const remaining = freeBalance - committed;
  const over = remaining < 0;
  const selectedIds = Object.keys(drafts);

  /** Money this student could still draw on: everything free except what the other rows take. */
  const availableFor = (studentId: string) => freeBalance - committed + (pledges[studentId] ?? 0);

  const fitOf = (candidate: Candidate): Fit =>
    fitFor(gapOf(candidate), availableFor(candidate.id), start, calendar);

  const fitLabel = (fit: Fit) => {
    switch (fit.kind) {
      case "full":
        return t("sponsorship.assign.fit.full", { date: formatDate(fit.yearEndsOn) });
      case "partial":
        return t("sponsorship.assign.fit.partial", { covered: fit.coveredMonths, total: fit.totalMonths });
      case "none":
        return t("sponsorship.assign.fit.none");
      default:
        return t("sponsorship.assign.fit.unknown");
    }
  };

  /** Moves between options with the arrow keys, as a listbox promises. Ignores keys typed inside the fields. */
  const moveFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if ((event.target as HTMLElement).getAttribute("role") !== "option") return;
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'),
    );
    if (!options.length) return;
    const index = options.indexOf(event.target as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : Math.min(options.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
    event.preventDefault();
    options[next]?.focus();
  };

  const gatesSentence = (gates: MissingGate[]) => gates.map((gate) => t(missingGateKey(gate))).join(", ");

  // Waiting first, ranked by how well this money fits them and then by the
  // size of the gap; students who already have a donor underneath, collapsed.
  const { waiting, sponsored } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = candidates.filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.schoolName ?? "").toLowerCase().includes(term),
    );
    const rank = (c: Candidate) => {
      const fit = fitFor(gapOf(c), freeBalance, start, calendar);
      const fitScore = { full: 3, partial: 2, unknown: 1, none: 0 }[fit.kind];
      return (c.missingGates.length ? 0 : 1e9) + fitScore * 1e7 + gapOf(c);
    };
    const sorted = [...matches].sort((a, b) => rank(b) - rank(a));
    return {
      waiting: sorted.filter((c) => (c.coverage?.donor_count ?? 0) === 0),
      sponsored: sorted.filter((c) => (c.coverage?.donor_count ?? 0) > 0),
    };
  }, [candidates, search, freeBalance, start, calendar]);

  const toggle = (candidate: Candidate) => {
    if (candidate.missingGates.length) return;
    setDrafts((prev) => {
      if (prev[candidate.id]) {
        const next = { ...prev };
        delete next[candidate.id];
        return next;
      }
      const gap = gapOf(candidate);
      const fit = fitFor(gap, remaining, start, calendar);
      // Cover what is missing, to the end of the school year, unless the money
      // runs out first, in which case end where it runs out and say so.
      const end = fit.kind === "partial" && fit.paidUntil ? fit.paidUntil : fit.yearEndsOn;
      return {
        ...prev,
        [candidate.id]: {
          supportType: "full",
          monthly: gap > 0 ? String(gap) : "",
          oneOff: "",
          item: "",
          start,
          end,
          emails: true,
          renew: true,
          shortenedTo: fit.kind === "partial" ? end : null,
        },
      };
    });
  };

  const patchDraft = (studentId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));

  // Student mode: the one student is the only row, selected from the start.
  useEffect(() => {
    if (mode.kind !== "student" || loading || !donorId) return;
    const only = candidates[0];
    if (!only || only.missingGates.length) return;
    setDrafts((prev) => (prev[only.id] ? prev : {}));
    if (!drafts[only.id]) toggle(only);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, loading, donorId]);

  const problems = (): string | null => {
    for (const [id, draft] of Object.entries(drafts)) {
      const name = candidates.find((c) => c.id === id)?.name ?? "";
      if (draft.supportType === "specific_item" && !draft.item.trim()) return t("sponsorship.assign.needItem", { name });
      if (!pledges[id]) return t("sponsorship.assign.needAmount", { name });
      if (draft.supportType !== "specific_item" && draft.end && draft.end < draft.start) {
        return t("sponsorship.assign.endBeforeStart", { name });
      }
    }
    if (over) return t("sponsorship.assign.overNote");
    return null;
  };

  const commit = async () => {
    if (saving || !selectedIds.length) return;
    const problem = problems();
    if (problem) {
      setError(problem);
      return;
    }
    const donorForRows = mode.kind === "donor" ? mode.donorId : donorId;
    if (!donorForRows) return;

    setSaving(true);
    setError(null);

    const { data: session } = await supabase.auth.getUser();
    const base = Object.entries(drafts).map(([studentId, draft]) => {
      const specific = draft.supportType === "specific_item";
      const monthly = specific ? 0 : Number(draft.monthly);
      return {
        student_id: studentId,
        donor_id: donorForRows,
        monthly_amount_thb: monthly,
        amount_thb: pledges[studentId],
        coverage_start: draft.start,
        // A specific item is paid once; it has a date, not a window.
        coverage_end: specific ? draft.start : draft.end || null,
        status: "active",
        created_by: session?.user?.id ?? null,
      };
    });
    const extended = base.map((row, index) => {
      const draft = Object.values(drafts)[index];
      return {
        ...row,
        support_type: draft.supportType,
        item_description: draft.supportType === "specific_item" ? draft.item.trim() : null,
        report_emails_enabled: draft.emails,
        auto_renew: draft.supportType === "specific_item" ? false : draft.renew,
      };
    });

    let { error: writeError } = await supabase.from("scholarships").insert(extended);
    if (writeError && isMissingRelation(writeError)) {
      // Before 20260911140000: the money and dates still save; the relationship
      // details wait for the migration.
      ({ error: writeError } = await supabase.from("scholarships").insert(base));
    }

    setSaving(false);

    if (writeError) {
      console.error("Error assigning donors", writeError);
      setError(
        writeError.code === "42501" ? t("sponsorship.assign.notAllowed") : t("sponsorship.assign.saveFailed"),
      );
      return;
    }

    const names = selectedIds.map((id) => candidates.find((c) => c.id === id)?.name).filter(Boolean).join(", ");
    notifications.show({
      title: t("sponsorship.assign.savedTitle"),
      message: t("sponsorship.assign.savedMessage", { names, donor: donorName }),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });

    onAssigned();
    onClose();
  };

  // What the live region says after any change: what's left, then how far it goes for each student ticked.
  const liveSummary = [
    over
      ? t("sponsorship.assign.over", { amount: formatCurrency(Math.abs(remaining)) })
      : `${t("sponsorship.assign.remaining")}: ${formatCurrency(remaining)}`,
    ...selectedIds.map((id) => {
      const candidate = candidates.find((c) => c.id === id);
      return candidate ? `${candidate.name}: ${fitLabel(fitOf(candidate))}` : "";
    }),
  ]
    .filter(Boolean)
    .join(". ");

  // ---------------------------------------------------------------- pieces

  const running = (
    <div className={`${styles.running} ${over ? styles.over : ""}`}>
      <div>
        <div className={styles.runningLabel}>
          {over ? t("sponsorship.assign.overLabel") : t("sponsorship.assign.remaining")}
        </div>
        <div className={styles.runningValue}>
          {over
            ? t("sponsorship.assign.over", { amount: formatCurrency(Math.abs(remaining)) })
            : formatCurrency(remaining)}
        </div>
      </div>
      <div className={styles.runningMeta}>
        <span>{t("sponsorship.assign.free", { amount: formatCurrency(freeBalance) })}</span>
        <span>{t("sponsorship.assign.schoolYear", { label: schoolYear.label, end: formatDate(schoolYear.endsOn) })}</span>
      </div>
      {/* One polite region for the balance and every selected student's fit,
          so a screen reader hears the whole consequence of a change once. */}
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {liveSummary}
      </div>
    </div>
  );

  const fields = (candidate: Candidate, draft: Draft) => (
    // Stop a click inside the fields from un-ticking the student being filled in.
    <div onClick={(event) => event.stopPropagation()}>
      <SponsorshipFields
        idPrefix={`assign-${candidate.id}`}
        draft={draft}
        monthlyGap={candidate.coverage?.monthly_gap_thb ?? 0}
        pledge={pledges[candidate.id] ?? 0}
        onChange={(patch) => patchDraft(candidate.id, patch)}
      />
    </div>
  );

  const option = (candidate: Candidate) => {
    const draft = drafts[candidate.id];
    const blocked = candidate.missingGates.length > 0;
    const fit = fitOf(candidate);
    const reasons = gatesSentence(candidate.missingGates);

    return (
      <li
        key={candidate.id}
        role="option"
        aria-selected={Boolean(draft)}
        aria-disabled={blocked || undefined}
        aria-describedby={`assign-${candidate.id}-meta`}
        tabIndex={blocked ? -1 : 0}
        className={[styles.option, draft ? styles.selected : "", blocked ? styles.blocked : ""].filter(Boolean).join(" ")}
        onClick={() => toggle(candidate)}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggle(candidate);
          }
        }}
      >
        <div className={styles.optionTop}>
          <span className={styles.check} aria-hidden="true">
            {draft && <Icon name="check" size={14} />}
          </span>
          <span className={styles.optionName}>{candidate.name}</span>
          {!blocked && (
            <Badge tone={FIT_TONE[fit.kind]} dot>
              {fitLabel(fit)}
            </Badge>
          )}
        </div>

        <div id={`assign-${candidate.id}-meta`} className={styles.optionMeta}>
          {[candidate.grade, candidate.schoolName].filter(Boolean).join(" · ")}
          {blocked && (
            <span className={styles.blockedReason}>
              {t("sponsorship.assign.notReady", { reasons })}{" "}
              <Link
                to={`/admin/students/${candidate.id}?tab=donor`}
                onClick={(event) => event.stopPropagation()}
                className={styles.fixLink}
              >
                {t("sponsorship.assign.fixProfile")}
              </Link>
            </span>
          )}
        </div>

        {!blocked && <CoverageBar coverage={candidate.coverage} compact />}

        {draft && (!narrow || step === "details") && fields(candidate, draft)}
      </li>
    );
  };

  // ---------------------------------------------------------------- body

  const donorPicker = mode.kind === "student" && (
    <div className={styles.donorPicker}>
      <Input
        icon="search"
        placeholder={t("sponsorship.assign.searchDonor")}
        value={search}
        fullWidth
        ariaLabel={t("sponsorship.assign.searchDonor")}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <ul className={styles.list} role="listbox" aria-label={t("sponsorship.assign.donorListLabel")} onKeyDown={moveFocus}>
        {donors
          .filter((d) => {
            const term = search.trim().toLowerCase();
            return !term || d.name.toLowerCase().includes(term) || (d.email ?? "").toLowerCase().includes(term);
          })
          .map((d) => {
            const fit = fitFor(gapOf(candidates[0]), d.freeBalance, start, calendar);
            const chosen = d.id === donorId;
            return (
              <li
                key={d.id}
                role="option"
                aria-selected={chosen}
                tabIndex={0}
                className={`${styles.option} ${chosen ? styles.selected : ""} ${d.freeBalance <= 0 ? styles.blocked : ""}`}
                onClick={() => {
                  setDonorId(d.id);
                  setDrafts({});
                }}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    setDonorId(d.id);
                    setDrafts({});
                  }
                }}
              >
                <div className={styles.optionTop}>
                  <span className={styles.check} aria-hidden="true">
                    {chosen && <Icon name="check" size={14} />}
                  </span>
                  <span className={styles.optionName}>{d.name}</span>
                  <span className={styles.optionAmount}>
                    {t("sponsorship.assign.donorFree", { amount: formatCurrency(d.freeBalance) })}
                  </span>
                </div>
                <div className={styles.optionMeta}>
                  {d.freeBalance > 0 ? fitLabel(fit) : t("sponsorship.assign.donorNothingFree")}
                  {d.email ? ` · ${d.email}` : ""}
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );

  const studentBody = () => {
    const only = candidates[0];
    if (!only) return <EmptyState icon="users" title={t("sponsorship.assign.studentMissing")} />;
    if (only.missingGates.length) {
      return (
        <InlineMessage tone="warning">
          {t("sponsorship.assign.studentNotReady", { name: only.name, reasons: gatesSentence(only.missingGates) })}
        </InlineMessage>
      );
    }
    return (
      <>
        {donorPicker}
        {donor && drafts[only.id] && (
          <section className={styles.detailsFor} aria-label={t("sponsorship.assign.detailsFor", { name: only.name })}>
            <h3 className={styles.groupTitle}>{t("sponsorship.assign.detailsFor", { name: only.name })}</h3>
            {fields(only, drafts[only.id])}
          </section>
        )}
      </>
    );
  };

  const donorBody = () => {
    if (!coverageAvailable) {
      return <EmptyState icon="hand-coins" title={t("sponsorship.assign.notSetUp")} />;
    }
    if (freeBalance <= 0 && !selectedIds.length) {
      return (
        <EmptyState
          icon="wallet"
          title={t("sponsorship.assign.noFreeBalance", { name: donorName })}
          description={t("sponsorship.assign.noFreeBalanceBody")}
        />
      );
    }

    const onDetailsStep = narrow && step === "details";
    const visibleWaiting = onDetailsStep ? waiting.filter((c) => drafts[c.id]) : waiting;
    const visibleSponsored = onDetailsStep ? sponsored.filter((c) => drafts[c.id]) : sponsored;

    return (
      <>
        {!onDetailsStep && (
          <div className={styles.search}>
            <Input
              icon="search"
              placeholder={t("sponsorship.assign.search")}
              value={search}
              fullWidth
              inputRef={searchRef}
              ariaLabel={t("sponsorship.assign.search")}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </div>
        )}

        {onDetailsStep && (
          <div className={styles.stepHead}>
            <Button
              variant="ghost"
              icon="chevron-left"
              onClick={() => {
                setStep("choose");
                requestAnimationFrame(() => searchRef.current?.focus());
              }}
            >
              {t("sponsorship.assign.back")}
            </Button>
            <h3 className={styles.groupTitle} tabIndex={-1} id="assign-step-details">
              {t("sponsorship.assign.stepDetails")}
            </h3>
          </div>
        )}

        {!onDetailsStep && !waiting.some((c) => !c.missingGates.length) && (
          <EmptyState
            icon="users"
            title={t("sponsorship.assign.nobodyEligibleTitle")}
            description={t("sponsorship.assign.nobodyEligibleBody")}
          />
        )}

        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={t("sponsorship.assign.listLabel")}
          className={styles.groups}
          onKeyDown={moveFocus}
        >
          <div role="group" aria-labelledby="assign-group-waiting">
            <h3 id="assign-group-waiting" className={styles.groupTitle}>
              {t("sponsorship.assign.groupWaiting", { count: waiting.length })}
            </h3>
            {visibleWaiting.length ? (
              <ul className={styles.list}>{visibleWaiting.map(option)}</ul>
            ) : (
              <p className={styles.empty}>
                {search ? t("sponsorship.assign.noMatch") : t("sponsorship.assign.nobodyWaiting")}
              </p>
            )}
          </div>

          {sponsored.length > 0 && (
            <div role="group" aria-labelledby="assign-group-sponsored">
              {showSponsored || onDetailsStep ? (
                <>
                  <h3 id="assign-group-sponsored" className={styles.groupTitle}>
                    {t("sponsorship.assign.groupSponsored", { count: sponsored.length })}
                  </h3>
                  <ul className={styles.list}>{visibleSponsored.map(option)}</ul>
                </>
              ) : (
                <Button variant="ghost" icon="chevron-down" onClick={() => setShowSponsored(true)}>
                  <span id="assign-group-sponsored">{t("sponsorship.assign.showSponsored", { count: sponsored.length })}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </>
    );
  };

  const submitLabel =
    mode.kind === "student"
      ? donorName
        ? t("sponsorship.assign.submitDonor", { name: donorName })
        : t("sponsorship.assign.submitNone")
      : t("sponsorship.assign.submit", { count: selectedIds.length });

  const mobileNext = mode.kind === "donor" && narrow && step === "choose" && selectedIds.length > 0;

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      busy={saving}
      dirty={selectedIds.length > 0}
      size={880}
      title={
        mode.kind === "donor"
          ? t("sponsorship.assign.titleDonor", { name: donorName })
          : t("sponsorship.assign.titleStudent", { name: mode.studentName })
      }
      status={selectedIds.length ? t("sponsorship.assign.selected", { count: selectedIds.length }) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          {mobileNext ? (
            <Button
              variant="primary"
              onClick={() => {
                setStep("details");
                requestAnimationFrame(() => document.getElementById("assign-step-details")?.focus());
              }}
            >
              {t("sponsorship.assign.next", { count: selectedIds.length })}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void commit()} disabled={saving || !selectedIds.length || over}>
              {saving ? t("sponsorship.assign.saving") : submitLabel}
            </Button>
          )}
        </>
      }
    >
      {(mode.kind === "donor" || donor) && running}

      {!gatesKnown && <InlineMessage tone="info">{t("sponsorship.assign.gatesUnknown")}</InlineMessage>}
      {error && <FormFeedback tone="error">{error}</FormFeedback>}
      {over && !error && <FormFeedback tone="error">{t("sponsorship.assign.overNote")}</FormFeedback>}

      {loading ? (
        <EmptyState icon="hourglass" title={t("sponsorship.assign.loading")} />
      ) : mode.kind === "student" ? (
        studentBody()
      ) : (
        donorBody()
      )}
    </FormDrawer>
  );
};

export default AssignSponsorDrawer;

/** Re-exported for the renewal job and tests: the default end for a partial fit. */
export { windowEnd };
