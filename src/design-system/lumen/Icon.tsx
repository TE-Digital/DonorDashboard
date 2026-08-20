import React from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Banknote,
  BedDouble,
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
  Clock,
  CircleHelp,
  CircleUser,
  ClipboardList,
  Contact,
  Copy,
  Download,
  Ellipsis,
  Filter,
  GraduationCap,
  HandCoins,
  Hourglass,
  House,
  Inbox,
  Info,
  KeyRound,
  Link2,
  ListFilter,
  Mail,
  MailCheck,
  MessageCircle,
  Minus,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  School,
  Search,
  Send,
  Settings,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  UserRoundCheck,
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
  "bed-double": BedDouble,
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
  clock: Clock,
  "circle-help": CircleHelp,
  "circle-user": CircleUser,
  "clipboard-list": ClipboardList,
  contact: Contact,
  copy: Copy,
  download: Download,
  ellipsis: Ellipsis,
  filter: Filter,
  "graduation-cap": GraduationCap,
  "hand-coins": HandCoins,
  house: House,
  hourglass: Hourglass,
  inbox: Inbox,
  info: Info,
  "key-round": KeyRound,
  link: Link2,
  "list-filter": ListFilter,
  mail: Mail,
  "mail-check": MailCheck,
  "message-circle": MessageCircle,
  minus: Minus,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  "refresh-cw": RefreshCw,
  school: School,
  search: Search,
  send: Send,
  settings: Settings,
  "settings-2": Settings2,
  "shield-check": ShieldCheck,
  "shield-off": ShieldOff,
  "trash-2": Trash2,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  "triangle-alert": TriangleAlert,
  upload: Upload,
  "user-round-check": UserRoundCheck,
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
