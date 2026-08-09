// src/design-system/components/StatCard.tsx
import React from "react";
import { Card, Stack, Text } from "@mantine/core";
import { textRole } from "../typography";

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional supporting line under the value. */
  hint?: React.ReactNode;
  onClick?: () => void;
}

/**
 * Replaces the three separate StatCard / SummaryCard definitions that lived in
 * AdminDashboardPage, TeacherDashboardPage and DonorDashboardPage.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  onClick,
}) => (
  <Card
    onClick={onClick}
    style={onClick ? { cursor: "pointer" } : undefined}
  >
    <Stack gap={2}>
      <Text {...textRole("metricLabel")}>{label}</Text>
      <Text {...textRole("metricValue")}>{value}</Text>
      {hint && <Text {...textRole("caption")}>{hint}</Text>}
    </Stack>
  </Card>
);

export default StatCard;
