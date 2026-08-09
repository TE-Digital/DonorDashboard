// src/modules/donor/DonorStudentDetailPage.tsx
import React, { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { IconDownload, IconFile, IconPhoto } from "@tabler/icons-react";
import { supabase } from "../../lib/supabaseClient";
import { asRow, asRows } from "../../lib/supabaseRelations";
import { useAuth } from "../auth/AuthContext";
import {
  LoadingState,
  PageHeader,
  StatusBadge,
} from "../../design-system";

type DonorRow = {
  id: string;
};

type StudentRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  grade_level: string | null;
  village: string | null;
  profile_photo_path: string | null;
  school: { name: string | null } | null;
};

type ScholarshipAwardRow = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null;
  currency: string | null;
  status: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  grant_types: { name: string | null } | null;
};

type ReportRow = {
  id: string;
  report_date: string | null;
  covers_start: string | null;
  covers_end: string | null;
  grade: string | null;
  grade_text: string | null;
  grade_numeric: number | null;
  donor_comment: string | null;
  info: string | null;
  // JSONB column: [{ path, is_public }, ...]
  attachments: { path: string; is_public?: boolean | null }[] | null;
};

type ReportPhoto = {
  path: string;
  url: string;
};

type ProcessedAttachment = {
  path: string;
  url: string;
  isImage: boolean;
  fileName: string;
};

type DecoratedReport = ReportRow & {
  photos: ReportPhoto[];
  processedAttachments: ProcessedAttachment[];
};

type SummaryStats = {
  totalAmount: number;
  currency: string | null;
  lastScholarshipDate: string | null;
};

