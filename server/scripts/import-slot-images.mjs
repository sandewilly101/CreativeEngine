/**
 * Import generated artwork into the image slots.
 *
 * Takes the files produced from `graphics prompts.md`, fits each one to the
 * ratio its slot expects, writes it into the uploads tree under the reserved
 * `ce-slot-*` name and registers it in the media library. The public site
 * then picks it up on the next load — same path as an Admin upload, just
 * without the browser.
 *
 * Fitting never crops. A generated image is composed as a whole and trimming
 * it to a slot ratio throws away part of what was asked for, so instead the
 * full image is scaled to fit inside the target and the remaining canvas is
 * filled with a heavily blurred, slightly darkened copy of itself. The
 * foreground's edges are feathered into that blur, which reads as ambient
 * light falloff rather than a letterbox. Mirroring the edges was tried first
 * and rejected: it duplicated people and hardware at the seam.
 *
 * Re-running is safe. Each slot is matched on its `ce-slot-` name, and an
 * existing row is soft-deleted before the new one lands, so the newest file
 * wins exactly as a re-upload would.
 *
 *   node scripts/import-slot-images.mjs [--dry]
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import mysql from 'mysql2/promise';

const DRY = process.argv.includes('--dry');
const SOURCE = 'C:/Users/pc/Downloads/Buchad/some of the prompted images';
const UPLOAD_ROOT = path.resolve(import.meta.dirname, '../uploads');
const UPLOADER_ID = 1;
const THUMB_WIDTH = 480;

/**
 * Slot key -> source file, target pixels and the folder it files under.
 *
 * Only slots with a genuinely suitable image are listed. The rest keep the
 * curated photography that ships with the platform: a mug mockup or an icon
 * sheet in a page header would be worse than what is already there.
 */
