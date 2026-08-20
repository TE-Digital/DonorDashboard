import type React from "react";

const avatarTones: React.CSSProperties[] = [
  { backgroundColor: "var(--blue-100)", color: "var(--blue-700)" },
  { backgroundColor: "var(--teal-100)", color: "var(--teal-700)" },
  { backgroundColor: "var(--plum-50)", color: "var(--plum-700)" },
  { backgroundColor: "var(--amber-100)", color: "var(--amber-700)" },
  { backgroundColor: "var(--green-100)", color: "var(--green-700)" },
  { backgroundColor: "var(--pink-100)", color: "var(--pink-700)" },
  { backgroundColor: "var(--orange-100)", color: "var(--orange-700)" },
];

/** Two meaningful initials, e.g. "Araya Sukjai" becomes "AS". */
export const profileInitials = (name?: string | null) => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.length ? parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() : "?";
};

/** A stable design-system colour for an avatar with no supplied image. */
export const profileAvatarStyle = (seed?: string | null): React.CSSProperties => {
  const value = Array.from(seed ?? "?").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatarTones[value % avatarTones.length];
};
