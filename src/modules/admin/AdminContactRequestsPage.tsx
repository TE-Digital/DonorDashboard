// src/modules/admin/AdminContactRequestsPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Anchor, Badge, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { supabase } from "../../lib/supabaseClient";
import { asRows } from "../../lib/supabaseRelations";
import {
  LoadingState,
  PageHeader,
  StatusBadge,
  TableSection,
  type TableKpi,
} from "../../design-system";
import {
  Badge as LumenBadge,
  Button as LumenButton,
  type DataColumn,
} from "../../design-system/lumen";

type ContactRequestRow = {
  id: string;
  contact_type: string;
  name: string;
  email: string;
  message: string;
  source: string | null;
  created_at: string;
  handled: boolean;
  handled_at: string | null;
  grant_types?: {
    name: string | null;
  } | null;
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  donor_renewal: "Donor renewal",
  donor_new: "New donor lead",
  general: "General inquiry",
};

const getContactTypeLabel = (type: string) =>
  CONTACT_TYPE_LABELS[type] ?? type;

export const AdminContactRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<ContactRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string | null>("donor_renewal");
  const [statusFilter, setStatusFilter] = useState<string | null>("unhandled");
  const [search, setSearch] = useState("");

  const [openedMessageId, setOpenedMessageId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("contact_requests")
      .select(
        `
        id,
        contact_type,
        name,
        email,
        message,
        source,
        created_at,
        handled,
        handled_at,
        grant_types ( name )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading contact_requests", error);
      setError("Could not load contact requests.");
      setRequests([]);
      setLoading(false);
      return;
    }

    setRequests(asRows<ContactRequestRow>(data));
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();

    return requests.filter((r) => {
      if (typeFilter && typeFilter !== "all" && r.contact_type !== typeFilter) {
        return false;
      }

      if (statusFilter === "unhandled" && r.handled) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        r.name,
        r.email,
        r.message,
        r.source ?? "",
        r.grant_types?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [requests, typeFilter, statusFilter, search]);

  const openMessage = (id: string) => setOpenedMessageId(id);
  const closeMessage = () => setOpenedMessageId(null);

  const openedRequest = useMemo(
    () => filteredRequests.find((r) => r.id === openedMessageId) ?? null,
    [openedMessageId, filteredRequests]
  );

  // -------- toggle handled <-> unhandled --------
  const toggleHandled = async (id: string, nextHandled: boolean) => {
    setUpdating(true);
    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("contact_requests")
        .update({
          handled: nextHandled,
          handled_at: nextHandled ? nowIso : null,
        })
        .eq("id", id);

      if (error) {
        console.error("Error toggling handled status", error);
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                handled: nextHandled,
                handled_at: nextHandled ? nowIso : null,
              }
            : r
        )
      );
    } finally {
      setUpdating(false);
    }
  };

  const kpis: TableKpi[] = (() => {
    const open = requests.filter((r) => !r.handled).length;
    const renewals = requests.filter((r) => r.contact_type === "donor_renewal").length;
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = requests.filter((r) => new Date(r.created_at).getTime() >= week).length;
    return [
      { label: "Requests", value: requests.length, footnote: "received in total", accent: "blue" },
      {
        label: "Awaiting reply",
        value: open,
        footnote: open ? "need handling" : "inbox clear",
        accent: open ? "amber" : "teal",
      },
      { label: "Renewals", value: renewals, footnote: "donor renewals", accent: "teal" },
      { label: "This week", value: recent, footnote: "in the last 7 days", accent: "plum" },
    ];
  })();

  const columns: DataColumn<ContactRequestRow>[] = [
    {
      key: "created_at",
      label: "Created",
      width: 160,
      muted: true,
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "contact_type",
      label: "Type",
      width: 150,
      filterValue: (r) => getContactTypeLabel(r.contact_type),
      render: (r) => <LumenBadge tone="info">{getContactTypeLabel(r.contact_type)}</LumenBadge>,
    },
    { key: "name", label: "Name", width: 170 },
    {
      key: "email",
      label: "Email",
      width: 220,
      render: (r) => (
        <Anchor href={`mailto:${r.email}`} size="sm" onClick={(e) => e.stopPropagation()}>
          {r.email}
        </Anchor>
      ),
    },
    {
      key: "grant_type",
      label: "Grant type",
      width: 150,
      filterValue: (r) => r.grant_types?.name ?? "—",
      render: (r) => r.grant_types?.name ?? "–",
    },
    { key: "source", label: "Source", width: 130, muted: true, render: (r) => r.source || "–" },
    {
      key: "message",
      label: "Message",
      width: 260,
      sortable: false,
      filterable: false,
      render: (r) => (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            openMessage(r.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              openMessage(r.id);
            }
          }}
          style={{
            display: "inline-block",
            maxWidth: 240,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--text-link)",
            cursor: "pointer",
          }}
        >
          {r.message}
        </span>
      ),
    },
    {
      key: "handled",
      label: "Status",
      width: 170,
      filterValue: (r) => (r.handled ? "Handled" : "New"),
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <LumenButton
            size="sm"
            variant="secondary"
            disabled={updating}
            onClick={() => toggleHandled(r.id, !r.handled)}
          >
            {r.handled ? "Mark as unhandled" : "Mark as handled"}
          </LumenButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <Stack gap="md">
        <PageHeader
          title="Contact & renewal requests"
          subtitle="Overview of donor renewal requests and other contact leads submitted via the dashboards or future public forms."
        />

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}

        <TableSection
          kpis={kpis}
          columns={columns}
          rows={filteredRequests}
          searchKeys={["name", "email", "message", "source"]}
          controls={
            <>
              <Select
                size="sm"
                placeholder="All types"
                value={typeFilter}
                onChange={setTypeFilter}
                w={170}
                data={[
                  { value: "all", label: "All types" },
                  { value: "donor_renewal", label: "Donor renewal" },
                  { value: "donor_new", label: "New donor lead" },
                  { value: "general", label: "General inquiry" },
                ]}
              />
              <Select
                size="sm"
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                w={170}
                data={[
                  { value: "unhandled", label: "Unhandled only" },
                  { value: "all", label: "All requests" },
                ]}
              />
            </>
          }
          emptyTitle="No contact requests"
          emptyDescription="Requests submitted from the dashboards appear here."
          emptyIcon="inbox"
          actions={
            <LumenButton variant="secondary" icon="download" onClick={loadRequests}>
              Refresh
            </LumenButton>
          }
        />
      </Stack>

      {/* Modal with full message */}
      <Modal
        opened={!!openedRequest}
        onClose={closeMessage}
        title="Request details"
        size="lg"
        centered
      >
        {openedRequest && (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {new Date(openedRequest.created_at).toLocaleString()}
            </Text>

            <Group gap="xs">
              <Badge size="sm" variant="light">
                {getContactTypeLabel(openedRequest.contact_type)}
              </Badge>
              {openedRequest.grant_types?.name && (
                <Badge size="sm" variant="outline">
                  {openedRequest.grant_types.name}
                </Badge>
              )}
              <StatusBadge
                kind="contact"
                value={openedRequest.handled ? "handled" : "open"}
                label={openedRequest.handled ? "Handled" : "New"}
              />
            </Group>

            <Text fw={500}>
              {openedRequest.name}{" "}
              <Text span size="sm" c="dimmed">
                &lt;{openedRequest.email}&gt;
              </Text>
            </Text>

            {openedRequest.source && (
              <Text size="sm" c="dimmed">
                Source: {openedRequest.source}
              </Text>
            )}

            {openedRequest.handled_at && (
              <Text size="xs" c="dimmed">
                Handled at:{" "}
                {new Date(openedRequest.handled_at).toLocaleString()}
              </Text>
            )}

            <Text size="sm" mt="sm">
              {openedRequest.message}
            </Text>

            <Group justify="space-between" mt="md">
              <Anchor
                href={`mailto:${openedRequest.email}`}
                size="sm"
                target="_blank"
              >
                Reply via email
              </Anchor>

              <Group gap="xs">
                <LumenButton variant="secondary" onClick={closeMessage}>
                  Close
                </LumenButton>
                {/* Handling is the primary action in this dialog. */}
                <LumenButton
                  variant="primary"
                  disabled={updating}
                  onClick={() => toggleHandled(openedRequest.id, !openedRequest.handled)}
                >
                  {openedRequest.handled ? "Mark as unhandled" : "Mark as handled"}
                </LumenButton>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
};
