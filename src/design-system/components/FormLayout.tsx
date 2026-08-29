// src/design-system/components/FormLayout.tsx
//
// The create / edit screen, as a set of parts.
//
// Every form in the product is the same shape: the same page header every
// other screen uses, an optional step strip, sections divided by a hairline
// rule, and an action bar pinned to the foot of the page. Before
// this existed each page invented its own — one wrapped fields in a Card with
// `Text fw={600}` standing in for a heading, another used a bespoke SCSS
// module. These parts are the one answer, so a change to the form language is
// a change to this file rather than a sweep across a dozen pages.
//
// Field, label and description styling is deliberately absent: styles/global.scss
// owns that, for every input in the app at once.

import React from "react";
import { Icon } from "../lumen";
import { PageHeader } from "./PageHeader";
import styles from "./FormLayout.module.scss";

/* -------------------------------------------------------------- FormPage */

export interface FormStep {
  label: string;
  /** Omit to render the step as a plain marker rather than a button. */
  onClick?: () => void;
}

export interface FormPageProps {
  title: React.ReactNode;
  /** A supporting line under the title. */
  subtitle?: React.ReactNode;
  /** Controls on the right of the header row — rarely needed on a form. */
  actions?: React.ReactNode;
  /** Renders the numbered step strip. */
  steps?: Array<FormStep | string>;
  /** Index of the step being shown, 0-based. */
  activeStep?: number;
  children: React.ReactNode;
}

export const FormPage: React.FC<FormPageProps> = ({
  title,
  subtitle,
  actions,
  steps,
  activeStep = 0,
  children,
}) => (
  <div className={styles.page}>
    {/* The same header component the list screens use, so a form does not
        arrive in a different type size from the page that linked to it. */}
    <div className={styles.header}>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
    </div>

    {steps && steps.length > 0 && (
      <div className={styles.steps} role="list">
        {steps.map((step, index) => {
          const item = typeof step === "string" ? { label: step } : step;
          const active = index === activeStep;
          const className = [
            styles.step,
            active ? styles.stepActive : "",
            item.onClick ? styles.stepClickable : "",
          ]
            .filter(Boolean)
            .join(" ");

          const content = (
            <>
              <span className={styles.stepNumber}>{index + 1}</span>
              <span>{item.label}</span>
            </>
          );

          return item.onClick ? (
            <button
              key={item.label}
              type="button"
              role="listitem"
              className={className}
              aria-current={active ? "step" : undefined}
              onClick={item.onClick}
            >
              {content}
            </button>
          ) : (
            <div
              key={item.label}
              role="listitem"
              className={className}
              aria-current={active ? "step" : undefined}
            >
              {content}
            </div>
          );
        })}
      </div>
    )}

    {children}
  </div>
);

/* -------------------------------------------------------------- FormBody */

export interface FormBodyProps {
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode;
}

/** The `<form>` element itself, so pages do not restate its layout. */
export const FormBody: React.FC<FormBodyProps> = ({ onSubmit, children }) => (
  <form className={styles.form} onSubmit={onSubmit} noValidate>
    {children}
  </form>
);

/* ----------------------------------------------------------- FormSection */

export interface FormSectionProps {
  title: React.ReactNode;
  /** The quiet line beside the title — what this group of fields is for. */
  hint?: React.ReactNode;
  /** A control on the right of the heading rule — "New scholarship", say. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, hint, actions, children }) => (
  <section className={styles.section}>
    <div className={styles.sectionHeading}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {hint && <span className={styles.sectionHint}>{hint}</span>}
      {actions && <span className={styles.sectionActions}>{actions}</span>}
    </div>
    {children}
  </section>
);

/* ------------------------------------------------------------ FieldLabel */

export interface FieldLabelProps {
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}

/**
 * The label above a control that is not an `<input>` — a SegmentedControl, a
 * radio row, a custom picker. Matches Mantine's input label exactly so the two
 * never drift apart on the same row.
 */
export const FieldLabel: React.FC<FieldLabelProps> = ({ required, htmlFor, children }) => (
  <label className={styles.fieldLabel} htmlFor={htmlFor}>
    {children}
    {required && <span className={styles.required}> *</span>}
  </label>
);

/* -------------------------------------------------------------- optional */

/**
 * Marks a field the form can be saved without.
 *
 * The rule, one way round only: **mark the minority**. On a form where most
 * fields are required, the two that are not are the surprising ones and they
 * carry this tag; on a form where most are optional, the required ones carry
 * the asterisk and nothing else is marked. Marking both on the same form
 * doubles the noise and tells a person nothing they could not already see.
 *
 * Usage: `<TextInput label={optional("LINE ID")} … />`
 */
export const optional = (label: React.ReactNode): React.ReactNode => (
  <>
    {label}
    <span className={styles.optionalTag}> · optional</span>
  </>
);

/* ---------------------------------------------------------- FormFeedback */

export type FormTone = "error" | "success" | "info" | "warning";

const TONE_ICON: Record<FormTone, string> = {
  error: "circle-alert",
  success: "check-circle-2",
  info: "info",
  warning: "triangle-alert",
};

export interface FormFeedbackProps {
  tone?: FormTone;
  /** The heading line, when the message needs more than one sentence. */
  title?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * What the form has to say back: a failed save, a saved record, a warning
 * before an irreversible action. Renders nothing when empty, so callers keep
 * writing `<FormFeedback tone="error">{error}</FormFeedback>` without a guard.
 *
 * Field-level messages are not this — those ride on the input's own `error`
 * prop, which styles/global.scss already styles.
 */
export const FormFeedback: React.FC<FormFeedbackProps> = ({ tone = "error", title, children }) => {
  if (!children && !title) return null;

  return (
    <div className={`${styles.feedback} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={TONE_ICON[tone]} size={16} style={{ marginTop: 1 }} />
      <div className={styles.feedbackText}>
        {title && <strong className={styles.feedbackTitle}>{title}</strong>}
        {children && <span>{children}</span>}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- FormError */

/** The error case of {@link FormFeedback}, kept for the pages that use it. */
export const FormError: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FormFeedback tone="error">{children}</FormFeedback>
);

/* ------------------------------------------------------------- FormFooter */

export interface FormFooterProps {
  /** Controls pinned to the left — a Cancel, or a Delete on an edit screen. */
  left?: React.ReactNode;
  /** A quiet line beside the actions: "Saving…", "Saved a moment ago". */
  status?: React.ReactNode;
  /** The primary action, and anything that sits beside it. */
  children: React.ReactNode;
}

export const FormFooter: React.FC<FormFooterProps> = ({ left, status, children }) => (
  <div className={styles.actions}>
    <div className={styles.actionsGroup}>{left}</div>
    <div className={styles.actionsGroup}>
      {status && <span className={styles.actionsStatus}>{status}</span>}
      {children}
    </div>
  </div>
);

export default FormPage;
