// src/design-system/index.ts
//
// Single import surface for the presentation layer.
// Pages should import from here, never from the individual files.

export * from "./tokens";
export * from "./typography";
export * from "./semantic";
export * from "./format";
export * from "./useDocumentTitle";
export * from "./branding";
export * from "./theme";
export * from "./cssVars";

export { PageHeader } from "./components/PageHeader";
export type { PageHeaderProps } from "./components/PageHeader";

export { SectionCard } from "./components/SectionCard";
export type { SectionCardProps } from "./components/SectionCard";

// The KPI band. Lists, detail records and dashboards all render this one.
export { KpiRow } from "./components/KpiRow";
export type { KpiItem, KpiMark, KpiRowProps } from "./components/KpiRow";

export { StatCard } from "./components/StatCard";
export type { StatCardProps } from "./components/StatCard";

export { StatusBadge } from "./components/StatusBadge";
export type { StatusBadgeProps } from "./components/StatusBadge";

export { EmptyState } from "./components/EmptyState";
export type { EmptyStateProps } from "./components/EmptyState";

export { LoadingState } from "./components/LoadingState";
export type { LoadingStateProps } from "./components/LoadingState";

export { InlineMessage } from "./components/InlineMessage";
export type { InlineMessageProps, MessageTone } from "./components/InlineMessage";

export {
  FormPage,
  FormBody,
  FormSection,
  FieldLabel,
  optional,
  FormError,
  FormFeedback,
  FormFooter,
} from "./components/FormLayout";
export type {
  FormPageProps,
  FormBodyProps,
  FormSectionProps,
  FieldLabelProps,
  FormFeedbackProps,
  FormFooterProps,
  FormStep,
  FormTone,
} from "./components/FormLayout";

// The form that opens on top of another screen: right-hand drawer, sticky
// header and action bar, only the fields scroll.
export { FormDrawer } from "./components/FormDrawer";
export type { FormDrawerCrumb, FormDrawerProps } from "./components/FormDrawer";

export { FormActions } from "./components/FormActions";
export type { FormActionsProps } from "./components/FormActions";

// Contact channels as copy-to-clipboard icons. Replaces an email column and a
// phone column with one narrow cell.
export { ContactCell, CopyIconButton, copyToClipboard, showCopyFeedback, showCopyFailure } from "./components/ContactCell";
export type { ContactCellProps, ContactKind, CopyFeedback, CopyIconButtonProps } from "./components/ContactCell";

// The standard list-screen shape: KPI row, filter bar, sortable + filterable
// grid, pagination. Every table in the product is built from this.
export { TableSection } from "./components/TableSection";
export type { TableKpi, TableSectionProps } from "./components/TableSection";

// Field-level validation: a map of field name to message, the formats every
// form agrees on, and focus-to-first-error. Any form that can fail should use
// this rather than a single sentence in a banner.
export {
  EARLIEST_BIRTHDATE,
  dateProblem,
  errorSummary,
  fieldId,
  firstError,
  focusField,
  hasErrors,
  isEmail,
  isPhone,
  today,
} from "./fieldValidation";
export type { DateProblem, FieldErrors } from "./fieldValidation";
