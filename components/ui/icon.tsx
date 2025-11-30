"use client";

import { Lineicons } from "@lineiconshq/react-lineicons";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Edit,
  Palette,
  AlertTriangle as LucideAlertTriangle,
  Download,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
} from "lucide-react";
import {
  Envelope1Outlined,
  Comment1Outlined,
  ExitOutlined,
  Sun1Outlined,
  CalendarDaysOutlined,
  User4Outlined,
  Trash3Outlined,
  Shield2Outlined,
  Database2Outlined,
  Locked1Outlined,
  CheckCircle1Outlined,
  ChevronDownOutlined,
  ChevronUpOutlined,
  Code1Outlined, // For Bot/Robot
  Layout9Outlined, // For Dashboard
  RefreshUser1Outlined, // For Refresh/Reload
  // Using correct icon names that exist
  Gear1Outlined, // For Settings
  MoonHalfRight5Outlined, // For Moon
  ArrowLeftOutlined, // For Reply (using arrow left as reply alternative)
  XOutlined, // For Close/X
  StarFatOutlined, // For Sparkles
  CheckSquare2Outlined, // For checked checkbox/select all
  Bootstrap5SquareOutlined, // For unchecked checkbox/square
} from "@lineiconshq/free-icons";

// Icon mapping
const iconMap = {
  Mail: Envelope1Outlined,
  Dashboard: Layout9Outlined,
  Message: Comment1Outlined,
  Bot: Code1Outlined,
  Settings: Gear1Outlined,
  LogOut: ExitOutlined,
  Sun: Sun1Outlined,
  Moon: MoonHalfRight5Outlined,
  Refresh: RefreshUser1Outlined,
  Sparkles: StarFatOutlined,
  Loader: RefreshUser1Outlined,
  Calendar: CalendarDaysOutlined,
  Users: User4Outlined,
  Reply: ArrowLeftOutlined,
  Trash: Trash3Outlined,
  Shield: Shield2Outlined,
  Database: Database2Outlined,
  Lock: Locked1Outlined,
  Check: CheckCircle1Outlined,
  X: XOutlined,
  ChevronDown: ChevronDownOutlined,
  ChevronUp: ChevronUpOutlined,
  CheckSquare: CheckSquare2Outlined, // For select all (checked state)
  Square: Bootstrap5SquareOutlined, // For deselect all (unchecked state)
  Eye: "lucide-eye", // Show password - using Lucide
  EyeOff: "lucide-eyeoff", // Hide password - using Lucide
  Edit: "lucide-edit", // Edit icon - using Lucide
  Palette: "lucide-palette", // Color palette - using Lucide
  AlertTriangle: "lucide-alert", // Warning/Alert - using Lucide
  Download: "lucide-download", // Download icon - using Lucide
  Plus: "lucide-plus", // Plus icon - using Lucide
  RefreshCw: "lucide-refreshcw", // Refresh circular icon - using Lucide
  AlertCircle: "lucide-alertcircle", // Alert circle icon - using Lucide
  CheckCircle: "lucide-checkcircle", // Check circle icon - using Lucide
  Info: "lucide-info", // Info icon - using Lucide
  Clock: "lucide-clock", // Clock icon - using Lucide
} as const;

export type IconName = keyof typeof iconMap;

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
  color?: string;
}

export function Icon({
  name,
  className,
  size = 20,
  color = "currentColor",
}: IconProps) {
  const IconComponent = iconMap[name];
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  // Handle Lucide icons
  if (
    typeof IconComponent === "string" &&
    IconComponent.startsWith("lucide-")
  ) {
    const lucideIcons: Record<string, any> = {
      "lucide-eye": Eye,
      "lucide-eyeoff": EyeOff,
      "lucide-edit": Edit,
      "lucide-palette": Palette,
      "lucide-alert": LucideAlertTriangle,
      "lucide-download": Download,
      "lucide-plus": Plus,
      "lucide-refreshcw": RefreshCw,
      "lucide-alertcircle": AlertCircle,
      "lucide-checkcircle": CheckCircle,
      "lucide-info": Info,
      "lucide-clock": Clock,
    };
    const LucideIcon = lucideIcons[IconComponent];
    if (LucideIcon) {
      return (
        <LucideIcon
          size={size}
          color={color}
          className={cn("inline-block", className)}
        />
      );
    }
  }

  return (
    <Lineicons
      icon={IconComponent}
      size={size}
      color={color}
      className={cn("inline-block", className)}
    />
  );
}

// Export icon names for easy access
export const Icons = iconMap;
