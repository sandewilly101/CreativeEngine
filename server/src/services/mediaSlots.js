/**
 * Media slots.
 *
 * Fixed positions on the public site — the homepage hero, each division
 * header, the social share card — that resolve to whatever image has been
 * uploaded under a reserved filename.
 *
 * Upload `ce-slot-home-hero.png` in the Media Library and the homepage hero
 * changes. No admin field to find, no code change, and re-uploading replaces
 * it. The `ce-slot-` prefix keeps the namespace out of the way of ordinary
 * uploads: nobody names a client photograph that by accident, which is the
 * point — a slot should only ever be filled deliberately.
 *
 * Resolution order per slot:
 *   1. an uploaded file whose original name matches the slot key
 *   2. the curated reference image that ships with the platform
 *   3. null, and the page renders its placeholder
 */
import { query } from '../config/db.js';

export const SLOT_PREFIX = 'ce-slot-';

/**
 * Every slot the public site reads. `fallback` is the shipped image used
 * until something is uploaded; `ratio` and `notes` are what the prompts file
 * and the admin screen quote back to whoever is generating the artwork.
 */
export const SLOTS = {
  'home-hero': {
    label: 'Homepage hero',
    where: 'The wide image under the homepage headline',
    ratio: '21:9 — 2560×1100',
    fallback: 'IMG-01-hero-studio.jpg',
  },
  'home-partner': {
    label: 'Homepage — one partner',
    where: 'Beside "The waste is not the work" on the homepage',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-02-one-partner.jpg',
  },
  'home-journey': {
    label: 'Homepage — the journey',
    where: 'The sticky image beside the seven-stage journey',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-27-big-idea.jpg',
  },
  'home-ai': {
    label: 'Homepage — AI band',
    where: 'The tall image in the dark AI section',
    ratio: '3:4 — 1200×1600',
    fallback: 'IMG-17-ai-channels.jpg',
  },
  'about-studio': {
    label: 'About — studio',
    where: 'The About page header image',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-28-studio-contact.jpg',
  },
  'about-why': {
    label: 'About — why we exist',
    where: 'The tall image beside "Six suppliers. Six people to blame."',
    ratio: '3:4 — 1200×1600',
    fallback: 'IMG-27-big-idea.jpg',
  },
  'services-help': {
    label: 'Services — not sure where to start',
    where: 'Beside "Tell us the problem, not the service"',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-02-one-partner.jpg',
  },
  'equipment-hero': {
    label: 'Equipment hire header',
    where: 'The equipment catalogue page header',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-24-equipment.jpg',
  },
  'print-hero': {
    label: 'Print shop header',
    where: 'The print shop page header',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-23-print.jpg',
  },
  'division-creative': {
    label: 'Division — Creative & Marketing',
    where: 'Header of the creative division page',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-19-creative.jpg',
  },
  'division-digital': {
    label: 'Division — Web & Digital',
    where: 'Header of the digital division page',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-20-digital.jpg',
  },
  'division-ai': {
    label: 'Division — AI Business Systems',
    where: 'Header of the AI division page',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-21-ai.jpg',
  },
  'division-events': {
    label: 'Division — Events & Experiences',
    where: 'Header of the events division page',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-22-events.jpg',
  },
  'division-print': {
    label: 'Division — Print & Equipment',
    where: 'Header of the print division page',
    ratio: '4:3 — 1600×1200',
    fallback: 'IMG-23-print.jpg',
  },
  'payment-methods': {
    label: 'Payment methods strip',
    where: 'The "How we price" band on the Packages page',
    ratio: 'Wide — 2075×758, transparent PNG',
    fallback: 'payment-methods.png',
  },
  'og-share': {
    label: 'Social share card',
    where: 'What appears when a page is shared to WhatsApp or LinkedIn',
    ratio: '1.91:1 — 1200×630',
    fallback: null,
  },
  'logo-mark': {
    label: 'Logo mark',
    where: 'Replaces the built-in orbit mark in the header and footer',
    ratio: 'Square — 512×512, transparent PNG',
    fallback: null,
  },
  'error-404': {
    label: '404 illustration',
    where: 'The page-not-found screen',
    ratio: '3:2 — 1200×800, transparent PNG',
    fallback: null,
  },
  'empty-state': {
    label: 'Empty state illustration',
    where: 'Lists and tables with nothing in them yet',
    ratio: '3:2 — 900×600, transparent PNG',
    fallback: null,
  },
  'ai-avatar': {
    label: 'AI assistant avatar',
    where: 'The chat widget header and its replies',
    ratio: 'Square — 256×256, transparent PNG',
    fallback: null,
  },
  'case-study-cover': {
    label: 'Case study cover template',
    where: 'Blank layout template — photo area over a title band, for composing covers',
    ratio: '4:3 — 1600×1200',
    fallback: null,
  },
  'social-post-template': {
    label: 'Instagram post template',
    where: 'Blank square template with space for a headline, for composing posts',
    ratio: 'Square — 1080×1080',
    fallback: null,
  },
  'division-icons': {
    label: 'Division icon sheet',
    where: 'The five division icons, in division colours',
    ratio: 'Wide — 2000×800, transparent PNG',
    fallback: null,
  },
  'icon-creative': {
    label: 'Icon — Creative & Marketing',
    where: 'The Creative & Marketing division card and service grid',
    ratio: 'Square — 512×512, transparent PNG',
    fallback: null,
  },
  'icon-digital': {
    label: 'Icon — Web & Digital',
    where: 'The Web & Digital division card and service grid',
    ratio: 'Square — 512×512, transparent PNG',
    fallback: null,
  },
  'icon-ai': {
    label: 'Icon — AI Business Systems',
    where: 'The AI Business Systems division card and service grid',
    ratio: 'Square — 512×512, transparent PNG',
    fallback: null,
  },
  'icon-events': {
    label: 'Icon — Events & Experiences',
    where: 'The Events & Experiences division card and service grid',
    ratio: 'Square — 512×512, transparent PNG',
    fallback: null,
  },
  'tier-launch-pad': {
    label: 'Package tier — Launch Pad',
    where: 'The Launch Pad card on the Packages page',
    ratio: 'Square-ish — 800×800, transparent PNG',
    fallback: null,
  },
  'tier-always-on': {
    label: 'Package tier — Always On',
    where: 'The Always On card on the Packages page',
    ratio: 'Square-ish — 800×800, transparent PNG',
    fallback: null,
  },
  'tier-event-engine': {
    label: 'Package tier — Event Engine',
    where: 'The Event Engine card on the Packages page',
    ratio: 'Square-ish — 800×800, transparent PNG',
    fallback: null,
  },
  'logo-primary': {
    label: 'Primary logo',
    where: 'Brand asset — the full logo on white, for documents and print',
    ratio: '3:2 — 1536×1024',
    fallback: null,
  },
  'logo-lockup': {
    label: 'Logo lockup',
    where: 'Brand asset — mark plus wordtype, for letterheads and decks',
    ratio: '2:1 — 1774×887, transparent PNG',
    fallback: null,
  },
  'logo-variants': {
    label: 'Logo variants sheet',
    where: 'Brand asset — monochrome and reversed treatments',
    ratio: '2:1 — 1774×887',
    fallback: null,
  },
  'logo-mark-light': {
    label: 'Logo mark (on dark)',
    where: 'The footer and any ink-coloured section',
    ratio: 'Square — 512×512',
    fallback: null,
  },
  'icon-set-mono': {
    label: 'Icon set (monochrome)',
    where: 'The five division icons in ink, for light surfaces',
    ratio: 'Wide — 2000×800, transparent PNG',
    fallback: null,
  },
  'icon-print': {
    label: 'Icon — Print & Production',
    where: 'The Print & Production division card and service grid',
    ratio: 'Square — 512×512, transparent PNG',
    fallback: null,
  },
};

