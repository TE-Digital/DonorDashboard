// src/modules/sponsorship/SponsorshipFields.tsx
//
// The terms of one donor's support for one student: what kind, how much, from
// when to when, and whether the reports and renewals follow.
//
// Shared by the assign drawer (one set per student ticked) and the edit drawer
// (one set for the row being changed), so the two cannot disagree about what a
// sponsorship is made of.

import React from "react";
import { NumberInput, SegmentedControl, Switch, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatDate, parseDateInput, toDateInputValue } from "../../design-system";
import { supportTypeKey, type SupportType } from "./sponsorships";
import styles from "./SponsorshipFields.module.scss";

export interface SponsorshipDraft {
  supportType: SupportType;
  monthly: string;
  oneOff: string;
  item: string;
  start: string;
  end: string;
  emails: boolean;
  renew: boolean;
  /** Set when the default end date was pulled in because the money runs out. */
  shortenedTo: string | null;
}

export interface SponsorshipFieldsProps {
  idPrefix: string;
  draft: SponsorshipDraft;
  onChange: (patch: Partial<SponsorshipDraft>) => void;
  /** What the student is still short each month, for choosing full or partial. */
  monthlyGap: number;
  /** What these terms add up to, shown beneath them. */
  pledge: number;
  /** The reports switch is off and locked when the donor has stopped all emails. */
  emailsLockedReason?: string | null;
}

export const SponsorshipFields: React.FC<SponsorshipFieldsProps> = ({
  idPrefix,
  draft,
  onChange,
  monthlyGap,
  pledge,
  emailsLockedReason,
}) => {
  const { t } = useTranslation();
  const specific = draft.supportType === "specific_item";

  return (
    <div className={styles.fields}>
      <SegmentedControl
        fullWidth
        aria-label={t("sponsorship.assign.fields.support")}
        value={draft.supportType}
        onChange={(value) => onChange({ supportType: value as SupportType })}
        data={(["full", "partial", "specific_item"] as SupportType[]).map((type) => ({
          value: type,
          label: t(supportTypeKey(type)),
        }))}
      />

      {specific ? (
        <div className={styles.grid}>
          <NumberInput
            id={`${idPrefix}-oneoff`}
            label={t("sponsorship.assign.fields.oneOff")}
            prefix="฿"
            thousandSeparator=","
            min={0}
            value={draft.oneOff === "" ? "" : Number(draft.oneOff)}
            onChange={(value) => onChange({ oneOff: value === "" ? "" : String(value) })}
          />
          <TextInput
            id={`${idPrefix}-item`}
            label={t("sponsorship.assign.fields.item")}
            placeholder={t("sponsorship.assign.fields.itemPlaceholder")}
            value={draft.item}
            onChange={(event) => onChange({ item: event.currentTarget.value })}
          />
          <DateInput
            id={`${idPrefix}-paid`}
            label={t("sponsorship.assign.fields.paidOn")}
            valueFormat="D MMM YYYY"
            value={parseDateInput(draft.start)}
            onChange={(value) => onChange({ start: toDateInputValue(value) })}
          />
        </div>
      ) : (
        <div className={styles.grid}>
          <NumberInput
            id={`${idPrefix}-monthly`}
            label={t("sponsorship.assign.fields.monthly")}
            prefix="฿"
            thousandSeparator=","
            min={0}
            value={draft.monthly === "" ? "" : Number(draft.monthly)}
            onChange={(value) => {
              const next = value === "" ? "" : String(value);
              // Full or partial follows the amount against the gap.
              const supportType: SupportType = monthlyGap > 0 && Number(next) < monthlyGap ? "partial" : "full";
              onChange({ monthly: next, supportType });
            }}
          />
          <DateInput
            id={`${idPrefix}-start`}
            label={t("sponsorship.assign.fields.start")}
            valueFormat="D MMM YYYY"
            value={parseDateInput(draft.start)}
            onChange={(value) => onChange({ start: toDateInputValue(value) })}
          />
          <DateInput
            id={`${idPrefix}-end`}
            label={t("sponsorship.assign.fields.end")}
            valueFormat="D MMM YYYY"
            value={parseDateInput(draft.end)}
            onChange={(value) => onChange({ end: toDateInputValue(value), shortenedTo: null })}
          />
        </div>
      )}

      {draft.shortenedTo && (
        <span className={styles.note}>{t("sponsorship.assign.shortened", { date: formatDate(draft.shortenedTo) })}</span>
      )}

      <div className={styles.switches}>
        <Switch
          label={t("sponsorship.assign.fields.emails")}
          checked={emailsLockedReason ? false : draft.emails}
          disabled={Boolean(emailsLockedReason)}
          description={emailsLockedReason ?? undefined}
          onChange={(event) => onChange({ emails: event.currentTarget.checked })}
        />
        {!specific && (
          <Switch
            label={t("sponsorship.assign.fields.renew")}
            checked={draft.renew}
            onChange={(event) => onChange({ renew: event.currentTarget.checked })}
          />
        )}
      </div>

      <span className={styles.pledge}>{t("sponsorship.assign.pledge", { amount: formatCurrency(pledge) })}</span>
    </div>
  );
};

export default SponsorshipFields;
