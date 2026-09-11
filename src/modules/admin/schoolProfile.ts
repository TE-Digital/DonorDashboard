// src/modules/admin/schoolProfile.ts
//
// The schools table stores only id, name, address and created_at. The approved
// design shows roughly twenty fields per school — system, status, grade range,
// dormitory, principal and contact details, a school code.
//
// Until those columns exist, every one of them is derived here, deterministically,
// from the row we do have. One module owns that derivation so the list screen,
// the detail screen and the wizard never disagree about what a school "is".
//
// Everything below is a placeholder. Nothing here is persisted, and no caller
// should treat these values as facts about the school.

export type SchoolStatus = "Active" | "Pending" | "Inactive";
export type SchoolSystem = "Government" | "Border Police";

export interface SchoolRecord {
  id: string;
  name: string;
  address: string | null;
  created_at: string | null;
  /**
   * A real column, unlike everything else derived here. Undefined only when the
   * caller did not select it, or before the is_active migration is applied.
   */
  is_active?: boolean | null;
  /**
   * Also a real column. Months between term reports for students here, and the
   * reason the students directory can say who is late. Undefined before the
   * reporting-period migration is applied.
   */
  reporting_period_months?: number | null;
  /**
   * Real columns as of the school-location migration, and the only place a
   * screen should read a school's location as fact.
   *
   * The `province` and `district` on SchoolProfile below are derived from the
   * address and, failing that, from the row id. They were always placeholders;
   * with these columns in place, anything that ranks, groups or funds by
   * location must read them and not the derived pair. Undefined before the
   * migration is applied, null when nobody has recorded it.
   */
  province?: string | null;
  district?: string | null;
}

export interface SchoolProfile {
  /** Human-facing identifier, stable for a given row. */
  displayId: string;
  code: string;
  system: SchoolSystem;
  status: SchoolStatus;
  province: string;
  district: string;
  gradeFrom: string;
  gradeTo: string;
  dormitory: string;
  enrollment: number;
  principal: string;
  principalPhone: string;
  principalEmail: string;
  contact: string;
  contactPhone: string;
  contactEmail: string;
  joined: string;
  notes: string;
}

export const GRADES = [
  "K1", "K2", "K3",
  "P1", "P2", "P3", "P4", "P5", "P6",
  "M1", "M2", "M3", "M4", "M5", "M6",
];

/**
 * The grade list as picker options, keeping whatever a record already holds.
 *
 * Grade was free text on the admin form and a "Grade 1…12" picker on the
 * teacher's, so the same column holds `P4`, `4`, `Grade 4` and `ป.4`, and every
 * grade filter downstream is wrong. One list fixes new records; carrying the
 * current value as its own option means fixing it does not silently blank the
 * older ones.
 */
export const gradeOptions = (current?: string | null): Array<{ value: string; label: string }> => {
  const options = GRADES.map((grade) => ({ value: grade, label: grade }));
  const held = (current ?? "").trim();
  return held && !GRADES.includes(held)
    ? [...options, { value: held, label: `${held} (as recorded)` }]
    : options;
};

export const SCHOOL_SYSTEMS: SchoolSystem[] = ["Government", "Border Police"];
export const SCHOOL_STATUSES: SchoolStatus[] = ["Active", "Pending", "Inactive"];
export const DORMITORY_OPTIONS = ["None", "Boys only", "Girls only", "Mixed dormitory"];

/**
 * How often a school reports. A student inherits the period of the school they
 * are assigned to, so this is set once, on the school, and never per student.
 */
export const REPORTING_PERIODS = [
  { value: "1", label: "Monthly" },
  { value: "3", label: "Every 3 months" },
  { value: "4", label: "Every 4 months (three terms)" },
  { value: "6", label: "Every 6 months (two terms)" },
  { value: "12", label: "Yearly" },
];

/** The period every school starts on, and the fallback when none is stored. */
export const DEFAULT_REPORTING_PERIOD_MONTHS = 6;

/** The stored period, or the default, never a value outside the allowed set. */
export const reportingPeriodMonths = (school: Pick<SchoolRecord, "reporting_period_months"> | null | undefined): number => {
  const months = Number(school?.reporting_period_months);
  return REPORTING_PERIODS.some((option) => Number(option.value) === months)
    ? months
    : DEFAULT_REPORTING_PERIOD_MONTHS;
};

