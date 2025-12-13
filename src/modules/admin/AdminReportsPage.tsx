// src/modules/admin/AdminReportsPage.tsx
import React, { useEffect, useState } from "react";
import {
  Anchor,
  Badge,
  Card,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  IconFile,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypeXls,
  IconFileTypePpt,
} from "@tabler/icons-react";

// --- Types -------------------------------------------------------------------

type ColumnDef = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "bool" | "json";
};

type TableDef = {
  value: string;
  label: string;
  columns: ColumnDef[];
};

type RelationConfig = {
  [columnName: string]: {
    linkBase?: string;
  };
};

// --- Table definitions --------------------------------------------------------

// You can extend this with more tables if you like.
// For now we focus on term_updates because of the attachments.
const TABLE_DEFS: TableDef[] = [
  {
    value: "term_updates",
    label: "Term updates / reports",
    columns: [
      { name: "id", label: "ID", type: "text" },
      { name: "student_id", label: "Student ID", type: "text" },
      { name: "report_date", label: "Report date", type: "date" },
      { name: "covers_start", label: "Covers from", type: "date" },
      { name: "covers_end", label: "Covers to", type: "date" },
      { name: "grade", label: "Grade label", type: "text" },
      { name: "grade_numeric", label: "Grade numeric", type: "number" },
      { name: "grade_text", label: "Grade text", type: "text" },
      { name: "donor_comment", label: "Donor comment", type: "text" },
      { name: "info", label: "Additional info", type: "text" },
      { name: "attachments", label: "Attachments", type: "json" }, // special
      { name: "created_at", label: "Created at", type: "date" },
    ],
  },
];

// Optional: you can add more relation targets here if you have those routes.
const RELATIONS: Record<string, RelationConfig> = {
  term_updates: {
    student_id: {
      linkBase: "/admin/students/", // /admin/students/<student_id>
    },
  },
};

// --- Component ----------------------------------------------------------------

