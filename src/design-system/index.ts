// src/design-system/index.ts
//
// Single import surface for the presentation layer.
// Pages should import from here, never from the individual files.

export * from "./tokens";
export * from "./typography";
export * from "./semantic";
export * from "./format";
export * from "./branding";
export * from "./theme";
export * from "./cssVars";

export { PageHeader } from "./components/PageHeader";
export type { PageHeaderProps } from "./components/PageHeader";

export { SectionCard } from "./components/SectionCard";
export type { SectionCardProps } from "./components/SectionCard";

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
  FormError,
  FormFooter,
} from "./components/FormLayout";
export type {
  FormPageProps,
  FormBodyProps,
  FormSectionProps,
  FieldLabelProps,
  FormFooterProps,
  FormStep,
} from "./components/FormLayout";

export { FormActions } from "./components/FormActions";
export type { FormActionsProps } from "./components/FormActions";

// The standard list-screen shape: KPI row, filter bar, sortable + filterable
// grid, pagination. Every table in the product is built from this.
export { TableSection } from "./components/TableSection";
export type { TableKpi, TableSectionProps } from "./components/TableSection";