/** "Every 4 months (three terms)" for a stored number of months. */
export const reportingPeriodLabel = (months: number | null | undefined): string =>
  REPORTING_PERIODS.find((option) => Number(option.value) === Number(months))?.label ??
  REPORTING_PERIODS.find((option) => Number(option.value) === DEFAULT_REPORTING_PERIOD_MONTHS)!.label;

export const PROVINCES = [
  "Amnat Charoen",
  "Ang Thong",
  "Bangkok",
  "Bueng Kan",
  "Buri Ram",
  "Chachoengsao",
  "Chai Nat",
  "Chaiyaphum",
  "Chanthaburi",
  "Chiang Mai",
  "Chiang Rai",
  "Chon Buri",
  "Chumphon",
  "Kalasin",
  "Kamphaeng Phet",
  "Kanchanaburi",
  "Khon Kaen",
  "Krabi",
  "Lampang",
  "Lamphun",
  "Loei",
  "Lop Buri",
  "Mae Hong Son",
  "Maha Sarakham",
  "Mukdahan",
  "Nakhon Nayok",
  "Nakhon Pathom",
  "Nakhon Phanom",
  "Nakhon Ratchasima",
  "Nakhon Sawan",
  "Nakhon Si Thammarat",
  "Nan",
  "Narathiwat",
  "Nong Bua Lam Phu",
  "Nong Khai",
  "Nonthaburi",
  "Pathum Thani",
  "Pattani",
  "Phang Nga",
  "Phatthalung",
  "Phayao",
  "Phetchabun",
  "Phetchaburi",
  "Phichit",
  "Phitsanulok",
  "Phra Nakhon Si Ayutthaya",
  "Phrae",
  "Phuket",
  "Prachin Buri",
  "Prachuap Khiri Khan",
  "Ranong",
  "Ratchaburi",
  "Rayong",
  "Roi Et",
  "Sa Kaeo",
  "Sakon Nakhon",
  "Samut Prakan",
  "Samut Sakhon",
  "Samut Songkhram",
  "Saraburi",
  "Satun",
  "Si Sa Ket",
  "Sing Buri",
  "Songkhla",
  "Sukhothai",
  "Suphan Buri",
  "Surat Thani",
  "Surin",
  "Tak",
  "Trang",
  "Trat",
  "Ubon Ratchathani",
  "Udon Thani",
  "Uthai Thani",
  "Uttaradit",
  "Yala",
  "Yasothon",
];

/** A small stable hash, so a school keeps the same derived values across loads. */
const hashOf = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const locationParts = (address: string | null): string[] =>
  (address ?? "").split(",").map((part) => part.trim()).filter(Boolean);

const PLACEHOLDER = "—";

export const deriveSchoolProfile = (school: SchoolRecord): SchoolProfile => {
  const seed = hashOf(school.id || school.name);
  const parts = locationParts(school.address);
  const system: SchoolSystem = /border|patrol|ตชด/i.test(school.name)
    ? "Border Police"
    : "Government";

  const gradeFrom = GRADES[seed % 3];
  const gradeTo = GRADES[6 + (seed % 4) * 2];

  return {
    displayId: `SCH-${String(1000 + (seed % 9000)).padStart(4, "0")}`,
    code: String(50100000 + (seed % 99999)),
    system,
    // The one status that is a fact rather than a placeholder: is_active is a
    // column, set by closing or reopening a school. Anything else is Active.
    status: school.is_active === false ? "Inactive" : "Active",
    province: parts.at(-1) ?? PLACEHOLDER,
    district: parts.at(-2) ?? PLACEHOLDER,
    gradeFrom,
    gradeTo,
    dormitory: system === "Border Police" ? "Mixed dormitory" : DORMITORY_OPTIONS[seed % 3],
    enrollment: 0,
    principal: PLACEHOLDER,
    principalPhone: PLACEHOLDER,
    principalEmail: PLACEHOLDER,
    contact: PLACEHOLDER,
    contactPhone: PLACEHOLDER,
    contactEmail: PLACEHOLDER,
    joined: school.created_at ? new Date(school.created_at).toLocaleDateString() : PLACEHOLDER,
    notes: "",
  };
};

/** Badge tone for a school status, matching the design system's tone names. */
export const statusTone = (status: SchoolStatus): "success" | "warning" | "neutral" =>
  status === "Active" ? "success" : status === "Pending" ? "warning" : "neutral";
