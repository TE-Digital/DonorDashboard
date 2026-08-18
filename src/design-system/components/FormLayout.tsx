// src/design-system/components/FormLayout.tsx
//
// The create / edit screen, as a set of parts.
//
// Every form in the product is the same shape: a 32px title, an optional step
// strip, sections divided by a hairline rule, and a sticky action bar. Before
// this existed each page invented its own — one wrapped fields in a Card with
// `Text fw={600}` standing in for a heading, another used a bespoke SCSS
// module. These parts are the one answer, so a change to the form language is
// a change to this file rather than a sweep across a dozen pages.
//
// Field, label and description styling is deliberately absent: styles/global.scss
// owns that, for every input in the app at once.

import React from "react";
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
  /** Renders the numbered step strip. */
  steps?: Array<FormStep | string>;
  /** Index of the step being shown, 0-based. */
  activeStep?: number;
  children: React.ReactNode;
}

export const FormPage: React.FC<FormPageProps> = ({
  title,
  subtitle,
  steps,
  activeStep = 0,
  children,
}) => (
  <div className={styles.page}>
    <h1 className={styles.title}>{title}</h1>
    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

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
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, hint, children }) => (
  <section className={styles.section}>
    <div className={styles.sectionHeading}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {hint && <span className={styles.sectionHint}>{hint}</span>}
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

/* ------------------------------------------------------------- FormError */

export const FormError: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  children ? (
    <div className={styles.error} role="alert">
      {children}
    </div>
  ) : null;

/* ------------------------------------------------------------- FormFooter */

export interface FormFooterProps {
  /** Controls pinned to the left — a Cancel, or a Delete on an edit screen. */
  left?: React.ReactNode;
  /** The primary action, and anything that sits beside it. */
  children: React.ReactNode;
}

export const FormFooter: React.FC<FormFooterProps> = ({ left, children }) => (
  <div className={styles.actions}>
    <div className={styles.actionsGroup}>{left}</div>
    <div className={styles.actionsGroup}>{children}</div>
  </div>
);

export default FormPage;
