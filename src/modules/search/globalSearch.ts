// src/modules/search/globalSearch.ts
//
// One query across the directory: students, teachers, schools and donors.
// Each category is its own Supabase request so a slow or failing table never
// hides the rest — a category that errors comes back empty and the others
// still render.
//
// What a person can find is what their role can already open, so the results
// route into that role's own screens (a teacher's hit lands on
// /teacher/students/:id, not the admin record).

import { supabase } from "../../lib/supabaseClient";

export type SearchCategory = "students" | "teachers" | "schools" | "donors";

export interface SearchHit {
  id: string;
  category: SearchCategory;
  title: string;
  /** The line under the title: school, grade, email — whatever identifies it. */
  subtitle?: string;
  to: string;
}

export const CATEGORY_LABELS: Record<SearchCategory, string> = {
  students: "Students",
  teachers: "Teachers",
  schools: "Schools",
  donors: "Donors",
};

export const CATEGORY_MARKS: Record<SearchCategory, { icon: string; accent: string }> = {
  students: { icon: "users", accent: "blue" },
  teachers: { icon: "contact", accent: "teal" },
  schools: { icon: "school", accent: "amber" },
  donors: { icon: "hand-coins", accent: "plum" },
};

export const CATEGORY_ORDER: SearchCategory[] = ["students", "teachers", "schools", "donors"];

/**
 * PostgREST reads `or=(...)` as its own little grammar: commas separate the
 * branches, parentheses close the list and `%`/`*` are wildcards. A name typed
 * with any of those would either break the request or widen it silently, so
 * they come out before the term is spliced in.
 */
function safeTerm(raw: string): string {
  return raw.trim().replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
}

function ilikeAny(term: string, columns: string[]): string {
  return columns.map((c) => `${c}.ilike.%${term}%`).join(",");
}

const PER_CATEGORY = 5;

async function searchStudents(term: string, basePath: string): Promise<SearchHit[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, nickname, grade_level, village, school_id")
    .or(ilikeAny(term, ["name", "nickname", "village", "grade_level"]))
    .order("name")
    .limit(PER_CATEGORY);

  if (error || !data) return [];

  const schoolIds = Array.from(new Set(data.map((s: any) => s.school_id).filter(Boolean)));
  const names = new Map<string, string>();
  if (schoolIds.length) {
    const { data: schools } = await supabase.from("schools").select("id, name").in("id", schoolIds);
    (schools ?? []).forEach((s: any) => names.set(s.id, s.name));
  }

  return data.map((s: any) => ({
    id: s.id,
    category: "students" as const,
    title: s.nickname ? `${s.name} (${s.nickname})` : s.name,
    subtitle: [names.get(s.school_id), s.grade_level, s.village].filter(Boolean).join(" · "),
    to: `${basePath}/students/${s.id}`,
  }));
}

async function searchTeachers(term: string): Promise<SearchHit[]> {
  // Profiles carry every account; person_roles says which of them teach. Match
  // first, then narrow — the alternative is pulling the whole role table.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .or(ilikeAny(term, ["full_name", "email", "phone"]))
    .limit(20);

  if (error || !data || data.length === 0) return [];

  const { data: roles } = await supabase
    .from("person_roles")
    .select("user_id, role")
    .in(
      "user_id",
      data.map((p: any) => p.id),
    );

  const teachers = new Set(
    (roles ?? []).filter((r: any) => r.role === "teacher").map((r: any) => r.user_id),
  );

  return data
    .filter((p: any) => teachers.has(p.id))
    .slice(0, PER_CATEGORY)
    .map((p: any) => ({
      id: p.id,
      category: "teachers" as const,
      title: p.full_name || p.email || "(no name)",
      subtitle: [p.email, p.phone].filter(Boolean).join(" · "),
      to: `/admin/teachers/${p.id}`,
    }));
}

async function searchSchools(term: string): Promise<SearchHit[]> {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, address")
    .or(ilikeAny(term, ["name", "address"]))
    .order("name")
    .limit(PER_CATEGORY);

  if (error || !data) return [];

  return data.map((s: any) => ({
    id: s.id,
    category: "schools" as const,
    title: s.name,
    subtitle: s.address || undefined,
    to: `/admin/schools/${s.id}`,
  }));
}

async function searchDonors(term: string): Promise<SearchHit[]> {
  const { data, error } = await supabase
    .from("donors")
    .select("id, name, contact")
    .ilike("name", `%${term}%`)
    .order("name")
    .limit(PER_CATEGORY);

  if (error || !data) return [];

  return data.map((d: any) => {
    const contact = (d.contact ?? {}) as { email?: string | null; phone?: string | null };
    return {
      id: d.id,
      category: "donors" as const,
      title: d.name || "Anonymous donor",
      subtitle: [contact.email, contact.phone].filter(Boolean).join(" · "),
      // Donors have no read-only record of their own; the edit form is it.
      to: `/admin/donors/${d.id}/edit`,
    };
  });
}

/** Which categories a role may search, in the order they are shown. */
export function categoriesForRole(role: string | null): SearchCategory[] {
  if (role === "admin") return CATEGORY_ORDER;
  // Teachers and donors only ever see their own students; the row-level rules
  // on `students` are what actually scope it.
  return ["students"];
}

export async function runGlobalSearch(
  rawTerm: string,
  role: string | null,
): Promise<Record<SearchCategory, SearchHit[]>> {
  const empty: Record<SearchCategory, SearchHit[]> = {
    students: [],
    teachers: [],
    schools: [],
    donors: [],
  };

  const term = safeTerm(rawTerm);
  if (term.length < 2) return empty;

  const basePath = role === "teacher" ? "/teacher" : role === "donor" ? "/donor" : "/admin";
  const wanted = categoriesForRole(role);

  const results = await Promise.all(
    wanted.map((category) => {
      switch (category) {
        case "students":
          return searchStudents(term, basePath);
        case "teachers":
          return searchTeachers(term);
        case "schools":
          return searchSchools(term);
        case "donors":
          return searchDonors(term);
        default:
          return Promise.resolve([]);
      }
    }),
  );

  wanted.forEach((category, i) => {
    empty[category] = results[i] ?? [];
  });

  return empty;
}
