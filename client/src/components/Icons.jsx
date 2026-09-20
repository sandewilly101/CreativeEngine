/**
 * Interface icons.
 *
 * Drawn as stroked SVG paths on a 24×24 grid with a consistent 1.7 weight and
 * rounded caps, so a row of them reads as one set. They replace the Unicode
 * geometric characters this admin started with — those rendered at whatever
 * size the font decided, varied between machines, and carried no meaning
 * (a "◫" tells you nothing about a dashboard).
 *
 * Every icon inherits `currentColor` and sizes from the `size` prop.
 */

const PATHS = {
  // --- overview
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  reports: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 15l3.5-4 3 2.5L20 7" /><circle cx="20" cy="7" r="1.4" fill="currentColor" stroke="none" /></>,

  // --- sales
  leads: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  clients: <><path d="M3 21V8l6-4 6 4v13" /><path d="M15 21V11l6 3v7" /><path d="M2 21h20" /><path d="M7 11h2M7 15h2M12 11h1M12 15h1" /></>,
  quotes: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></>,

  // --- delivery
  projects: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M8 13h8" /></>,
  events: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" /></>,
  print: <><path d="M6 9V4h12v5" /><path d="M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" /><rect x="7" y="15" width="10" height="6" rx="1" /></>,
  bookings: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /><path d="M8 14h3M8 17h6" /></>,
  equipment: <><rect x="2" y="5" width="20" height="12" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M7 10h2M11 10h2M15 10h2" /></>,
  suppliers: <><path d="M10 17h4M3 17h2a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H3" /><rect x="6" y="7" width="9" height="10" rx="1.5" /><path d="M15 11h3l3 3v3h-6z" /><circle cx="7.5" cy="19" r="1.8" /><circle cx="17" cy="19" r="1.8" /></>,

  // --- finance
  invoices: <><path d="M5 3h14a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 0 1 1-1z" /><path d="M9 8h6M9 12h6" /></>,
  subscriptions: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /><path d="M12 8v4l2.5 1.5" /></>,

  // --- content
  website: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 9h20" /><circle cx="5.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /><circle cx="8" cy="6.5" r=".8" fill="currentColor" stroke="none" /><path d="M6 13h5M6 16h8" /></>,
  media: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.8" /><path d="M21 15l-5-5L5 21" /></>,
  ai: <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 7V3.5M9 12h.01M15 12h.01M9.5 16h5M2 12h2M20 12h2" /></>,

  // --- system
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 11a3 3 0 1 0-1.6-5.5" /><path d="M17.5 20a5.5 5.5 0 0 0-1.6-3.9" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 14a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9.1a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03z" /></>,

  // --- misc used around the admin
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  close: <><path d="M18 6L6 18M6 6l12 12" /></>,
  chevronDown: <><path d="M6 9l6 6 6-6" /></>,
  chevronUp: <><path d="M6 15l6-6 6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  trash: <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>,

  // --- card list actions
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  arrowUp: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
  arrowDown: <><path d="M12 5v14M19 12l-7 7-7-7" /></>,
  restore: <><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 3v6h6" /></>,
};

export default function Icon({ name, size = 20, strokeWidth = 1.7, className = '', style }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}

export { PATHS as ICON_NAMES };
