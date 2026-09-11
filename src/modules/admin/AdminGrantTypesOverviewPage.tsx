import React, { useEffect, useState } from "react";
import { Stack } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { toFriendlyError } from "../../i18n/errors";
import {
  InlineMessage,
  LoadingState,
  PageHeader,
  TableSection,
  type TableKpi,
} from "../../design-system";
import {
  Button as LumenButton,
  IconButton,
  type DataColumn,
} from "../../design-system/lumen";

type GrantType = {
  id: string;
  name: string;
  description: string | null;
  amount_per_period: number | null;
  currency: string;
  default_duration_months: number | null;
  created_at: string;
};

export const AdminGrantTypesOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [grantTypes, setGrantTypes] = useState<GrantType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGrantTypes = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("grant_types")
        .select("*")
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      setGrantTypes((data as GrantType[]) || []);
    } catch (err: any) {
      setError(toFriendlyError(err, "errors.load", "Error loading grant types"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrantTypes();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This can't be undone.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("grant_types")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // Optimistically update the list
      setGrantTypes((prev) => prev.filter((gt) => gt.id !== id));
    } catch (err: any) {
      console.error("Error deleting grant type", err);
      setError("This grant type couldn't be deleted because scholarships still use it.");
    }
  };

  const kpis: TableKpi[] = (() => {
    const priced = grantTypes.filter((g) => g.amount_per_period != null);
    const total = priced.reduce((sum, g) => sum + (g.amount_per_period ?? 0), 0);
    const avg = priced.length ? Math.round(total / priced.length) : null;
    const durations = grantTypes
      .map((g) => g.default_duration_months)
      .filter((d): d is number => d != null);
    const avgMonths = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    const currency = priced[0]?.currency ?? "THB";

    return [
      { label: "Grant types", value: grantTypes.length, footnote: "available", mark: "scholarships" },
      {
        label: "With an amount",
        value: priced.length,
        footnote: `${grantTypes.length - priced.length} unpriced`,
        mark: priced.length === grantTypes.length ? "ontrack" : "overdue",
      },
      {
        label: "Average award",
        value: avg != null ? new Intl.NumberFormat().format(avg) : "None set",
        footnote: avg != null ? currency : "no amounts yet",
        mark: "money",
      },
      {
        label: "Typical duration",
        value: avgMonths ?? "None set",
        footnote: avgMonths ? "months" : "no durations yet",
        mark: "time",
      },
    ];
  })();

  const columns: DataColumn<GrantType>[] = [
    { key: "name", label: "Name", width: 260 },
    {
      key: "amount_per_period",
      label: "Standard amount",
      align: "right",
      numeric: true,
      width: 170,
      render: (g) =>
        g.amount_per_period != null
          ? `${new Intl.NumberFormat().format(g.amount_per_period)} ${g.currency}`
          : "Amount not set",
    },
    {
      key: "default_duration_months",
      label: "Default duration",
      align: "right",
      numeric: true,
      width: 160,
      render: (g) => (g.default_duration_months ? `${g.default_duration_months} months` : "No default"),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      width: 130,
      sortable: false,
      filterable: false,
      render: (g) => (
        <div style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon="pencil"
            size="sm"
            label="Edit grant type"
            onClick={() => navigate(`/admin/grant-types/edit/${g.id}`)}
          />
          <IconButton
            icon="trash-2"
            size="sm"
            label="Delete grant type"
            onClick={() => handleDelete(g.id, g.name)}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Stack>
      <PageHeader
        title="Grant types"
        subtitle="The award templates a scholarship can be created from."
        actions={<LumenButton variant="primary" icon="plus" onClick={() => navigate("/admin/grant-types/new")}>Add grant type</LumenButton>}
      />

      <InlineMessage tone="error">{error}</InlineMessage>

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={grantTypes}
        emptyTitle="No grant types yet"
        emptyDescription="Add a grant type to create scholarships from it."
        emptyIcon="hand-coins"
        emptyAction={
          <LumenButton
            variant="secondary"
            icon="plus"
            onClick={() => navigate("/admin/grant-types/new")}
          >
            Add grant type
          </LumenButton>
        }
      />
    </Stack>
  );
};

export default AdminGrantTypesOverviewPage;
