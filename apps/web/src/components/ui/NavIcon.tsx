"use client";

import type { JSX } from "react";

type NavIconProps = {
  name: string;
  size?: number;
  className?: string;
};

const ICONS: Record<string, string> = {
  // Core
  dashboard:
    "M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z",
  command:
    "M4 17l6-6-6-6m8 14h8",
  analytics:
    "M18 20V10M12 20V4M6 20v-6",
  // Track
  habits:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z",
  journal:
    "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V5a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 19.5z",
  goals:
    "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-4a6 6 0 100-12 6 6 0 000 12zm0-4a2 2 0 100-4 2 2 0 000 4z",
  // Engines
  body: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z",
  mind: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  money:
    "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  general:
    "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  // Tools
  focus:
    "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-14v4l3 3",
  settings:
    "M12 15a3 3 0 100-6 3 3 0 000 6zm7.94-2.06a1 1 0 00.73 1.13l.28.07a2 2 0 011.02 3.22l-.16.23a1 1 0 00.06 1.35l.2.2a2 2 0 01-.64 3.26l-.26.11a1 1 0 00-.66 1.2l.06.28a2 2 0 01-2.34 2.34l-.28-.06a1 1 0 00-1.2.66l-.11.26a2 2 0 01-3.26.64l-.2-.2a1 1 0 00-1.35-.06l-.23.16a2 2 0 01-3.22-1.02l-.07-.28a1 1 0 00-1.13-.73l-.28.04a2 2 0 01-2.26-2.26l.04-.28a1 1 0 00-.73-1.13l-.28-.07a2 2 0 01-1.02-3.22l.16-.23a1 1 0 00-.06-1.35l-.2-.2a2 2 0 01.64-3.26l.26-.11a1 1 0 00.66-1.2l-.06-.28A2 2 0 014.4 3.56l.28.06a1 1 0 001.2-.66l.11-.26a2 2 0 013.26-.64l.2.2a1 1 0 001.35.06l.23-.16a2 2 0 013.22 1.02l.07.28a1 1 0 001.13.73l.28-.04a2 2 0 012.26 2.26l-.04.28z",
};

// Simpler, cleaner SVG paths using stroke-based rendering
const STROKE_ICONS: Record<string, JSX.Element> = {
  dashboard: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </g>
  ),
  command: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,17 10,11 4,5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </g>
  ),
  analytics: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </g>
  ),
  habits: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 2.5L12 8 9 5" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </g>
  ),
  journal: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </g>
  ),
  goals: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </g>
  ),
  body: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </g>
  ),
  mind: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </g>
  ),
  money: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </g>
  ),
  general: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 2,7 12,12 22,7" />
      <polyline points="2,17 12,22 22,17" />
      <polyline points="2,12 12,17 22,12" />
    </g>
  ),
  focus: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 15,15" />
    </g>
  ),
  workout: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="12" x2="16" y2="12" />
      <path d="M5 9v6M19 9v6" />
      <path d="M3 10v4M21 10v4" />
    </g>
  ),
  sleep: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </g>
  ),
  weight: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="11" rx="2" />
      <path d="M8 10a4 4 0 018 0" />
      <line x1="12" y1="15" x2="12" y2="17" />
    </g>
  ),
  nutrition: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v6c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </g>
  ),
  settings: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </g>
  ),
};

export function NavIcon({ name, size = 16, className }: NavIconProps) {
  const icon = STROKE_ICONS[name];

  if (!icon) {
    return <span className={className} style={{ width: size, height: size }} />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}
