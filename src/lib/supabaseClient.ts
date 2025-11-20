import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Teacher {
  id: string;
  user_id: string | null;
  school_id: string | null;
  created_at: string | null;
  name: string | null;
  contact: Json | null;
}

export type PersonRoleName = "admin" | "teacher" | "donor" | "agent";

export interface PersonRole {
  user_id: string;
  role: PersonRoleName;
  created_at: string | null;
}

export interface Student {
  id: string;
  name: string;
  school_id: string | null;
  scholarship: string | null;
  responsible_teacher_id: string | null;
  created_at: string | null;
  grant_type_id: string | null;
  birthdate: string | null;
  grade_level: string | null;
  village: string | null;
  bio: string | null;
  monthly_support_expected: number | null;
}

export interface TermUpdate {
  id: string;
  student_id: string | null;
  term_id: string | null;
  grade: string | null;
  info: string | null;
  attachments: Json | null;
  created_at: string | null;
  grade_text: string | null;
  grade_numeric: number | null;
  report_date: string | null;
  covers_start: string | null;
  covers_end: string | null;
}
