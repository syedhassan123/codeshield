import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Code2,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Trophy,
  UserRound,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export const NAV_ICONS = {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Users,
  Video,
  ShieldAlert,
  BarChart3,
  FileText,
  Settings,
  Code2,
  Trophy,
  Award,
  UserRound,
  ClipboardCheck,
} as const satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;

export type NavItemConfig = {
  href: string;
  label: string;
  icon: NavIconName;
};
