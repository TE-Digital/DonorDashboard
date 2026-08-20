// src/modules/viewAs/ViewAsSwitcher.tsx
//
// The control in the top bar that swaps between the admin console and the
// teacher product. For an admin it also chooses which teacher's roster the
// teacher product shows.
//
// Deliberately worded as "viewing" rather than "signed in as": nothing about
// the session changes, and the banner under the bar says so.

import React from "react";
import { Menu, ScrollArea } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { Button } from "../../design-system/lumen";
import { useViewAs, type ViewRole } from "./ViewAsContext";

const ROLE_LABEL: Record<ViewRole, string> = {
  admin: "Admin view",
  teacher: "Teacher view",
  donor: "Donor view",
};

const HOME: Record<ViewRole, string> = {
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  donor: "/donor/dashboard",
};

export const ViewAsSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { viewRole, availableRoles, setViewRole, teacherId, setTeacherId, teacherOptions, simulated } =
    useViewAs();

  // Nothing to switch between — a plain teacher or donor account.
  if (availableRoles.length < 2) return null;

  const teacherName = teacherOptions.find((option) => option.id === teacherId)?.name;
  const label =
    viewRole === "teacher" && teacherName ? `Teacher · ${teacherName}` : ROLE_LABEL[viewRole];

  const switchTo = (role: ViewRole) => {
    setViewRole(role);
    navigate(HOME[role]);
  };

  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={260}>
      <Menu.Target>
        <span>
          <Button variant={simulated ? "secondary" : "ghost"} icon="users" iconAfter="chevron-down">
            {label}
          </Button>
        </span>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Viewing as</Menu.Label>
        {availableRoles.map((role) => (
          <Menu.Item
            key={role}
            onClick={() => switchTo(role)}
            rightSection={role === viewRole ? "✓" : undefined}
          >
            {ROLE_LABEL[role]}
          </Menu.Item>
        ))}

        {viewRole === "teacher" && teacherOptions.length > 0 && (
          <>
            <Menu.Divider />
            <Menu.Label>Whose roster</Menu.Label>
            <ScrollArea.Autosize mah={240}>
              {teacherOptions.map((option) => (
                <Menu.Item
                  key={option.id}
                  onClick={() => {
                    setTeacherId(option.id);
                    navigate(HOME.teacher);
                  }}
                  rightSection={option.id === teacherId ? "✓" : undefined}
                >
                  {option.name}
                </Menu.Item>
              ))}
            </ScrollArea.Autosize>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};

export default ViewAsSwitcher;
