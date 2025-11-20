// src/modules/admin/AdminEditDonorPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type DonorContact = {
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  other_contact?: string | null;
  agent_id?: string | null;
};

type AgentOption = { value: string; label: string };

type AwardRow = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount_for_period: number | null;
  currency: string | null;
  status: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  student: {
    id: string;
    name: string | null;
    grade_level: string | null;
    school?: { name?: string | null } | null;
  } | null;
  grant_types: {
    name: string | null;
  } | null;
};

type SupportedStudent = {
  id: string;
  name: string;
  grade_level: string | null;
  school_name: string | null;
};

export const AdminEditDonorPage: React.FC = () => {
  const { donorId } = useParams<{ donorId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otherContact, setOtherContact] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);

  const [isDashboardEnabled, setIsDashboardEnabled] = useState<boolean>(true);
  const [wantsEmailUpdates, setWantsEmailUpdates] = useState<boolean>(true);
  const [wantsNewsletter, setWantsNewsletter] = useState<boolean>(false);
  const [preferredLanguage, setPreferredLanguage] =
    useState<string | null>("en");
  const [noteInternal, setNoteInternal] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!donorId) return;
      setLoading(true);
      setError(null);

      // agents
      const { data: agentRows, error: agentError } = await supabase
        .from("agents")
        .select("id, name")
        .order("name", { ascending: true });

      if (agentError) {
        console.error("Error loading agents", agentError);
      } else {
        setAgents(
          (agentRows ?? []).map((a: any) => ({
            value: a.id,
            label: a.name,
          }))
        );
      }

      // donor row
      const { data: donor, error: donorError } = await supabase
        .from("donors")
        .select(
          `
          id,
          name,
          contact,
          user_id,
          is_dashboard_enabled,
          wants_email_updates,
          wants_newsletter,
          preferred_language,
          note_internal,
          user_profile:profiles!donors_user_id_fkey (
            id,
            email,
            full_name
          )
        `
        )
        .eq("id", donorId)
        .maybeSingle();

      if (donorError || !donor) {
        console.error("Error loading donor", donorError);
        setError("Could not load donor.");
        setLoading(false);
        return;
      }

      setName(donor.name ?? "");

      const c = (donor.contact ?? {}) as DonorContact;
      setAddress(c.address ?? "");
      setEmail(c.email ?? "");
      setPhone(c.phone ?? "");
      setOtherContact(c.other_contact ?? "");
      setAgentId(c.agent_id ?? null);

      setIsDashboardEnabled(donor.is_dashboard_enabled ?? true);
      setWantsEmailUpdates(donor.wants_email_updates ?? true);
      setWantsNewsletter(donor.wants_newsletter ?? false);
      setPreferredLanguage(donor.preferred_language ?? "en");
      setNoteInternal(donor.note_internal ?? "");

      setUserId(donor.user_id ?? null);
      const userProfile = donor.user_profile;
      setUserEmail(userProfile?.email ?? null);

      // scholarship awards and supported students
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
          student:students (
            id,
            name,
            grade_level,
            school:schools ( name )
          ),
          grant_types ( name )
        `
        )
        .eq("donor_id", donorId)
        .order("period_start", { ascending: false });

      if (awardError) {
        console.error("Error loading scholarship awards for donor", awardError);
      } else {
        setAwards((awardRows ?? []) as AwardRow[]);
      }

      setLoading(false);
    };

    load();
  }, [donorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorId) return;

    setSaving(true);
    setError(null);

    try {
      const contact: DonorContact = {
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        other_contact: otherContact.trim() || null,
        agent_id: agentId || null,
      };

      const payload: any = {
        name: name.trim() || null,
        contact,
        is_dashboard_enabled: isDashboardEnabled,
        wants_email_updates: wantsEmailUpdates,
        wants_newsletter: wantsNewsletter,
        preferred_language: preferredLanguage,
        note_internal: noteInternal.trim() || null,
      };

      const { error: updateError } = await supabase
        .from("donors")
        .update(payload)
        .eq("id", donorId);

      if (updateError) {
        console.error("Error updating donor", updateError);
        setError(updateError.message);
        setSaving(false);
        return;
      }

      navigate("/admin/donors", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Unexpected error while updating donor.");
      setSaving(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!donorId) return;
    const targetEmail = (email || "").trim();

    if (!targetEmail) {
      setError("No email address stored for this donor.");
      return;
    }

    setInviteLoading(true);
    setError(null);

    try {
      const { error: fnError } = await supabase.functions.invoke(
        "invite-donor",
        {
          body: {
            donorId,
            email: targetEmail,
            preferredLanguage,
          },
        }
      );

      if (fnError) {
        console.error("invite-donor function error", fnError);
        setError(fnError.message ?? "Could not send invitation.");
        setInviteLoading(false);
        return;
      }

      // Re-fetch donor to update user_id / linked profile
      const { data: donor, error: donorError } = await supabase
        .from("donors")
        .select(
          `
          user_id,
          user_profile:profiles!donors_user_id_fkey (
            id,
            email,
            full_name
          )
        `
        )
        .eq("id", donorId)
        .maybeSingle();

      if (!donorError && donor) {
        setUserId(donor.user_id ?? null);
        setUserEmail(donor.user_profile?.email ?? null);
      }
    } catch (err: any) {
      console.error("Unexpected error sending invitation", err);
      setError(
        err.message ?? "Unexpected error while sending invitation email."
      );
    } finally {
      setInviteLoading(false);
    }
  };

  // ----- derived stats for awards / students -----
  const {
    totalAwards,
    totalAmount,
    currency,
    supportedStudents,
    lastDonationDate,
  } = useMemo(() => {
    const totalAwards = awards.length;

    let totalAmount = 0;
    let currency: string | null = null;
    let lastDonation: Date | null = null;

    awards.forEach((a) => {
      if (a.amount_for_period != null) {
        totalAmount += Number(a.amount_for_period);
        if (!currency) {
          currency = a.currency ?? "THB";
        }
      }

      const dateStr =
        a.payment_date || a.period_end || a.period_start || null;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!lastDonation || d > lastDonation) {
          lastDonation = d;
        }
      }
    });

    const studentMap = new Map<string, SupportedStudent>();
    awards.forEach((a) => {
      const s = a.student;
      if (!s) return;
      if (!studentMap.has(s.id)) {
        studentMap.set(s.id, {
          id: s.id,
          name: s.name ?? "(no name)",
          grade_level: s.grade_level,
          school_name: s.school?.name ?? null,
        });
      }
    });

    return {
      totalAwards,
      totalAmount,
      currency,
      supportedStudents: Array.from(studentMap.values()),
      lastDonationDate: lastDonation,
    };
  }, [awards]);

  if (loading) return <Loader />;

  const lastDonationLabel = lastDonationDate
    ? lastDonationDate.toLocaleDateString()
    : "—";

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Title order={3}>Edit donor</Title>
        <Button size="xs" variant="subtle" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Group>

      <Group align="flex-start" grow>
        {/* LEFT: donor details form */}
        <Card
          withBorder
          component="form"
          onSubmit={handleSubmit}
          style={{ flex: 1 }}
        >
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              All fields are optional. You can keep this donor partially or fully
              anonymous if needed.
            </Text>

            <TextInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />

            <Textarea
              label="Address"
              minRows={2}
              value={address}
              onChange={(e) => setAddress(e.currentTarget.value)}
            />

            <Group grow>
              <TextInput
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <TextInput
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
              />
            </Group>

            <TextInput
              label="Other contact (Line, WhatsApp, etc.)"
              value={otherContact}
              onChange={(e) => setOtherContact(e.currentTarget.value)}
            />

            <Select
              label="Agent"
              placeholder="No agent"
              data={agents}
              value={agentId}
              onChange={(value) => setAgentId(value)}
              clearable
            />

            <Text fw={600} mt="md">
              Dashboard & communication
            </Text>
            <Stack gap={4}>
              <Switch
                label="Dashboard access enabled"
                checked={isDashboardEnabled}
                onChange={(e) =>
                  setIsDashboardEnabled(e.currentTarget.checked)
                }
              />
              <Switch
                label="Wants email updates"
                checked={wantsEmailUpdates}
                onChange={(e) =>
                  setWantsEmailUpdates(e.currentTarget.checked)
                }
              />
              <Switch
                label="Wants newsletter"
                checked={wantsNewsletter}
                onChange={(e) =>
                  setWantsNewsletter(e.currentTarget.checked)
                }
              />
              <Select
                label="Preferred language"
                data={[
                  { value: "en", label: "English" },
                  { value: "th", label: "Thai" },
                ]}
                value={preferredLanguage}
                onChange={(v) => setPreferredLanguage(v || "en")}
              />
            </Stack>

            <Text fw={600} mt="md">
              Internal notes
            </Text>
            <Textarea
              minRows={2}
              value={noteInternal}
              onChange={(e) => setNoteInternal(e.currentTarget.value)}
              placeholder="Visible only to admins (e.g., payment details, preferences)."
            />

            <Text fw={600} mt="md">
              Linked account & invitations
            </Text>
            <Stack gap={4}>
              {userEmail ? (
                <>
                  <Text size="sm">
                    Linked user: <strong>{userEmail}</strong>
                  </Text>
                  <Text size="xs" c="dimmed">
                    This donor already has a user account. Ask them to log in
                    with this email and, if needed, use the{" "}
                    <strong>"Forgot password"</strong> option on the login page.
                    No additional invitation email is required.
                  </Text>
                </>
              ) : (
                <>
                  {!email && (
                    <Text size="xs" c="red">
                      Add an email address before sending an invitation.
                    </Text>
                  )}

                  <Button
                    size="xs"
                    variant="light"
                    onClick={handleSendInvitation}
                    disabled={!email || inviteLoading}
                    loading={inviteLoading}
                  >
                    Send login invitation email
                  </Button>

                  <Text size="xs" c="dimmed">
                    This will create an account for the donor (if none exists)
                    and send them a login link. Use only when they agreed to use
                    the online dashboard.
                  </Text>
                </>
              )}

              {error && (
                <Text size="sm" c="red">
                  {error}
                </Text>
              )}
            </Stack>

            <Group justify="flex-end" mt="sm">
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* RIGHT: scholarships & students overview */}
        <RightSideAwardsAndStudents
          donorId={donorId}
          awards={awards}
          totalAwards={totalAwards}
          totalAmount={totalAmount}
          currency={currency}
          lastDonationLabel={lastDonationLabel}
          supportedStudents={supportedStudents}
        />
      </Group>
    </Stack>
  );
};

// Split right column into a small helper component for readability
const RightSideAwardsAndStudents: React.FC<{
  donorId: string | undefined;
  awards: AwardRow[];
  totalAwards: number;
  totalAmount: number;
  currency: string | null;
  lastDonationLabel: string;
  supportedStudents: SupportedStudent[];
}> = ({
  donorId,
  awards,
  totalAwards,
  totalAmount,
  currency,
  lastDonationLabel,
  supportedStudents,
}) => {
  return (
    <Stack style={{ flex: 1 }} gap="sm">
      {/* SUMMARY CARD */}
      <Card withBorder>
        <Stack gap="xs">
          <Text fw={600}>Donor overview</Text>
          {awards.length === 0 ? (
            <Text size="sm" c="dimmed">
              No scholarship awards recorded for this donor yet.
            </Text>
          ) : (
            <Group gap="lg" wrap="wrap">
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  Total awards
                </Text>
                <Text fw={600}>{totalAwards}</Text>
              </Stack>

              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  Students supported
                </Text>
                <Text fw={600}>{supportedStudents.length}</Text>
              </Stack>

              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  Total amount
                </Text>
                <Text fw={600}>
                  {totalAmount.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  {currency || "THB"}
                </Text>
              </Stack>

              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  Last donation
                </Text>
                <Text fw={600}>{lastDonationLabel}</Text>
              </Stack>
            </Group>
          )}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={600}>Scholarships awarded</Text>
            {donorId && (
              <Button
                size="xs"
                variant="light"
                component={Link}
                to={`/admin/scholarships/new?donorId=${donorId}`}
              >
                Award scholarship
              </Button>
            )}
          </Group>

          {awards.length === 0 ? (
            <Text size="sm" c="dimmed">
              No scholarship awards recorded for this donor yet.
            </Text>
          ) : (
            <Table
              striped
              highlightOnHover
              horizontalSpacing="md"
              verticalSpacing="xs"
              mt="xs"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Student</Table.Th>
                  <Table.Th>Grant type</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
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

                  const status = (a.status || "").toLowerCase();
                  let statusColor: string = "gray";
                  if (status === "active") statusColor = "green";
                  else if (status === "planned") statusColor = "yellow";
                  else if (status === "completed") statusColor = "blue";
                  else if (status === "cancelled") statusColor = "red";

                  return (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        {a.student ? (
                          <Anchor
                            component={Link}
                            to={`/admin/students/${a.student.id}`}
                            size="sm"
                          >
                            {a.student.name ?? "(no name)"}{" "}
                            {a.student.grade_level
                              ? `– Grade ${a.student.grade_level}`
                              : ""}
                          </Anchor>
                        ) : (
                          <Text size="sm">—</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {a.grant_types?.name ?? "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{periodLabel}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{amountLabel}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Badge
                            size="xs"
                            variant="light"
                            color={statusColor}
                          >
                            {a.status || "—"}
                          </Badge>
                          {a.is_paid != null && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={a.is_paid ? "green" : "red"}
                            >
                              {a.is_paid ? "Paid" : "Not paid"}
                            </Badge>
                          )}
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="xs">
          <Text fw={600}>Students supported</Text>
          {supportedStudents.length === 0 ? (
            <Text size="sm" c="dimmed">
              No students linked via scholarship awards yet.
            </Text>
          ) : (
            <Table
              striped
              highlightOnHover
              horizontalSpacing="md"
              verticalSpacing="xs"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Student</Table.Th>
                  <Table.Th>School</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {supportedStudents.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      <Text size="sm">
                        {s.name}{" "}
                        {s.grade_level ? `– Grade ${s.grade_level}` : ""}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{s.school_name || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="subtle"
                        component={Link}
                        to={`/admin/students/${s.id}`}
                      >
                        Open
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

export default AdminEditDonorPage;

