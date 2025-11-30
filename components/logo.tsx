// Logo component for InboxJanitor
// Supports both light and dark themes
"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
  size?: number;
  iconOnly?: boolean;
}

export function Logo({ className = "", size = 32, iconOnly = false }: LogoProps) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine current theme
  const currentTheme = mounted ? (theme === "system" ? systemTheme : theme) : "light";
  const isDark = currentTheme === "dark";

  if (iconOnly) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0"
        >
          {/* Inbox/Mailbox */}
          <rect
            x="6"
            y="10"
            width="18"
            height="14"
            rx="1.5"
            fill={isDark ? "white" : "currentColor"}
            opacity={isDark ? "0.2" : "0.15"}
          />
          <rect
            x="7"
            y="11"
            width="16"
            height="12"
            rx="1"
            fill="none"
            stroke={isDark ? "white" : "currentColor"}
            strokeWidth="2"
          />
          <rect
            x="9"
            y="14"
            width="12"
            height="2"
            rx="1"
            fill={isDark ? "white" : "currentColor"}
          />

          {/* Letters inside */}
          <rect
            x="8"
            y="17"
            width="6"
            height="4"
            rx="0.5"
            fill={isDark ? "white" : "currentColor"}
            opacity={isDark ? "0.6" : "0.5"}
          />
          <rect
            x="16"
            y="17"
            width="6"
            height="4"
            rx="0.5"
            fill={isDark ? "white" : "currentColor"}
            opacity={isDark ? "0.6" : "0.5"}
          />

          {/* Broom handle */}
          <line
            x1="24"
            y1="6"
            x2="24"
            y2="18"
            stroke={isDark ? "white" : "currentColor"}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="21"
            y1="8"
            x2="27"
            y2="8"
            stroke={isDark ? "white" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="20"
            y1="10"
            x2="28"
            y2="10"
            stroke={isDark ? "white" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="19"
            y1="12"
            x2="29"
            y2="12"
            stroke={isDark ? "white" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Sparkle */}
          <circle
            cx="26"
            cy="20"
            r="2"
            fill={isDark ? "white" : "currentColor"}
            opacity={isDark ? "1" : "0.9"}
          />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src="/logo.svg"
      alt="InboxJanitor"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

