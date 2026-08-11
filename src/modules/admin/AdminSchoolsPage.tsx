import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Stack } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import {
  LoadingState,
  PageHeader,
  TableSection,
  type TableKpi,
} from "../../design-system";
import { Button, type DataColumn } from "../../design-system/lumen";

type School = {
  id: string;
  name: string;
  address: string | null;
  created_at: string | null;
};

export const AdminSchoolsPage: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("schools")
      .select("id, name, address, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading schools", error);
      setSchools([]);
      setLoading(false);
      return;
    }

    setSchools((data ?? []) as School[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Derived from the rows already on the page — none of this is stored.
  const kpis: TableKpi[] = React.useMemo(() => {
    const withAddress = schools.filter((s) => s.address && s.address.trim()).length;
    const thisYear = schools.filter(
      (s) => s.created_at && new Date(s.created_at).getFullYear() === new Date().getFullYear(),
    ).length;
    const newest = schools
      .map((s) => s.created_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];

    return [
      { label: "Schools", value: schools.length, footnote: "on the register", accent: "blue" },
      {
        label: "With an address",
        value: withAddress,
        footnote: `${schools.length - withAddress} missing`,
        accent: withAddress === schools.length ? "teal" : "amber",
      },
      { label: "Added this year", value: thisYear, footnote: "new partners", accent: "teal" },
      {
        label: "Most recent",
        value: newest ? new Date(newest).toLocaleDateString() : "—",
        footnote: "last school added",
        accent: "plum",
      },
    ];
  }, [schools]);

  const columns: DataColumn<School>[] = [
    { key: "name", label: "Name", width: 260 },
    {
      key: "address",
      label: "Address",
      width: 320,
      muted: true,
      render: (s) => s.address || "—",
    },
    {
      key: "created_at",
      label: "Created",
      width: 140,
      muted: true,
      render: (s) => (s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <Stack>
      <PageHeader title="Schools" subtitle="Manage schools that students can be linked to." />

      <TableSection
        kpis={kpis}
        columns={columns}
        rows={schools}
        searchKeys={["name", "address"]}
        onRowClick={(s) => navigate(`/admin/schools/${s.id}`)}
        emptyTitle="No schools found"
        emptyDescription="Add a school to link students to it."
        emptyIcon="house"
        emptyAction={
          <Button variant="secondary" icon="plus" onClick={() => navigate("/admin/schools/new")}>
            Add school
          </Button>
        }
        actions={
          <Button variant="primary" icon="plus" onClick={() => navigate("/admin/schools/new")}>
            Add school
          </Button>
        }
      />
    </Stack>
  );
};

export default AdminSchoolsPage;
