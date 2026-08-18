import React, { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { IconDotsVertical, IconPencil, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { LoadingState, PageHeader, TableSection, type TableKpi } from "../../design-system";
import { Button, type DataColumn } from "../../design-system/lumen";
import { supabase } from "../../lib/supabaseClient";
import {
  SCHOOL_STATUSES,
  SCHOOL_SYSTEMS,
  deriveSchoolProfile,
  type SchoolRecord,
} from "./schoolProfile";
import styles from "./AdminDirectory.module.scss";

type SchoolRow = {
  id: string;
  displayId: string;
  name: string;
  address: string | null;
  province: string;
  district: string;
  system: "Government" | "Border Police";
  studentCount: number;
  teacherCount: number;
  status: "Active" | "Pending" | "Inactive";
  reports: string;
  created_at: string | null;
};


export const AdminSchoolsPage: React.FC = () => {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: schoolData, error: schoolError }, { data: studentData, error: studentError }] =
      await Promise.all([
        supabase.from("schools").select("id, name, address, created_at").order("name"),
        supabase.from("students").select("id, school_id, responsible_teacher_id"),
      ]);

    if (schoolError) {
      console.error("Error loading schools", schoolError);
      setSchools([]);
      setLoading(false);
      return;
    }
    if (studentError) console.error("Error loading school student counts", studentError);

    const students = (studentData ?? []) as Array<{
      id: string;
      school_id: string | null;
      responsible_teacher_id: string | null;
    }>;
    const studentIds = students.map((student) => student.id);
    const reportStudents = new Set<string>();

    if (studentIds.length) {
      const { data: reports, error: reportsError } = await supabase
        .from("term_updates")
        .select("student_id")
        .in("student_id", studentIds);
      if (reportsError) console.error("Error loading school report counts", reportsError);
      (reports ?? []).forEach((report: any) => reportStudents.add(report.student_id));
    }

    const rows = ((schoolData ?? []) as SchoolRecord[]).map((school) => {
      const linkedStudents = students.filter((student) => student.school_id === school.id);
      const teacherIds = new Set(linkedStudents.map((student) => student.responsible_teacher_id).filter(Boolean));
      const submitted = linkedStudents.filter((student) => reportStudents.has(student.id)).length;

      // Identifier, location, system and status are derived — see schoolProfile.ts.
      // The record screen derives them the same way, so the two never disagree.
      const profile = deriveSchoolProfile(school);

      return {
        ...school,
        displayId: profile.displayId,
        province: profile.province,
        district: profile.district,
        system: profile.system,
        studentCount: linkedStudents.length,
        teacherCount: teacherIds.size,
        status: profile.status,
        reports: linkedStudents.length
          ? `${submitted}/${linkedStudents.length} reporting`
          : "No students",
      };
    });

    setSchools(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredSchools = useMemo(
    () => schools.filter((school) =>
      (!statusFilter || school.status === statusFilter) &&
      (!systemFilter || school.system === systemFilter)),
    [schools, statusFilter, systemFilter],
  );

  const kpis: TableKpi[] = useMemo(() => {
    const provinces = new Set(schools.map((school) => school.province).filter((value) => value !== "—")).size;
    const active = schools.filter((school) => school.status === "Active").length;
    const students = schools.reduce((sum, school) => sum + school.studentCount, 0);
    const teachers = schools.reduce((sum, school) => sum + school.teacherCount, 0);
    return [
      { label: "Schools", value: schools.length, footnote: `${provinces} provinces`, accent: "blue" },
      { label: "Active", value: active, footnote: `of ${schools.length} records`, accent: "teal" },
      { label: "Students recorded", value: students.toLocaleString(), footnote: "across all schools", accent: "blue" },
      { label: "Teachers recorded", value: teachers, footnote: "across all schools", accent: "plum" },
    ];
  }, [schools]);

  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const removeSchool = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("schools").delete().eq("id", deleteTarget.id);

    if (error) {
      console.error("Error removing school", error);
      setDeleteError(
        deleteTarget.studentCount > 0
          ? "This school still has linked students. Reassign or remove those students before deleting the school."
          : error.message,
      );
      setDeleting(false);
      return;
    }

    setSchools((current) => current.filter((school) => school.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  };

  const exportCsv = () => {
    const headers = ["School ID", "School", "Province", "District", "System", "Students", "Teachers", "Status", "Reports", "Updated"];
    const values = filteredSchools.map((school) => [
      school.displayId, school.name, school.province, school.district, school.system,
      school.studentCount, school.teacherCount, school.status, school.reports,
      school.created_at ? new Date(school.created_at).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...values].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "schools.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: DataColumn<SchoolRow>[] = [
    { key: "displayId", label: "School ID", width: 120, render: (school) => <span className={styles.recordLink}>{school.displayId}</span> },
    { key: "name", label: "School", width: 250 },
    { key: "province", label: "Province", width: 140 },
    { key: "district", label: "District", width: 150 },
    { key: "system", label: "System", width: 140 },
    { key: "studentCount", label: "Students", width: 100, numeric: true, align: "right" },
    { key: "teacherCount", label: "Teachers", width: 100, numeric: true, align: "right" },
    {
      key: "status",
      label: "Status",
      width: 110,
      render: (school) => (
        <Badge className={styles[`status${school.status}`]} variant="light">{school.status}</Badge>
      ),
    },
    { key: "reports", label: "Reports", width: 140 },
    {
      key: "created_at",
      label: "Updated",
      width: 120,
      muted: true,
      render: (school) => school.created_at ? new Date(school.created_at).toLocaleDateString() : "—",
    },
    {
      key: "actions",
      label: "",
      width: 64,
      sortable: false,
      filterable: false,
      render: (school) => (
        <div className={styles.rowActions} onClick={(event) => event.stopPropagation()}>
          <Menu position="bottom-end" withinPortal shadow="md" width={190}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${school.name}`}>
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => navigate(`/admin/schools/${school.id}/edit`)}>
                Edit school details
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleteTarget(school)}>
                Remove school
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <Stack className={`${styles.page} ${styles.schoolListPage}`}>
      <Modal opened={Boolean(deleteTarget)} onClose={closeDelete} title="Remove school?" centered>
        <Stack>
          <Text size="sm">
            {deleteTarget ? `Remove ${deleteTarget.name} from the programme? This action cannot be undone.` : ""}
          </Text>
          {deleteError && <Text size="sm" c="red">{deleteError}</Text>}
          <Group justify="flex-end">
            <Button variant="ghost" onClick={closeDelete} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={removeSchool} disabled={deleting}>
              {deleting ? "Removing…" : "Remove school"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <PageHeader title="Schools" subtitle="School records, locations, programme coverage, and reporting progress." />
      <TableSection
        kpis={kpis}
        columns={columns}
        rows={filteredSchools}
        selectable
        density="compact"
        pageSize={14}
        searchPlaceholder="Search schools, provinces or codes"
        searchKeys={["displayId", "name", "province", "district", "system", "status"]}
        controls={
          <>
            <Select clearable placeholder="All statuses" value={statusFilter} onChange={setStatusFilter} data={[...SCHOOL_STATUSES]} w={160} />
            <Select clearable placeholder="All systems" value={systemFilter} onChange={setSystemFilter} data={[...SCHOOL_SYSTEMS]} w={170} />
          </>
        }
        onRowClick={(school) => navigate(`/admin/schools/${school.id}`)}
        emptyTitle="No schools found"
        emptyDescription="Add a school to link students and teachers to it."
        emptyIcon="house"
        emptyAction={<Button variant="secondary" icon="plus" onClick={() => navigate("/admin/schools/new")}>Add school</Button>}
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={exportCsv}>Export</Button>
            <Button variant="primary" icon="plus" onClick={() => navigate("/admin/schools/new")}>Add school</Button>
          </>
        }
      />
    </Stack>
  );
};

export default AdminSchoolsPage;
