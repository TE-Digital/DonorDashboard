// src/design-system/lumen/index.ts
//
// The Lumen design system, ported from the Claude Design project
// https://claude.ai/design/p/354c0197-0167-45a3-95d9-0eac77d9e4b4
//
// This is a self-contained layer that sits beside the existing Mantine-based
// presentation layer in ../. Import `./tokens.css` once (main.tsx does) and wrap
// any subtree in `className="lumen"` to adopt the system's base typography and
// canvas.
//
// Names overlap with the Mantine layer (EmptyState, PageHeader, StatusBadge-like
// Badge), so import from this path explicitly rather than re-exporting through
// ../index.ts.

export { Icon } from "./Icon";
export type { IconName, IconProps } from "./Icon";

export { Badge, Button, Card, Checkbox, Field, IconButton, Input, Radio, Select, Switch, Tag } from "./core";
export type {
  BadgeProps,
  BadgeTone,
  ButtonProps,
  ButtonVariant,
  CardProps,
  CheckboxProps,
  ControlSize,
  FieldProps,
  IconButtonProps,
  InputProps,
  RadioProps,
  SelectOption,
  SelectProps,
  SwitchProps,
  TagProps,
} from "./core";

export { ColumnFilter, DataTable, EmptyState, FilterBar, KpiCard, Pagination } from "./data";
export type {
  AppliedFilter,
  ColumnFilterProps,
  DataColumn,
  DataTableProps,
  EmptyStateProps,
  FilterBarProps,
  KpiAccent,
  KpiCardProps,
  PaginationProps,
  SortState,
} from "./data";

export { Banner, Dialog, Toast, Tooltip } from "./feedback";
export type { BannerProps, DialogProps, FeedbackTone, ToastProps, TooltipProps } from "./feedback";

export { AppShell, Checklist, PageHeader, TileCard } from "./layout";
export type {
  AppShellProps,
  ChecklistItem,
  ChecklistProps,
  PageHeaderProps,
  TileCardProps,
} from "./layout";

export { IconRail, SideNav, Tabs, TopBar } from "./navigation";
export type {
  IconRailProps,
  NavChild,
  NavModule,
  RailItem,
  SideNavProps,
  TabItem,
  TabsProps,
  TopBarProps,
} from "./navigation";