const MAP = {
  'home-hero': {
    file: 'artworks/Homepage hero.png',
    width: 2560, height: 1100, folder: 3,
    alt: 'The Creative Engine studio in Dar es Salaam, a team working across design, print and lighting in late afternoon light',
  },
  'home-partner': {
    file: 'artworks/Homepage hero background.png',
    width: 1600, height: 1200, folder: 3,
    alt: 'Two designers reviewing a printed proof against brand layouts on screen',
  },
  'home-journey': {
    // §3.2's abstract hero: five streams braiding into one rope of light —
    // literally the "six suppliers vs one partner" argument this section
    // makes, so it belongs here rather than on a service card.
    file: 'artworks/Alternative abstract hero.png',
    width: 1600, height: 1200, folder: 3,
    alt: 'Five coloured streams of light converging into a single rope',
  },
  'division-creative': {
    file: 'artworks/Creative & Marketing.png',
    width: 1600, height: 1200, folder: 3,
    alt: 'Overhead view of a brand direction session: colour swatches, logo explorations and a campaign layout on a tablet',
  },
  'about-studio': {
    file: 'artworks/culture photograph.png',
    width: 1600, height: 1200, folder: 3,
    alt: 'The Creative Engine team at work in the studio',
  },
  'og-share': {
    file: 'artworks/Social cover banner.png',
    width: 1200, height: 630, folder: 1,
    alt: 'Creative Engine — from ideas to impact',
  },
  'logo-mark': {
    file: 'artworks/Primary logo-no background.png',
    width: 512, height: 512, folder: 1, transparent: true, markCrop: true,
    alt: 'Creative Engine logo mark',
  },
  'error-404': {
    keyWhite: true, lightenInk: true,
    file: 'artworks/404 page illustration.png',
    width: 1200, height: 800, folder: 1, transparent: true,
    alt: '',
  },
  'empty-state': {
    keyWhite: true,
    file: 'artworks/Empty state illustration.png',
    width: 900, height: 600, folder: 1, transparent: true,
    alt: '',
  },
  'ai-avatar': {
    keyWhite: true,
    file: 'artworks/AI assistant avatar.png',
    width: 256, height: 256, folder: 1, transparent: true,
    alt: 'Creative Engine assistant',
  },
  'social-post-template': {
    file: 'artworks/Instagram post template.png',
    width: 1080, height: 1080, folder: 1,
    alt: 'Blank branded post template with space for a headline',
  },
  'case-study-cover': {
    file: 'artworks/Case study cover template.png',
    width: 1600, height: 1200, folder: 2,
    alt: 'Creative Engine case study',
  },
  'division-icons': {
    keyWhite: true,
    file: 'artworks/Division icons in division colours.png',
    width: 2000, height: 800, folder: 1, transparent: true,
    alt: 'The five division icons',
  },
  'tier-launch-pad': {
    file: 'artworks/Package tier illustrations.png',
    width: 800, height: 800, folder: 3, transparent: true, keyWhite: true,
    sliceIndex: 0, mergeGap: 20, inkLevel: 228,
    alt: 'Launch Pad package illustration',
  },
  'tier-always-on': {
    file: 'artworks/Package tier illustrations.png',
    width: 800, height: 800, folder: 3, transparent: true, keyWhite: true,
    sliceIndex: 1, mergeGap: 20, inkLevel: 228,
    alt: 'Always On package illustration',
  },
  'tier-event-engine': {
    file: 'artworks/Package tier illustrations.png',
    width: 800, height: 800, folder: 3, transparent: true, keyWhite: true,
    sliceIndex: 2, mergeGap: 20, inkLevel: 228,
    alt: 'Event Engine package illustration',
  },
  'logo-primary': {
    file: 'artworks/Primary logo.png',
    width: 1536, height: 1024, folder: 1,
    alt: 'The Creative Engine primary logo',
  },
  'logo-lockup': {
    file: 'artworks/Logo lockup.png',
    width: 1774, height: 887, folder: 1, transparent: true, keyWhite: true,
    alt: 'The Creative Engine logo lockup',
  },
  'logo-variants': {
    file: 'artworks/Monochrome and reversed variants.png',
    width: 1774, height: 887, folder: 1,
    alt: 'Logo variants: monochrome and reversed',
  },
  'logo-mark-light': {
    // §7.1's profile picture: the mark in white on its own ink/navy field.
    // That backdrop is right for a social avatar but wrong inline in the
    // footer, where it reads as a stray tile — so key it out and keep the
    // mark alone on transparency.
    file: 'artworks/Social profile picture.png',
    width: 512, height: 512, folder: 1, transparent: true, keyDark: true,
    alt: 'Creative Engine mark, white on transparent',
  },
  'icon-set-mono': {
    file: 'artworks/Full icon set.png',
    width: 2000, height: 800, folder: 1, transparent: true, keyWhite: true,
    alt: 'The five division icons in ink',
  },
  'icon-creative': {
    file: 'artworks/Division icons in division colours.png',
    width: 160, height: 160, folder: 1, transparent: true, keyWhite: true,
    sliceIndex: 0,
    alt: 'Creative and marketing icon',
  },
  'icon-digital': {
    file: 'artworks/Division icons in division colours.png',
    width: 160, height: 160, folder: 1, transparent: true, keyWhite: true,
    sliceIndex: 1,
    alt: 'Web and digital icon',
  },
  'icon-ai': {
    file: 'artworks/Division icons in division colours.png',
    width: 160, height: 160, folder: 1, transparent: true, keyWhite: true,
    sliceIndex: 2,
    alt: 'AI business systems icon',
  },
  'icon-events': {
    file: 'artworks/Division icons in division colours.png',
    width: 160, height: 160, folder: 1, transparent: true, keyWhite: true,
    sliceIndex: 3,
    alt: 'Events and experiences icon',
  },
  'icon-print': {
    file: 'artworks/Division icons in division colours.png',
    width: 160, height: 160, folder: 1, transparent: true, keyWhite: true,
    sliceIndex: 4,
    alt: 'Print and production icon',
  },
};

/**
 * Fit an image to exactly width x height without discarding any of it.
 *
 * Transparent assets are padded rather than blur-filled — a logo mark needs
 * to stay on transparency, and a blurred backdrop behind it would defeat the
 * point of shipping a cutout.
 */
