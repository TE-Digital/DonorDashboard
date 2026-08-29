// src/modules/donor/DonorOverviewPage.tsx
//
// Where a donor lands.
//
// Before this the donor's entry point was a table of students, which answered a
// question nobody arrives with. A donor opens this platform after a term ends,
// usually from an email, usually on a phone, and wants three things in this
// order: is there news about the children I fund, are they alright, and what
// has my money done.
//
// So the reports come first. The balance is present but small — a donor did not
// come here to read a treasury report, and framing their giving as a portfolio
// would be the wrong product entirely.

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { LoadingState, formatDate } from "../../design-system";
import { Badge, Button, EmptyState } from "../../design-system/lumen";
import { DonorReportCard } from "../reports/DonorReportCard";
import {
  hasOpenFlag,
  loadDonorReportFeed,
  type DonorReport,
} from "../reports/donorReports";
import { studentPhotoUrl } from "../admin/studentProfile";
import { DonorBalanceCard } from "./DonorBalanceCard";
import { loadDonorBalance, type DonorBalance } from "./donorMoney";
import styles from "./DonorOverviewPage.module.scss";

interface SupportedStudent {
  id: string;
  name: string;
  gradeLevel: string | null;
  photoPath: string | null;
}

export const DonorOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [donorId, setDonorId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState<string | null>(null);
  const [balance, setBalance] = useState<DonorBalance | null>(null);
  const [moneyAvailable, setMoneyAvailable] = useState(true);
  const [students, setStudents] = useState<SupportedStudent[]>([]);
  const [reports, setReports] = useState<DonorReport[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    const uid = session?.user?.id ?? null;
    setUserId(uid);

    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: donorRow } = await supabase
      .from("donors")
      .select("id, name")
      .eq("user_id", uid)
      .maybeSingle();

    if (!donorRow) {
      setLoading(false);
      return;
    }

    setDonorId(donorRow.id);
    setDonorName(donorRow.name ?? null);

    const [balanceRead, links] = await Promise.all([
      loadDonorBalance(donorRow.id),
      supabase
        .from("scholarships")
        .select("student_id, students(id, name, grade_level, profile_photo_path)")
        .eq("donor_id", donorRow.id)
        .eq("status", "active"),
    ]);

    setBalance(balanceRead.data);
    setMoneyAvailable(balanceRead.available);

    // One card per student, even where two scholarships fund the same child.
    const byId = new Map<string, SupportedStudent>();
    (links.data ?? []).forEach((row: any) => {
      const student = row.students;
      if (!student) return;
      byId.set(student.id, {
        id: student.id,
        name: student.name ?? "Student",
        gradeLevel: student.grade_level ?? null,
        photoPath: student.profile_photo_path ?? null,
      });
    });

    const list = Array.from(byId.values());
    setStudents(list);

    setReports(await loadDonorReportFeed(list.map((s) => s.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;

  if (!donorId) {
    return (
      <EmptyState
        icon="circle-help"
        title="This account is not linked to a donor record"
        description="Ask iCare to connect your sign-in to your donor profile."
      />
    );
  }

  const openFlags = reports.filter(hasOpenFlag);
  const studentName = (id: string | null) =>
    students.find((s) => s.id === id)?.name ?? undefined;

  return (
    <div className={styles.page}>
      <header className={styles.greeting}>
        <h1 className={styles.hello}>
          {donorName ? `Hello, ${donorName}` : "Your students"}
        </h1>
        <p className={styles.sub}>
          {students.length === 0
            ? "You are not yet supporting a student. iCare will let you know when you are matched."
            : `You are supporting ${students.length} student${students.length === 1 ? "" : "s"}. ${
                reports.length === 0
                  ? "No reports have arrived yet."
                  : `The most recent report arrived ${formatDate(
                      reports[0].approved_at ?? reports[0].report_date,
                    )}.`
              }`}
        </p>
      </header>

      {openFlags.length > 0 && (
        <div className={styles.flags}>
          <span className={styles.flagsTitle}>
            You are waiting on {openFlags.length} answer{openFlags.length === 1 ? "" : "s"}
          </span>
          {openFlags.map((report) => (
            <span key={report.id}>
              {studentName(report.student_id)} · {report.flag_reason || "Question raised"}
            </span>
          ))}
        </div>
      )}

      <div className={styles.top}>
        <section aria-label="Students you support">
          <h2 className={styles.sectionTitle}>Your students</h2>
          {students.length === 0 ? (
            <EmptyState
              icon="graduation-cap"
              title="No students yet"
              description="When your giving is matched to a student, they appear here."
            />
          ) : (
            <div className={styles.students}>
              {students.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={styles.student}
                  onClick={() => navigate(`/donor/students/${student.id}`)}
                >
                  {/* Decorative: the name is right beside it, so a screen
                      reader announcing the photo too would say it twice.

                      No src="" fallback: an empty src resolves against the
                      current URL, so the browser re-requests the page as an
                      image and draws a broken-image icon. A student with no
                      photo gets the empty circle instead. */}
                  {studentPhotoUrl(student.photoPath) ? (
                    <img
                      className={styles.avatar}
                      src={studentPhotoUrl(student.photoPath) as string}
                      alt=""
                    />
                  ) : (
                    <span className={styles.avatar} aria-hidden="true" />
                  )}
                  <span className={styles.studentText}>
                    <span className={styles.studentName}>{student.name}</span>
                    <span className={styles.studentMeta}>
                      {student.gradeLevel ? `Grade ${student.gradeLevel}` : "Grade not recorded"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {balance && (
          <section aria-label="Your giving">
            <h2 className={styles.sectionTitle}>Your giving</h2>
            <DonorBalanceCard balance={balance} donorView compact unavailable={!moneyAvailable} />
          </section>
        )}
      </div>

      <section aria-label="Reports" className={styles.reports}>
        <h2 className={styles.sectionTitle}>
          Reports
          {reports.length > 0 && <Badge tone="neutral"> {reports.length}</Badge>}
        </h2>

        {reports.length === 0 ? (
          <EmptyState
            icon="clipboard-list"
            title="No reports yet"
            description="Reports arrive at the end of each school term, once a teacher has written one and iCare has checked it."
          />
        ) : (
          reports.map((report) => (
            <DonorReportCard
              key={report.id}
              report={report}
              studentName={studentName(report.student_id)}
              currentUserId={userId}
              onChanged={load}
            />
          ))
        )}
      </section>

      <div>
        <Button variant="ghost" onClick={() => navigate("/donor/dashboard")}>
          See all students in a list
        </Button>
      </div>
    </div>
  );
};

export default DonorOverviewPage;