export const DonorStudentDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [studentPhotoUrl, setStudentPhotoUrl] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryStats>({
    totalAmount: 0,
    currency: null,
    lastScholarshipDate: null,
  });

  const [awards, setAwards] = useState<ScholarshipAwardRow[]>([]);
  const [reports, setReports] = useState<DecoratedReport[]>([]);

  // image preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile || !studentId) {
        setError("Could not load donor or student information.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Find donor for logged-in user (and ensure dashboard is enabled)
        const { data: donorRow, error: donorError } = await supabase
          .from("donors")
          .select("id")
          .eq("user_id", profile.id)
          .eq("is_dashboard_enabled", true)
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

        const donorId = (donorRow as DonorRow).id;

        // 2) Load student basics
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select(
            `
            id,
            name,
            nickname,
            grade_level,
            village,
            profile_photo_path,
            school:schools ( name )
          `
          )
          .eq("id", studentId)
          .maybeSingle();

        if (studentError || !studentData) {
          console.error("Error loading student", studentError);
          setError("Could not load student information.");
          setLoading(false);
          return;
        }

        const s = asRow<StudentRow>(studentData);
        setStudent(s);

        // student profile photo (public bucket "student-profiles")
        if (s.profile_photo_path) {
          const { data } = supabase.storage
            .from("student-profiles")
            .getPublicUrl(s.profile_photo_path);
          setStudentPhotoUrl(data.publicUrl ?? null);
        }

        // 3) Scholarship awards for this donor & student
        const { data: awardRows, error: awardError } = await supabase
          .from("scholarship_awards")
          .select(
            `
            id,
            period_start,
            period_end,
            amount_for_period,
            currency,
            status,
            is_paid,
            payment_date,
            grant_types ( name )
          `
          )
          .eq("donor_id", donorId)
          .eq("student_id", studentId)
          .order("period_start", { ascending: false });

        if (awardError) {
          console.error(
            "Error loading scholarship awards for donor/student",
            awardError
          );
        }

        const awardsData = asRows<ScholarshipAwardRow>(awardRows);
        setAwards(awardsData);

        // summary: total amount & last scholarship date
        let totalAmount = 0;
        let currency: string | null = null;
        let lastScholarshipDate: string | null = null;

        awardsData.forEach((a) => {
          if (a.amount_for_period != null) {
            totalAmount += Number(a.amount_for_period);
            if (!currency) currency = a.currency ?? "THB";
          }
          const dateCandidate =
            a.payment_date || a.period_end || a.period_start || null;
          if (dateCandidate) {
            if (!lastScholarshipDate || dateCandidate > lastScholarshipDate) {
              lastScholarshipDate = dateCandidate;
            }
          }
        });

        setSummary({
          totalAmount,
          currency,
          lastScholarshipDate,
        });

        // 4) All progress reports for this student
        const { data: reportRows, error: reportError } = await supabase
          .from("term_updates")
          .select(
            `
            id,
            report_date,
            covers_start,
            covers_end,
            grade,
            grade_text,
            grade_numeric,
            donor_comment,
            info,
            attachments
          `
          )
          .eq("student_id", studentId)
          .order("report_date", { ascending: false });

        if (reportError) {
          console.error(
            "Error loading term updates for donor student detail",
            reportError
          );
        }

        const rawReports = (reportRows ?? []) as ReportRow[];

        // Build per-report image list (only public image files)
        const decorated: DecoratedReport[] = await Promise.all(
          rawReports.map(async (r) => {
            const attachments = (r.attachments ?? []) as {
              path: string;
              is_public?: boolean | null;
            }[];

            // Filter for public attachments
            const publicAttachments = attachments.filter(
              (a) => a?.path && a.is_public === true
            );

            const processedAttachments: ProcessedAttachment[] = [];
            const photos: ReportPhoto[] = [];

            for (const att of publicAttachments) {
              try {
                const { data, error } = await supabase.storage
                  .from("progress-photos")
                  .createSignedUrl(att.path, 60 * 60); // 1 hour

                if (!error && data?.signedUrl) {
                  const isImage = /\.(jpe?g|png|webp|gif)$/i.test(
                    (att.path.split("?")[0] ?? "").toLowerCase()
                  );
                  const fileName = att.path.split("/").pop() ?? "file";

                  processedAttachments.push({
                    path: att.path,
                    url: data.signedUrl,
                    isImage,
                    fileName,
                  });

                  if (isImage) {
                    photos.push({
                      path: att.path,
                      url: data.signedUrl,
                    });
                  }
                }
              } catch (e) {
                console.error("Error creating signed URL for report photo", e);
              }
            }

            return {
              ...r,
              photos,
              processedAttachments,
            };
          })
        );

        setReports(decorated);
      } catch (err: any) {
        console.error("Unexpected error loading donor student detail", err);
        setError(
          err?.message ?? "Unexpected error while loading the student updates."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile, studentId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={700} size="lg">
            Student updates
          </Text>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => navigate("/donor/dashboard")}
          >
            Back to dashboard
          </Button>
        </Group>
        <Card withBorder>
          <Text c="red" size="sm">
            {error}
          </Text>
        </Card>
      </Stack>
    );
  }

  if (!student) {
    return (
      <Stack>
        <Text fw={700} size="lg">
          Student updates
        </Text>
        <Card withBorder>
          <Text size="sm">Student could not be found.</Text>
        </Card>
      </Stack>
    );
  }

  const lastScholarshipLabel = summary.lastScholarshipDate
    ? new Date(summary.lastScholarshipDate).toLocaleDateString()
    : "—";

  const totalAmountLabel =
    summary.totalAmount > 0
      ? `${summary.totalAmount.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })} ${summary.currency || "THB"}`
      : "—";

  const displayName = student.nickname || student.name || "(no name)";
  const schoolName = student.school?.name ?? null;

  return (
    <>
      {/* Image preview modal */}
      <Modal
        opened={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        centered
        size="lg"
        withCloseButton
        title="Progress photo"
      >
        {previewUrl && (
          <Image src={previewUrl} alt="Progress photo" radius="md" />
        )}
      </Modal>

      <Stack>
        <Group justify="space-between" align="center" mb="xs">
          <Text fw={700} size="lg">
            Updates for {displayName}
          </Text>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => navigate("/donor/dashboard")}
          >
            Back to dashboard
          </Button>
        </Group>

        {/* Student overview */}
        <Card withBorder radius="md">
          <Group align="flex-start" gap="lg">
            {studentPhotoUrl ? (
              <Image
                src={studentPhotoUrl}
                alt={displayName}
                radius="md"
                w={140}
                h={140}
                fit="cover"
              />
            ) : (
              <Avatar radius="xl" size={80}>
                {displayName.charAt(0)}
              </Avatar>
            )}

            <Stack gap={4}>
              <Text fw={600} size="lg">
                {displayName}
                {student.grade_level ? ` – Grade ${student.grade_level}` : ""}
              </Text>
              <Text size="sm" c="dimmed">
                {schoolName || "No school information"}
                {student.village ? ` • ${student.village}` : ""}
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 3 }} mt="sm">
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">
                    Total awarded
                  </Text>
                  <Text fw={600}>{totalAmountLabel}</Text>
                </Stack>

                <Stack gap={2}>
                  <Text size="xs" c="dimmed">
                    Last scholarship
                  </Text>
                  <Text fw={600}>{lastScholarshipLabel}</Text>
                </Stack>

                <Stack gap={2}>
                  <Text size="xs" c="dimmed">
                    Reports
                  </Text>
                  <Text fw={600}>{reports.length}</Text>
                </Stack>
              </SimpleGrid>
            </Stack>
          </Group>
        </Card>

        {/* Scholarships for this student (from this donor) */}
        <Card withBorder radius="md">
          <Stack gap="xs">
            <Text fw={600}>Scholarship history</Text>
            {awards.length === 0 ? (
              <Text size="sm" c="dimmed">
                No scholarships recorded for this student from your donations
                yet.
              </Text>
            ) : (
              <Stack gap="xs">
                {awards.map((a) => {
                  const periodLabel =
                    a.period_start && a.period_end
                      ? `${new Date(
                          a.period_start
                        ).toLocaleDateString()} – ${new Date(
                          a.period_end
                        ).toLocaleDateString()}`
                      : "—";

                  const amountLabel =
                    a.amount_for_period != null
                      ? `${a.amount_for_period.toLocaleString("en-US", {
                          maximumFractionDigits: 0,
                        })} ${a.currency || "THB"}`
                      : "—";

                  return (
                    <Group
                      key={a.id}
                      justify="space-between"
                      align="flex-start"
                    >
                      <Stack gap={2}>
                        <Text size="sm">
                          {a.grant_types?.name ?? "Scholarship"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {periodLabel}
                        </Text>
                      </Stack>
                      <Group gap="sm">
                        <Text size="sm" fw={600}>
                          {amountLabel}
                        </Text>
                        {a.status && (
                          <StatusBadge
                            kind="scholarship"
                            value={a.status}
                            size="xs"
                          />
                        )}
                      </Group>
                    </Group>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Card>

        {/* Progress reports */}
        <Card withBorder radius="md">
          <Stack gap="sm">
            <Text fw={600}>Progress reports</Text>

            {reports.length === 0 ? (
              <Text size="sm" c="dimmed">
                There are no progress reports for this student yet.
              </Text>
            ) : (
              <Stack gap="sm">
                {reports.map((r) => {
                  const dateLabel = r.report_date
                    ? new Date(r.report_date).toLocaleDateString()
                    : "No date";

                  const rangeLabel =
                    r.covers_start && r.covers_end
                      ? `${new Date(
                          r.covers_start
                        ).toLocaleDateString()} – ${new Date(
                          r.covers_end
                        ).toLocaleDateString()}`
                      : null;

                  const mainText =
                    r.grade_text ||
                    r.donor_comment ||
                    (r.info
                      ? r.info.length > 200
                        ? r.info.slice(0, 197) + "…"
                        : r.info
                      : null);

                  const hasPhotos = r.photos && r.photos.length > 0;
                  const previewPhotos = hasPhotos ? r.photos.slice(0, 3) : [];

                  return (
                    <Card key={r.id} withBorder radius="md" padding="sm">
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Text fw={600} size="sm">
                            Report {dateLabel}
                          </Text>
                          {typeof r.grade_numeric === "number" && (
                            <Badge size="xs" variant="light">
                              Grade {r.grade_numeric}
                            </Badge>
                          )}
                        </Group>

                        {rangeLabel && (
                          <Text size="xs" c="dimmed">
                            Covers: {rangeLabel}
                          </Text>
                        )}

                        {mainText && (
                          <Text size="sm" mt={4}>
                            {mainText}
                          </Text>
                        )}

                        {/* Photo previews */}
                        {hasPhotos && (
                          <Group gap="xs" mt="xs">
                            {previewPhotos.map((p) => (
                              <Image
                                key={p.path}
                                src={p.url}
                                alt={dateLabel}
                                w={96}
                                h={72}
                                radius="sm"
                                fit="cover"
                                style={{
                                  cursor: "pointer",
                                  border: "1px solid rgba(0,0,0,0.05)",
                                }}
                                onClick={() => setPreviewUrl(p.url)}
                              />
                            ))}
                            {r.photos.length > 3 && (
                              <Badge size="xs" variant="light">
                                +{r.photos.length - 3} more
                              </Badge>
                            )}
                          </Group>
                        )}

                        {/* Document list */}
                        {r.processedAttachments.filter((a) => !a.isImage)
                          .length > 0 && (
                          <Stack gap="xs" mt="xs">
                            {r.processedAttachments
                              .filter((a) => !a.isImage)
                              .map((att) => (
                                <Card
                                  key={att.path}
                                  withBorder
                                  padding="xs"
                                  radius="sm"
                                >
                                  <Group gap="sm">
                                    <IconFile size={20} color="gray" />
                                    <Text
                                      size="sm"
                                      style={{ flex: 1 }}
                                      truncate
                                    >
                                      {att.fileName}
                                    </Text>
                                    <Tooltip label="Download">
                                      <ActionIcon
                                        component="a"
                                        href={att.url}
                                        download={att.fileName}
                                        variant="light"
                                        color="blue"
                                        size="sm"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <IconDownload size={16} />
                                      </ActionIcon>
                                    </Tooltip>
                                  </Group>
                                </Card>
                              ))}
                          </Stack>
                        )}
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>
    </>
  );
};

export default DonorStudentDetailPage;