/** The exact filename to upload for a slot, any common image extension. */
export function slotFilename(key, ext = 'png') {
  return `${SLOT_PREFIX}${key}.${ext}`;
}

const EXT = /\.(png|jpe?g|webp|avif|svg)$/i;

/**
 * Resolve every slot to a URL.
 *
 * One query rather than one per slot: the public site asks for this on every
 * page load, so it has to be cheap.
 */
export async function resolveSlots() {
  const rows = await query(
    `SELECT original_name, public_url, thumb_url, alt_text, width, height
       FROM media
      WHERE deleted_at IS NULL
        AND (original_name LIKE ? OR original_name IN (${
          Object.values(SLOTS).map(() => '?').join(',')
        }))
      ORDER BY created_at DESC`,
    [`${SLOT_PREFIX}%`, ...Object.values(SLOTS).map((s) => s.fallback ?? '')]
  );

  // Index by filename, newest first — a re-upload wins over the original.
  const byName = new Map();
  for (const row of rows) {
    if (!byName.has(row.original_name)) byName.set(row.original_name, row);
  }

  const resolved = {};
  for (const [key, slot] of Object.entries(SLOTS)) {
    // An uploaded slot file, whatever extension it carries.
    let match = null;
    for (const [name, row] of byName) {
      if (!name.startsWith(SLOT_PREFIX)) continue;
      const base = name.replace(EXT, '').toLowerCase();
      if (base === `${SLOT_PREFIX}${key}`) { match = row; break; }
    }

    // Otherwise the shipped reference image.
    if (!match && slot.fallback) {
      match = byName.get(slot.fallback)
        ?? { public_url: `/uploads/reference/${slot.fallback}`, alt_text: null };
    }

    resolved[key] = match
      ? {
          url: match.public_url,
          thumb: match.thumb_url ?? null,
          alt: match.alt_text ?? null,
          custom: Boolean(match.original_name?.startsWith(SLOT_PREFIX)),
        }
      : null;
  }

  return resolved;
}

/** Slot definitions plus their current state, for the admin screen. */
export async function slotStatus() {
  const resolved = await resolveSlots();
  return Object.entries(SLOTS).map(([key, slot]) => ({
    key,
    filename: slotFilename(key),
    ...slot,
    url: resolved[key]?.url ?? null,
    custom: resolved[key]?.custom ?? false,
  }));
}
