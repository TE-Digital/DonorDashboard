// src/modules/calendar/SchoolCalendarSettingsPage.tsx
//
// Settings → School calendar.
//
// Where the programme says when a Thai school year and its two semesters run,
// and how long after a semester ends its report is due. Everything with a date
// that means something to a school (report deadlines, sponsorship years,
// renewals) reads these rules, so the page shows the consequence of each edit
// as real dates for this year before anyone saves.
//
// Rules are month and day only. The year comes from whichever school year is
// being asked about, so nothing here needs editing every May.

import React, { useEffect, useMemo, useState } from "react";
import { NumberInput, Select } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  FormSection,
  InlineMessage,
  LoadingState,
  PageHeader,
  formatDate,
  useDocumentTitle,
} from "../../design-system";
import { Button, Icon } from "../../design-system/lumen";
import {
  DEFAULT_CALENDAR,
  MONTHS,
  currentSchoolYear,
  daysInMonth,
  loadProgrammeCalendar,
  monthDay,
  saveProgrammeCalendar,
  splitMonthDay,
  validateCalendar,
  type CalendarErrors,
  type ProgrammeCalendar,
} from "./schoolCalendar";
import styles from "./SchoolCalendarSettingsPage.module.scss";

type MonthDayField = Exclude<keyof ProgrammeCalendar, "reportDueAfterDays">;

interface MonthDayInputProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/**
 * A day and a month, never a year. Two selects rather than a date picker,
 * because a picker insists on a year and the rule does not have one.
 */
const MonthDayInput: React.FC<MonthDayInputProps> = ({ id, label, value, error, onChange }) => {
  const { t } = useTranslation();
  const { month, day } = splitMonthDay(value);
  const days = daysInMonth(month);

  return (
    <fieldset className={styles.monthDay} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.monthDayControls}>
        <Select
          id={`${id}-day`}
          aria-label={t("calendar.dayOf", { label })}
          allowDeselect={false}
          data={Array.from({ length: days }, (_, i) => String(i + 1))}
          value={String(Math.min(day, days))}
          onChange={(next) => next && onChange(monthDay(month, Number(next)))}
          error={Boolean(error)}
          className={styles.day}
        />
        <Select
          id={`${id}-month`}
          aria-label={t("calendar.monthOf", { label })}
          allowDeselect={false}
          data={MONTHS.map((_, i) => ({ value: String(i + 1), label: t(`calendar.months.${i + 1}`) }))}
          value={String(month)}
          onChange={(next) => {
            if (!next) return;
            const m = Number(next);
            // 31 October becomes 30 November, not an invalid date.
            onChange(monthDay(m, Math.min(day, daysInMonth(m))));
          }}
          error={Boolean(error)}
          className={styles.month}
        />
      </div>
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {t(error)}
        </span>
      )}
    </fieldset>
  );
};

export const SchoolCalendarSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t("calendar.title"));

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [saved, setSaved] = useState<ProgrammeCalendar>(DEFAULT_CALENDAR);
  const [draft, setDraft] = useState<ProgrammeCalendar>(DEFAULT_CALENDAR);
  const [errors, setErrors] = useState<CalendarErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProgrammeCalendar().then(({ data, available: ok }) => {
      if (cancelled) return;
      setSaved(data);
      setDraft(data);
      setAvailable(ok);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (field: MonthDayField) => (value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      // Re-check as they type once they have seen an error, not before.
      if (Object.keys(errors).length) setErrors(validateCalendar(next));
      return next;
    });
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const preview = useMemo(() => currentSchoolYear(draft), [draft]);
  const errorCount = Object.keys(errors).length;

  const save = async () => {
    setSaveError(null);
    const found = validateCalendar(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      document.getElementById(`calendar-${first}-day`)?.focus();
      return;
    }

    setSaving(true);
    const result = await saveProgrammeCalendar(draft);
    setSaving(false);

    if (!result.ok) {
      setSaveError(t(`calendar.saveFailed.${result.reason ?? "failed"}`));
      return;
    }

    setSaved(draft);
    notifications.show({
      title: t("calendar.savedTitle"),
      message: t("calendar.savedMessage"),
      color: "green",
      icon: <Icon name="check" size={16} />,
      withBorder: true,
    });
  };

  if (loading) return <LoadingState />;

  const row = (field: MonthDayField, labelKey: string) => (
    <MonthDayInput
      id={`calendar-${field}`}
      label={t(labelKey)}
      value={draft[field]}
      error={errors[field]}
      onChange={set(field)}
    />
  );

  return (
    <div className={styles.page}>
      <PageHeader title={t("calendar.title")} />

      {!available && <InlineMessage tone="warning">{t("calendar.notSetUp")}</InlineMessage>}

      {/* The consequence, before the rules: what these settings mean this year. */}
      <section className={styles.preview} aria-labelledby="calendar-preview-title" aria-live="polite">
        <h2 id="calendar-preview-title" className={styles.previewTitle}>
          {t("calendar.previewTitle", { label: preview.label })}
        </h2>
        <p className={styles.previewLine}>
          {t("calendar.previewYear", {
            start: formatDate(preview.startsOn),
            end: formatDate(preview.endsOn),
          })}
        </p>
        <ul className={styles.previewSemesters}>
          {preview.semesters.map((s) => (
            <li key={s.number}>
              <span className={styles.previewSemesterName}>{t(`calendar.semester${s.number}`)}</span>
              <span>
                {t("calendar.previewSemester", {
                  start: formatDate(s.startsOn),
                  end: formatDate(s.endsOn),
                  due: formatDate(s.reportDueOn),
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <FormSection title={t("calendar.schoolYear")}>
        <div className={styles.rangeRow}>
          {row("schoolYearStart", "calendar.fields.schoolYearStart")}
          {row("schoolYearEnd", "calendar.fields.schoolYearEnd")}
        </div>
      </FormSection>

      <FormSection title={t("calendar.semester1")}>
        <div className={styles.rangeRow}>
          {row("semester1Start", "calendar.fields.semester1Start")}
          {row("semester1End", "calendar.fields.semester1End")}
        </div>
      </FormSection>

      <FormSection title={t("calendar.semester2")}>
        <div className={styles.rangeRow}>
          {row("semester2Start", "calendar.fields.semester2Start")}
          {row("semester2End", "calendar.fields.semester2End")}
        </div>
      </FormSection>

      <FormSection title={t("calendar.reports")}>
        <NumberInput
          id="calendar-reportDueAfterDays-day"
          label={t("calendar.fields.reportDueAfterDays")}
          min={0}
          max={120}
          allowDecimal={false}
          value={draft.reportDueAfterDays}
          error={errors.reportDueAfterDays ? t(errors.reportDueAfterDays) : undefined}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, reportDueAfterDays: typeof value === "number" ? value : 0 }))
          }
          className={styles.days}
        />
      </FormSection>

      <div className={styles.footer}>
        {errorCount > 0 && (
          <span className={styles.status} role="status">
            {t("calendar.needsAttention", { count: errorCount })}
          </span>
        )}
        {saveError && <InlineMessage tone="error">{saveError}</InlineMessage>}
        <div className={styles.actions}>
          <Button
            variant="ghost"
            disabled={saving || JSON.stringify(draft) === JSON.stringify(DEFAULT_CALENDAR)}
            onClick={() => {
              setDraft(DEFAULT_CALENDAR);
              setErrors({});
            }}
          >
            {t("calendar.useThaiDefaults")}
          </Button>
          <Button variant="primary" disabled={!dirty || saving || !available} onClick={() => void save()}>
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SchoolCalendarSettingsPage;
