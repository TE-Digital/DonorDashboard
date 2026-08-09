// src/design-system/semantic.ts
//
// Single source of truth for "status value -> how it looks".
//
// This replaces the eight near-identical colour ladders that were copy-pasted
// across AdminScholarshipsPage, AdminEditDonorPage, AdminStudentDetailPage,
// DonorStudentDetailPage, AdminStudentsPage, AdminTeacherStudentsPage,
// AdminContactRequestsPage and AdminReportsPage.
//
// NOTE: this file maps a value to its appearance only. Deriving the value
// (e.g. "a student is overdue when they hold an active scholarship and have
// no report in the last six months") stays in the page that owns that rule.

export type BadgeVariant = "light" | "filled" | "outline";

export interface StatusMeta {
  label: string;
  color: string;
  variant: BadgeVariant;
}

const fallback: StatusMeta = { label: "—", color: "gray", variant: "light" };

/** scholarship_awards.status */
const scholarshipStatus: Record<string, StatusMeta> = {
  active: { label: "Active", color: "green", variant: "light" },
  planned: { label: "Planned", color: "yellow", variant: "light" },
  completed: { label: "Completed", color: "blue", variant: "light" },
  cancelled: { label: "Cancelled", color: "red", variant: "light" },
  // AdminStudentDetailPage stores this variant of "not running".
  inactive: { label: "Inactive", color: "red", variant: "light" },
};

/** Derived report freshness for a student. */
const reportStatus: Record<string, StatusMeta> = {
  ok: { label: "Up to date", color: "green", variant: "light" },
  missing: { label: "No report", color: "orange", variant: "light" },
  overdue: { label: "Overdue", color: "red", variant: "light" },
};

/** scholarship_awards.is_paid */
const paymentStatus: Record<string, StatusMeta> = {
  paid: { label: "Paid", color: "green", variant: "light" },
  unpaid: { label: "Not paid", color: "red", variant: "light" },
};

/** contact_requests.handled */
const contactStatus: Record<string, StatusMeta> = {
  open: { label: "Open", color: "red", variant: "light" },
  handled: { label: "Handled", color: "gray", variant: "light" },
};

/** Generic yes/no cell rendering used by the reports explorer. */
const booleanStatus: Record<string, StatusMeta> = {
  true: { label: "Yes", color: "green", variant: "light" },
  false: { label: "No", color: "gray", variant: "light" },
};

const registry = {
  scholarship: scholarshipStatus,
  report: reportStatus,
  payment: paymentStatus,
  contact: contactStatus,
  boolean: booleanStatus,
} as const;

export type StatusKind = keyof typeof registry;

/**
 * Look up the appearance for a status value.
 * Unknown / null values fall back to a neutral em-dash badge, matching the
 * behaviour the pages had before.
 */
export function getStatusMeta(
  kind: StatusKind,
  value: string | boolean | null | undefined,
  labelOverride?: string
): StatusMeta {
  if (value === null || value === undefined || value === "") {
    return labelOverride ? { ...fallback, label: labelOverride } : fallback;
  }

  const key = String(value).toLowerCase();
  const meta = registry[kind][key];

  if (!meta) {
    // Unknown status: keep the raw value visible rather than hiding it.
    return { label: labelOverride ?? String(value), color: "gray", variant: "light" };
  }

  return labelOverride ? { ...meta, label: labelOverride } : meta;
}