const AdminReportsPage: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<string>("term_updates");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTableDef = TABLE_DEFS.find((t) => t.value === selectedTable);
  const currentColumns = currentTableDef?.columns ?? [];

  useEffect(() => {
    const load = async () => {
      if (!selectedTable) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from(selectedTable)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (queryError) {
          console.error("Error loading table", selectedTable, queryError);
          setError(queryError.message);
        } else {
          setRows(data ?? []);
        }
      } catch (e: any) {
        console.error("Unexpected error loading table", selectedTable, e);
        setError(e.message ?? "Unexpected error loading table.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedTable]);

  // --- Helpers for attachments ------------------------------------------------

  const isImagePath = (path: string) =>
    /\.(jpe?g|png|webp|gif)$/i.test(path || "");

  const pickFileIcon = (extLower: string | null | undefined) => {
    switch (extLower) {
      case "pdf":
        return IconFileTypePdf;
      case "doc":
      case "docx":
        return IconFileTypeDocx;
      case "xls":
      case "xlsx":
        return IconFileTypeXls;
      case "ppt":
      case "pptx":
        return IconFileTypePpt;
      default:
        return IconFile;
    }
  };

  // --- Cell rendering --------------------------------------------------------

  const renderCell = (row: any, columnName: string) => {
    const value = row[columnName];
    const relCfg = selectedTable && RELATIONS[selectedTable]?.[columnName];

    // 1) Special rendering for attachments column
    if (columnName === "attachments") {
      if (!value) {
        return (
          <Table.Td key={columnName}>
            <Text size="sm" c="dimmed">
              –
            </Text>
          </Table.Td>
        );
      }

      let items: { path: string; is_public?: boolean }[] = [];

      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          // invalid JSON → treat as no attachments
        }
      } else if (Array.isArray(value)) {
        items = value;
      }

      if (!items.length) {
        return (
          <Table.Td key={columnName}>
            <Text size="sm" c="dimmed">
              –
            </Text>
          </Table.Td>
        );
      }

      return (
        <Table.Td key={columnName}>
          <Stack gap={6}>
            {items.map((att, i) => {
              const path = att.path ?? "";
              if (!path) return null;

              const filename = path.split("/").pop() ?? path;
              const extRaw = filename.split(".").pop() ?? "";
              const extUpper = extRaw.toUpperCase();
              const extLower = extRaw.toLowerCase();

              const { data } = supabase.storage
                .from("progress-photos")
                .getPublicUrl(path);
              const publicUrl = data.publicUrl;

              const IconComp = pickFileIcon(extLower);
              const image = isImagePath(path);

              return (
                <Group key={`${path}-${i}`} align="flex-start" gap="xs">
                  {image ? (
                    <Anchor
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-block" }}
                    >
                      <img
                        src={publicUrl}
                        alt={filename}
                        style={{
                          width: 40,
                          height: 40,
                          objectFit: "cover",
                          borderRadius: 4,
                          border: "1px solid #ddd",
                        }}
                      />
                    </Anchor>
                  ) : (
                    <IconComp size={20} />
                  )}

                  <Stack gap={2}>
                    <Group gap={6}>
                      <Badge size="xs" variant="light">
                        {extUpper || "FILE"}
                      </Badge>
                      <Text size="xs" lineClamp={1}>
                        {filename}
                      </Text>
                    </Group>

                    <Group gap={8}>
                      <Anchor
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        size="xs"
                      >
                        Open
                      </Anchor>
                      {/* explicit download link */}
                      <Anchor
                        component="a"
                        href={publicUrl}
                        download={filename}
                        size="xs"
                      >
                        Download
                      </Anchor>
                      {!att.is_public && (
                        <Text size="xs" c="dimmed">
                          (internal)
                        </Text>
                      )}
                    </Group>
                  </Stack>
                </Group>
              );
            })}
          </Stack>
        </Table.Td>
      );
    }

    // 2) Relation-based clickable link (e.g. student_id → /admin/students/<id>)
    if (relCfg && value != null) {
      const linkBase = relCfg.linkBase;
      return (
        <Table.Td key={columnName}>
          {linkBase ? (
            <Anchor component={Link} to={`${linkBase}${value}`} size="sm">
              {String(value)}
            </Anchor>
          ) : (
            <Text size="sm">{String(value)}</Text>
          )}
        </Table.Td>
      );
    }

    // 3) Boolean as badges
    if (typeof value === "boolean") {
      return (
        <Table.Td key={columnName}>
          <Badge size="sm" color={value ? "green" : "gray"} variant="light">
            {value ? "Yes" : "No"}
          </Badge>
        </Table.Td>
      );
    }

    // 4) Generic fallback
    return (
      <Table.Td key={columnName}>
        <Text size="sm">{value == null ? "–" : String(value)}</Text>
      </Table.Td>
    );
  };

  // --- Render ----------------------------------------------------------------

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <div>
          <Title order={3}>Admin – Reports & term updates</Title>
          <Text size="sm" c="dimmed">
            Browse term update records and their attachments (photos, PDFs, and
            other documents).
          </Text>
        </div>

        <Select
          label="Table"
          placeholder="Select table"
          value={selectedTable}
          onChange={(val) => setSelectedTable(val || "term_updates")}
          data={TABLE_DEFS.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
          miw={260}
        />
      </Group>

      {loading ? (
        <Loader />
      ) : error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : !currentTableDef ? (
        <Text size="sm">No table selected.</Text>
      ) : (
        <Card withBorder padding="sm">
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  {currentColumns.map((col) => (
                    <Table.Th key={col.name}>{col.label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={currentColumns.length}>
                      <Text size="sm" c="dimmed">
                        No records found.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  rows.map((row, rowIdx) => (
                    <Table.Tr key={row.id ?? rowIdx}>
                      {currentColumns.map((col) =>
                        renderCell(row, col.name)
                      )}
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </Stack>
  );
};

export default AdminReportsPage;
