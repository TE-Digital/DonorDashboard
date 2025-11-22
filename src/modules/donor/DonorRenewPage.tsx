// src/modules/donor/DonorRenewPage.tsx
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  ActionIcon,
  ThemeIcon,
  Image,
} from "@mantine/core";
import {
  IconInfoCircle,
  IconHeartHandshake,
  IconCheck,
} from "@tabler/icons-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";

export const DonorRenewPage: React.FC = () => {
  const { profile } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [grantTypeId, setGrantTypeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [grantTypes, setGrantTypes] = useState<
    { value: string; label: string }[]
  >([]);
  const [loadingGrantTypes, setLoadingGrantTypes] = useState(false);

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ---------- Prefill from profile ----------
  useEffect(() => {
    if (profile) {
      if (!name) setName(profile.full_name ?? "");
      if (!email) setEmail(profile.email ?? "");
    }
  }, [profile, name, email]);

  // ---------- Load grant types ----------
  useEffect(() => {
    const loadGrantTypes = async () => {
      setLoadingGrantTypes(true);

      const { data, error } = await supabase
        .from("grant_types")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("DonorRenewPage: error loading grant_types", error);
      } else if (data) {
        setGrantTypes(
          data.map((g: any) => ({
            value: g.id as string,
            label: g.name as string,
          }))
        );
      }

      setLoadingGrantTypes(false);
    };

    loadGrantTypes();
  }, []);

  // ---------- Load gallery images from real reports ----------
  useEffect(() => {
    const loadImages = async () => {
      try {
        // 1) Logged-in auth user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // 2) Donor row for this user
        const { data: donorRow, error: donorError } = await supabase
          .from("donors")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (donorError) {
          console.error("Error loading donor for gallery", donorError);
          return;
        }
        if (!donorRow?.id) return;

        const donorId = donorRow.id as string;

        // 3) Students supported by this donor
        const { data: awards, error: awardsError } = await supabase
          .from("scholarship_awards")
          .select("student_id")
          .eq("donor_id", donorId);

        if (awardsError) {
          console.error("Error loading awards for gallery", awardsError);
          return;
        }
        if (!awards || awards.length === 0) return;

        const studentIds = Array.from(
          new Set(awards.map((a: any) => a.student_id as string))
        );
        if (studentIds.length === 0) return;

        // 4) Term updates for those students (no share_with_donor filter, since that column doesn't exist)
        const { data: reports, error: reportsError } = await supabase
          .from("term_updates")
          .select("attachments, report_date")
          .in("student_id", studentIds)
          .order("report_date", { ascending: false });

        if (reportsError) {
          console.error(
            "Error loading term_updates for gallery",
            reportsError
          );
          return;
        }
        if (!reports || reports.length === 0) return;

        // 5) Collect image attachment paths (only public images)
        const imagePaths: string[] = [];

        (reports ?? []).forEach((r: any) => {
          const attachments =
            (r.attachments ?? []) as {
              path: string;
              is_public?: boolean | null;
            }[];

          attachments
            .filter(
              (a) =>
                a?.path &&
                a.is_public === true &&
                /\.(jpe?g|png|webp|gif)$/i.test(
                  (a.path.split("?")[0] ?? "").toLowerCase()
                )
            )
            .forEach((a) => {
              imagePaths.push(a.path);
            });
        });

        if (imagePaths.length === 0) return;

        const uniquePaths = Array.from(new Set(imagePaths));

        // 6) Convert to signed URLs (progress-photos bucket)
        const urls: string[] = [];
        for (const p of uniquePaths.slice(0, 4)) {
          try {
            const { data, error } = await supabase.storage
              .from("progress-photos")
              .createSignedUrl(p, 60 * 60); // 1 hour

            if (!error && data?.signedUrl) {
              urls.push(data.signedUrl);
            }
          } catch (e) {
            console.error("Error creating signed URL for gallery photo", e);
          }
        }

        if (urls.length > 0) {
          setGalleryImages(urls);
        }
      } catch (err) {
        console.error("Error loading gallery images", err);
      }
    };

    loadImages();
  }, []);

  // ---------- Submit renew request ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and message.");
      setSubmitting(false);
      return;
    }

    const { error: fnError } = await supabase.functions.invoke(
      "donor-renew-request",
      {
        body: {
          name: name.trim(),
          email: email.trim(),
          grantTypeId,
          message: message.trim(),
        },
      }
    );

    if (fnError) {
      console.error("donor-renew-request error", fnError);
      setError(fnError.message ?? "Could not send your request.");
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setMessage("");
    setSubmitting(false);
  };

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      <Stack gap="md" align="center" mb="md">
        <ThemeIcon size={48} radius="xl" color="blue">
          <IconHeartHandshake size={28} />
        </ThemeIcon>

        <Text fw={800} size="32px" ta="center">
          Continue Your Impact
        </Text>

        <Text size="sm" c="dimmed" ta="center">
          iCare Thailand Foundation – Investing in tomorrow, empowering today
        </Text>

        <Text size="md" c="dimmed" ta="center" maw={520}>
          The impact of your kindness is invaluable. If you’d like to continue
          supporting a student—or adjust your scholarship—we’re here to help.
          Thank you for investing in their future.
        </Text>
      </Stack>

      {/* Dynamic gallery from real donor report photos */}
      {galleryImages.length > 0 && (
        <Group justify="center" mb="lg" gap="md">
          {galleryImages.map((url, idx) => (
            <Image
              key={idx}
              src={url}
              w={150}
              radius="md"
              alt="Impact photo"
              style={{ objectFit: "cover", maxHeight: 140 }}
            />
          ))}
        </Group>
      )}

      <Card
        withBorder
        shadow="sm"
        radius="md"
        p="lg"
        component="form"
        onSubmit={handleSubmit}
      >
        <Stack gap="md">
          <Text fw={700} size="lg">
            Renew your support
          </Text>

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              color="green"
              variant="light"
              icon={<IconCheck size={16} />}
            >
              Thank you! Your request was sent successfully. Our team will get
              back to you via email.
            </Alert>
          )}

          <TextInput
            label="Your name"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          <TextInput
            label="Your email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />

          <Group align="flex-end" gap="xs">
            <Select
              style={{ flex: 1 }}
              label={
                <Group gap={4}>
                  <Text size="sm">Preferred grant type (optional)</Text>
                  <Tooltip
                    label="If you'd like to continue with a specific grant type, select it here."
                    withArrow
                  >
                    <ActionIcon size="sm" variant="subtle">
                      <IconInfoCircle size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              }
              placeholder="No preference"
              data={grantTypes}
              value={grantTypeId}
              onChange={setGrantTypeId}
              clearable
              disabled={loadingGrantTypes}
            />
          </Group>

          <Textarea
            label="Your message"
            required
            minRows={4}
            autosize
            placeholder="Tell us how you'd like to continue, increase, adjust, or update your support."
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button type="submit" size="md" loading={submitting}>
              Send message
            </Button>
          </Group>
        </Stack>
      </Card>
    </div>
  );
};

export default DonorRenewPage;
