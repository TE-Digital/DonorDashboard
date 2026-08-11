import React from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Banknote,
  Bell,
  Bookmark,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  CircleHelp,
  CircleUser,
  ClipboardList,
  Contact,
  Download,
  Ellipsis,
  Filter,
  GraduationCap,
  HandCoins,
  House,
  Inbox,
  Info,
  ListFilter,
  Minus,
  Pencil,
  Plus,
  School,
  Search,
  Send,
  Settings,
  Settings2,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * The original design-system bundle rendered Lucide icons by kebab-case name off
 * a CDN global. Here the same names map to explicit `lucide-react` imports, so
 * the bundle only carries the icons the system actually uses.
 *
 * Add a name here before using it — an unknown name renders nothing.
 */
const REGISTRY: Record<string, LucideIcon> = {
  "arrow-down": ArrowDown,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  banknote: Banknote,
  bell: Bell,
  bookmark: Bookmark,
  "chart-no-axes-column": ChartNoAxesColumn,
  check: Check,
  "check-circle-2": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevrons-up-down": ChevronsUpDown,
  circle: Circle,
  "circle-alert": CircleAlert,
  "circle-help": CircleHelp,
  "circle-user": CircleUser,
  "clipboard-list": ClipboardList,
  contact: Contact,
  download: Download,
  ellipsis: Ellipsis,
  filter: Filter,
  "graduation-cap": GraduationCap,
  "hand-coins": HandCoins,
  house: House,
  inbox: Inbox,
  info: Info,
  "list-filter": ListFilter,
  minus: Minus,
  pencil: Pencil,
  plus: Plus,
  school: School,
  search: Search,
  send: Send,
  settings: Settings,
  "settings-2": Settings2,
  "trash-2": Trash2,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  "triangle-alert": TriangleAlert,
  upload: Upload,
  users: Users,
  wallet: Wallet,
  x: X,
};

export type IconName = keyof typeof REGISTRY | (string & {});

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 16,
  strokeWidth = 1.75,
  color = "currentColor",
  style,
}) => {
  const Glyph = REGISTRY[name];
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        color,
        flex: "0 0 auto",
        ...style,
      }}
    >
      {Glyph ? <Glyph size={size} strokeWidth={strokeWidth} /> : null}
    </span>
  );
};