async function fitToSlot(srcPath, { width, height, transparent, markCrop, keyWhite, keyDark, lightenInk, sliceIndex, mergeGap, inkLevel }) {
  const meta = await sharp(srcPath).metadata();

  // The logo file is a horizontal lockup; the slot wants just the square
  // mark, so take the mark's own bounding box rather than squashing the
  // wordtype into a square.
  let input = srcPath;
  if (sliceIndex !== undefined) {
    input = await sliceIcon(srcPath, sliceIndex, mergeGap, inkLevel);
  }
  if (markCrop) {
    // Trim the transparent margin first, then take a square from the left
    // edge as tall as the artwork — that is the mark, before the wordtype.
    const trimmed = await sharp(srcPath).trim({ threshold: 1 }).toBuffer();
    const t = await sharp(trimmed).metadata();
    const side = Math.min(t.height, t.width);
    input = await sharp(trimmed)
      .extract({ left: 0, top: 0, width: side, height: side })
      .toBuffer();
  }

  if (transparent) {
    // The prompts asked for transparency but the generator returned these on
    // near-white. Key that out, otherwise the 404 illustration lands as a
    // white rectangle on the ink background. `keyWhite` is off for artwork
    // that is legitimately light-on-light.
    const base = sharp(input).resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if (keyDark) {
      const { data, info } = await base.ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true });
      const THRESH = 118;   // fully transparent at or below this
      const SOFT = 165;     // ramp above it, so the mark keeps a clean edge
      for (let i = 0; i < data.length; i += info.channels) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        if (max <= THRESH) data[i + 3] = 0;
        else if (max < SOFT) {
          data[i + 3] = Math.round(data[i + 3] * ((max - THRESH) / (SOFT - THRESH)));
        }
      }
      // §7.1 asks for generous padding so the avatar survives a circular
      // crop. Inline in the footer that padding just renders the mark small,
      // so trim back to the artwork and re-fit the square.
      const keyed = await sharp(data, { raw: info }).png().toBuffer();
      const tight = await sharp(keyed).trim({ threshold: 1 }).png().toBuffer();
      return sharp(tight)
        .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, quality: 92, effort: 9 }).toBuffer();
    }
    if (!keyWhite) return base.png({ palette: true, quality: 92, effort: 9 }).toBuffer();

    const { data, info } = await base.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const THRESH = 232;      // fully transparent at or above this
    const SOFT = 200;        // ramp to partial alpha below it, to keep edges smooth
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const min = Math.min(r, g, b);
      const spread = Math.max(r, g, b) - min;
      if (spread > 18) continue;                 // coloured pixel, leave it
      if (min >= THRESH) data[i + 3] = 0;
      else if (min > SOFT) {
        data[i + 3] = Math.round(data[i + 3] * (1 - (min - SOFT) / (THRESH - SOFT)));
      } else if (lightenInk) {
        // This one sits on the ink 404 screen, where its near-black strokes
        // would vanish. Lift the neutral linework to off-white and leave the
        // flame accents (caught by the spread test above) untouched.
        data[i] = 249; data[i + 1] = 249; data[i + 2] = 249;
      }
    }
    return sharp(data, { raw: info }).png().toBuffer();
  }

  // Photographs ship as JPEG. The same hero as a PNG is roughly 4.9MB against
  // ~400KB here, and it sits above the fold on the homepage.
  const encode = (pipeline) => pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

  const m = await sharp(input).metadata();
  const scale = Math.min(width / m.width, height / m.height);
  const w = Math.round(m.width * scale);
  const h = Math.round(m.height * scale);
  const left = Math.floor((width - w) / 2);
  const top = Math.floor((height - h) / 2);

  // Already the right shape (within a pixel) — no fill needed.
  if (w >= width - 1 && h >= height - 1) {
    return encode(sharp(input).resize(width, height, { fit: 'cover' }));
  }

  const background = await sharp(input)
    .resize(width, height, { fit: 'cover' })
    .blur(70)
    .modulate({ brightness: 0.8 })
    .toBuffer();

  const foreground = await sharp(input).resize(w, h).ensureAlpha().toBuffer();

  // Feather whichever edges actually meet the fill, so the join disappears.
  const fx = Math.min(90, Math.floor(w * 0.06));
  const fy = Math.min(90, Math.floor(h * 0.06));
  const stops = (f, size) =>
    `<stop offset="0" stop-color="#000"/><stop offset="${f / size}" stop-color="#fff"/>` +
    `<stop offset="${1 - f / size}" stop-color="#fff"/><stop offset="1" stop-color="#000"/>`;
  const grad = left > 0
    ? `<linearGradient id="g" x1="0" x2="1">${stops(fx, w)}</linearGradient>`
    : `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops(fy, h)}</linearGradient>`;
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><defs>${grad}</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/></svg>`
  );
  const feathered = await sharp(foreground)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return encode(sharp(background).composite([{ input: feathered, left, top }]));
}

/**
 * Cut one icon out of the five-across sheet.
 *
 * The sheet has no guides, so the split is found from the pixels: columns
 * carrying ink are grouped into runs, and runs closer than 40px are treated
 * as one icon (a few have a hairline internal gap that would otherwise split
 * them). Trimming runs as its own pass because sharp applies extract and trim
 * in a fixed order within a single pipeline.
 */
async function sliceIcon(srcPath, index, mergeGap = 40, inkLevel = 225) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  const runs = [];
  let start = null;
  for (let x = 0; x < info.width; x++) {
    let ink = 0;
    for (let y = 0; y < info.height; y++) {
      const i = (y * info.width + x) * ch;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < inkLevel) ink++;
    }
    if (ink > 2) { if (start === null) start = x; }
    else if (start !== null) { runs.push([start, x - 1]); start = null; }
  }
  if (start !== null) runs.push([start, info.width - 1]);

  const merged = [runs[0].slice()];
  for (const r of runs.slice(1)) {
    const last = merged[merged.length - 1];
    if (r[0] - last[1] < mergeGap) last[1] = r[1];
    else merged.push(r.slice());
  }

  const span = merged[index];
  if (!span) throw new Error(`icon ${index} not found on sheet`);
  const pad = 14;
  const left = Math.max(0, span[0] - pad);
  const width = Math.min(info.width - left, (span[1] - span[0] + 1) + pad * 2);

  const cut = await sharp(srcPath)
    .extract({ left, top: 0, width, height: info.height }).png().toBuffer();
  return sharp(cut).trim({ threshold: 6 }).png().toBuffer();
}

function uploadDir() {
  const now = new Date();
  const dir = path.join(
    UPLOAD_ROOT,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0')
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const publicUrlFor = (abs) =>
  '/uploads/' + path.relative(UPLOAD_ROOT, abs).split(path.sep).join('/');

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'creative_engine',
  });

  for (const [key, spec] of Object.entries(MAP)) {
    const srcPath = path.join(SOURCE, spec.file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`skip  ${key} — source missing: ${spec.file}`);
      continue;
    }

    // The resolver matches on the slot base name and accepts any common
    // extension, so photographs can land as .jpg without special-casing.
    const ext = spec.transparent ? 'png' : 'jpg';
    const slotName = `ce-slot-${key}.${ext}`;
    const buffer = await fitToSlot(srcPath, spec);
    const meta = await sharp(buffer).metadata();

    if (DRY) {
      console.log(`dry   ${slotName.padEnd(28)} ${meta.width}x${meta.height}  <- ${spec.file}`);
      continue;
    }

    const stamp = Date.now().toString(36);
    const rand = crypto.randomBytes(6).toString('hex');
    const filename = `${stamp}-${rand}.${ext}`;
    const dir = uploadDir();
    const abs = path.join(dir, filename);
    await fs.promises.writeFile(abs, buffer);

    const thumbName = `thumb-${filename.replace(/\.[^.]+$/, '')}.webp`;
    const thumbAbs = path.join(dir, thumbName);
    await sharp(buffer)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbAbs);

    // Retire any previous file in this slot so the newest one resolves.
    await db.execute(
      `UPDATE media SET deleted_at = NOW()
        WHERE original_name IN (?, ?) AND deleted_at IS NULL`,
      [`ce-slot-${key}.png`, `ce-slot-${key}.jpg`]
    );

    await db.execute(
      `INSERT INTO media
         (folder_id, filename, original_name, mime_type, kind, extension, size_bytes,
          width, height, storage_path, public_url, thumb_url, title, alt_text,
          is_public, checksum_sha256, uploaded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        spec.folder, filename, slotName,
        spec.transparent ? 'image/png' : 'image/jpeg', 'image', ext, buffer.length,
        meta.width, meta.height, abs, publicUrlFor(abs), publicUrlFor(thumbAbs),
        slotName.replace(/\.[^.]+$/, ''), spec.alt, 1,
        crypto.createHash('sha256').update(buffer).digest('hex'), UPLOADER_ID,
      ]
    );

    console.log(`ok    ${slotName.padEnd(28)} ${meta.width}x${meta.height}  <- ${spec.file}`);
  }

  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
