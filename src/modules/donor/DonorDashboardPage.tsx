// src/modules/donor/DonorDashboardPage.tsx
import React, { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Image,
  Avatar,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { toOne } from "../../lib/supabaseRelations";
import { useAuth } from "../auth/AuthContext";
import {
  EmptyState,
  InlineMessage,
  KpiRow,
  LoadingState,
  PageHeader,
} from "../../design-system";

type StudentCard = {
  studentId: string;
  name: string;
  nickname: string | null;
  gradeLevel: string | null;
  schoolName: string | null;
  profilePhotoUrl: string | null;
  latestReportDate: string | null;
  latestReportSummary: string | null;
  latestReportPhotoUrl: string | null;
  totalAwardedForStudent: number;
  currency: string | null;
};

type SummaryStats = {
  totalStudents: number;
  totalAmount: number;
  currency: string | null;
  lastScholarshipDate: string | null;
};

// 🔹 NEW: simple helper to only use image files as cover photos
const isImagePath = (path: string) =>
  /\.(jpe?g|png|webp|gif|heic)$/i.test(path);

export const DonorDashboardPage: React.FC = () => {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryStats>({
    totalStudents: 0,
    totalAmount: 0,
    currency: null,
    lastScholarshipDate: null,
  });
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [dashboardDisabledMessage, setDashboardDisabledMessage] =
    useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;

      setLoading(true);
      setError(null);
      setDashboardDisabledMessage(null);

      try {
        // 1) Find donor row for this user (and check dashboard flag)
        const { data: donorRow, error: donorError } = await supabase
          .from("donors")
          .select("id, is_dashboard_enabled")
          .eq("user_id", profile.id)
          .maybeSingle();

        if (donorError) {
          console.error("Error loading donor profile", donorError);
          setError("Could not load donor profile.");
          setLoading(false);
          return;
        }

        if (!donorRow) {
          setError(
            "Your account is not linked to a donor profile yet. Please contact the administrator."
          );
          setLoading(false);
          return;
        }

        if (donorRow.is_dashboard_enabled === false) {
          setDashboardDisabledMessage(
            "Your donor dashboard is currently disabled. Please contact the administrator if you believe this is a mistake."
          );
          setLoading(false);
          return;
        }

        const donorId = donorRow.id as string;

        // 2) Load all scholarship awards for this donor
        const { data: awardRows, error: awardError } = await supabase
          .from("scholarship_awards")
          .select(
            `
            id,
            student_id,
            amount_for_period,
            currency,
            status,
            payment_date,
            period_start,
            period_end,
            student:students (
              id,
              name,
              nickname,
              grade_level,
              profile_photo_path,
              school:schools ( name )
            ),
            grant_types ( name )
          `
          )
          .eq("donor_id", donorId)
          .order("period_start", { ascending: false });

        if (awardError) {
          console.error(
            "Error loading scholarship awards for donor",
            awardError
          );
          setError("Could not load scholarship data.");
          setLoading(false);
          return;
        }

        const awards = awardRows ?? [];

        if (awards.length === 0) {
          setSummary({
            totalStudents: 0,
            totalAmount: 0,
            currency: null,
            lastScholarshipDate: null,
          });
          setStudents([]);
          setLoading(false);
          return;
        }

        // 3) Aggregate basic stats and collect student IDs
        const studentIdSet = new Set<string>();
        let totalAmount = 0;
        let currency: string | null = null;
        let lastScholarshipDate: string | null = null;

        type AwardRow = (typeof awards)[number];
        const awardsByStudent = new Map<string, AwardRow[]>();

        awards.forEach((a: any) => {
          const sid = a.student_id as string | null;
          if (!sid) return;

          studentIdSet.add(sid);

          if (a.amount_for_period != null) {
            totalAmount += Number(a.amount_for_period);
            if (!currency) {
              currency = a.currency ?? "THB";
            }
          }

          const dateCandidate: string | null =
            a.payment_date || a.period_end || a.period_start || null;
          if (dateCandidate) {
            if (!lastScholarshipDate || dateCandidate > lastScholarshipDate) {
              lastScholarshipDate = dateCandidate;
            }
          }

          const existing = awardsByStudent.get(sid) ?? [];
          existing.push(a);
          awardsByStudent.set(sid, existing);
        });

        const studentIds = Array.from(studentIdSet);

        if (studentIds.length === 0) {
          setSummary({
            totalStudents: 0,
            totalAmount,
            currency,
            lastScholarshipDate,
          });
          setStudents([]);
          setLoading(false);
          return;
        }

        // 4) Load latest reports for all these students
        const { data: reportRows, error: reportError } = await supabase
          .from("term_updates")
          .select(
            `
            id,
            student_id,
            report_date,
            grade_text,
            info,
            attachments
          `
          )
          .in("student_id", studentIds)
          .order("report_date", { ascending: false });

        if (reportError) {
          console.error(
            "Error loading term updates for donor dashboard",
            reportError
          );
        }

        const reports = reportRows ?? [];

        // pick latest report per student
        const latestReportByStudent = new Map<
          string,
          (typeof reports)[number]
        >();
        for (const r of reports) {
          const sid = r.student_id as string | null;
          if (!sid) continue;
          if (!latestReportByStudent.has(sid)) {
            latestReportByStudent.set(sid, r);
          }
        }

        // 5) Build student cards (with storage URLs)
        const cards: StudentCard[] = await Promise.all(
          studentIds.map(async (sid) => {
            const studentAwards = awardsByStudent.get(sid) ?? [];
            const firstAward = studentAwards[0];
            const studentInfo = toOne(firstAward?.student);

            // total awarded for that student (all periods)
            const totalForStudent = studentAwards.reduce(
              (sum, a: any) =>
                sum +
                (a.amount_for_period != null
                  ? Number(a.amount_for_period)
                  : 0),
              0
            );

            const studentCurrency =
              firstAward?.currency ?? currency ?? "THB";

            // profile photo
            let profilePhotoUrl: string | null = null;
            const profilePath = studentInfo?.profile_photo_path as
              | string
              | null
              | undefined;

            if (profilePath) {
              const { data } = supabase.storage
                .from("student-profiles")
                .getPublicUrl(profilePath);
              profilePhotoUrl = data.publicUrl ?? null;
            }

            // latest report info + photo
            const report = latestReportByStudent.get(sid) as
              | {
                  report_date: string | null;
                  grade_text: string | null;
                  info: string | null;
                  attachments: any;
                }
              | undefined;

            let latestReportDate: string | null = null;
            let latestReportSummary: string | null = null;
            let latestReportPhotoUrl: string | null = null;

            if (report) {
              latestReportDate = report.report_date;

              if (report.grade_text) {
                latestReportSummary = report.grade_text;
              } else if (report.info) {
                const trimmed = report.info.trim();
                latestReportSummary =
                  trimmed.length > 140
                    ? trimmed.slice(0, 137) + "…"
                    : trimmed;
              }

              // 🔹 attachments -> try to get first *image* only
              const attachments = (report.attachments ?? []) as {
                path: string;
                is_public?: boolean;
              }[];

              const firstImage = attachments.find(
                (a) => a && a.path && isImagePath(a.path)
              );

              if (firstImage?.path) {
                try {
                  const { data, error } = await supabase.storage
                    .from("progress-photos")
                    .createSignedUrl(firstImage.path, 60 * 60); // 1h

                  if (!error && data?.signedUrl) {
                    latestReportPhotoUrl = data.signedUrl;
                  }
                } catch (e) {
                  console.error(
                    "Error creating signed URL for report photo",
                    e
                  );
                }
              }
            }

            return {
              studentId: sid,
              nickname: studentInfo?.nickname ?? null,
              name: studentInfo?.name ?? "(no name)",
              gradeLevel: studentInfo?.grade_level ?? null,
              schoolName: toOne(studentInfo?.school)?.name ?? null,
              profilePhotoUrl,
              latestReportDate,
              latestReportSummary,
              latestReportPhotoUrl,
              totalAwardedForStudent: totalForStudent,
              currency: studentCurrency,
            };
          })
        );

        setSummary({
          totalStudents: studentIds.length,
          totalAmount,
          currency,
          lastScholarshipDate,
        });
        setStudents(cards);
      } catch (err: any) {
        console.error("Unexpected error loading donor dashboard", err);
        setError(
          err.message ?? "Unexpected error while loading donor dashboard."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile]);

  if (loading) {
    return <LoadingState />;
  }

  if (dashboardDisabledMessage) {
    return (
      <Stack>
        <PageHeader title="Donor dashboard" />
        <Card>
          <EmptyState title={dashboardDisabledMessage} />
        </Card>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack>
        <PageHeader title="Donor dashboard" />
        <Card>
          <InlineMessage tone="error">{error}</InlineMessage>
        </Card>
      </Stack>
    );
  }

  const summaryAmountLabel =
    summary.totalAmount > 0
      ? `${summary.totalAmount.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })} ${summary.currency || "THB"}`
      : "—";

  const lastScholarshipLabel = summary.lastScholarshipDate
    ? new Date(summary.lastScholarshipDate).toLocaleDateString()
    : "—";

  return (
    <Stack>
      <PageHeader
        title="Your impact dashboard"
        subtitle="Thank you for supporting education. Here are the latest updates from the students you support."
        actions={
          <Button variant="default" component={Link} to="/donor/renew">
            Continue your impact
          </Button>
        }
      />

      <KpiRow
        items={[
          { label: "Students supported", value: summary.totalStudents.toString(), mark: "students" },
          { label: "Total awarded", value: summaryAmountLabel, mark: "money" },
          { label: "Last scholarship", value: lastScholarshipLabel, mark: "time" },
        ]}
      />

      {students.length === 0 ? (
        <Card mt="md">
          <EmptyState title="No scholarships are linked to your donor account yet. Once a scholarship award is created for you, updates will appear here." />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} mt="md">
          {students.map((s) => (
            <StudentImpactCard key={s.studentId} student={s} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
};


const StudentImpactCard: React.FC<{ student: StudentCard }> = ({
  student,
}) => {
  const coverPhoto = student.latestReportPhotoUrl || student.profilePhotoUrl;

  const reportDateLabel = student.latestReportDate
    ? new Date(student.latestReportDate).toLocaleDateString()
    : null;

  const amountLabel =
    student.totalAwardedForStudent > 0
      ? `${student.totalAwardedForStudent.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })} ${student.currency || "THB"}`
      : null;

  const displayName = student.nickname || student.name;
  const initials = displayName?.trim().charAt(0) || "?";

  return (
    <Card withBorder radius="md" shadow="xs">
      <Stack gap="xs">
        {coverPhoto ? (
          <div style={{ position: "relative" }}>
            <Image
              src={coverPhoto}
              alt={displayName}
              radius="md"
              height={160}
              fit="cover"
            />
            {student.profilePhotoUrl && (
              <Avatar
                src={student.profilePhotoUrl}
                radius="xl"
                size={56}
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  border: "2px solid white",
                }}
              />
            )}
          </div>
        ) : (
          <Group justify="center" mt="xs" mb="xs">
            <Avatar radius="xl" size={80}>
              {initials}
            </Avatar>
          </Group>
        )}

        <Stack gap={2}>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600}>
                {displayName}
                {student.gradeLevel ? ` – Grade ${student.gradeLevel}` : ""}
              </Text>
              <Text size="xs" c="dimmed">
                {student.schoolName || "No school information"}
              </Text>
            </div>
            {amountLabel && (
              <Badge variant="light" size="sm">
                {amountLabel}
              </Badge>
            )}
          </Group>

          {reportDateLabel && (
            <Text size="xs" c="dimmed">
              Last report: {reportDateLabel}
            </Text>
          )}

          {student.latestReportSummary && (
            <Text size="sm">{student.latestReportSummary}</Text>
          )}
        </Stack>

        <Group justify="flex-end" mt="xs">
          <Button
            component={Link}
            to={`/donor/students/${student.studentId}`}
            size="xs"
            variant="light"
          >
            View full updates
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default DonorDashboardPage;
