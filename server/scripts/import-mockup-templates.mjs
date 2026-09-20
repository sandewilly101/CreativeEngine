/**
 * Seed the mockup templates.
 *
 * The eight generated mockups are deliberately blank — an unprinted banner, a
 * plain white mug — because that is what `graphics prompts.md` §5 asked for:
 *
 *   "Upload to Media Library, then create the template in Admin → Website →
 *    Mockup templates and set the four corner points of the artwork area."
 *
 * They are not catalogue photographs. They are the surfaces a customer's
 * artwork gets previewed on, and each needs the corners of its printable area
 * recorded so the overlay lands in the right place.
 *
 * The corners below were found by locating the largest contiguous near-white
 * region in each image, then checked by rendering the box back over the
 * photograph. Several needed correcting by hand afterwards: the automatic
 * region ran past the printable face on the exhibition stand (it took in the
 * side wall and floor) and on the van (the windscreen and wheel arch), and it
 * swallowed the whole frame on the mug, t-shirt and roll-up where the
 * background is also white.
 *
 *   node scripts/import-mockup-templates.mjs [--dry]
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import mysql from 'mysql2/promise';

const DRY = process.argv.includes('--dry');
const SOURCE = 'C:/Users/pc/Downloads/Buchad/some of the prompted images/mockups';
const UPLOAD_ROOT = path.resolve(import.meta.dirname, '../uploads');
const UPLOADER_ID = 1;

/**
 * `area` is the printable face as fractions of the image: [x1, y1, x2, y2].
 * Fractions rather than pixels so the same numbers hold if the base image is
 * ever re-exported at another size.
 */
const TEMPLATES = [
  {
    name: 'Outdoor banner — 6m × 3m',
    category: 'banner',
    file: 'Outdoor banner mockup.png',
    description: 'PVC banner on a frame outside an office building. Artwork lands on the full banner face.',
    area: [0.100, 0.178, 0.900, 0.717],
  },
  {
    name: 'Roll-up banner — 850 × 2000mm',
    category: 'banner',
    file: 'Roll-up banner mockup.png',
    description: 'Roll-up stand in a hotel conference foyer.',
    area: [0.255, 0.065, 0.735, 0.855],
  },
  {
    name: 'Media wall — 3m × 2.4m',
    category: 'banner',
    file: 'Media wall.png',
    description: 'Step-and-repeat press wall with red carpet.',
    area: [0.114, 0.128, 0.892, 0.795],
  },
  {
    name: 'Illuminated fascia sign',
    category: 'signage',
    file: 'Signage mockup.png',
    description: 'Retail fascia sign at blue hour, internally lit.',
    area: [0.139, 0.229, 0.872, 0.379],
  },
  {
    name: 'T-shirt — front print',
    category: 'apparel',
    file: 'T-shirt mockup.png',
    description: 'Flat-lay cotton crew neck. Artwork lands on the chest print area.',
    area: [0.345, 0.300, 0.655, 0.660],
  },
  {
    name: 'Ceramic mug — wrap print',
    category: 'merchandise',
    file: 'Branded mug mockup.png',
    description: 'White mug on a wooden desk, handle right.',
    area: [0.320, 0.380, 0.630, 0.680],
  },
  {
    name: 'Panel van — side livery',
    category: 'vehicle',
    file: 'Vehicle branding mockup.png',
    description: 'Van side three-quarter. Artwork lands on the flat side panel, clear of the windscreen and wheel arches.',
    area: [0.215, 0.325, 0.585, 0.545],
  },
  {
    name: 'Exhibition stand — 3m × 3m',
    category: 'exhibition',
    file: 'Exhibition stand mockup.png',
    description: 'Modular stand on a trade-fair floor. Artwork lands on the rear wall panel.',
    area: [0.085, 0.100, 0.600, 0.620],
  },
];

async function registerBase(db, file, name) {
  const srcPath = path.join(SOURCE, file);
  if (!fs.existsSync(srcPath)) return null;

  const originalName = `ce-mockup-${file.toLowerCase()
    .replace(/\.png$/, '').replace(/[^a-z0-9]+/g, '-')}.jpg`;

  const [existing] = await db.query(
    'SELECT id FROM media WHERE original_name = ? AND deleted_at IS NULL LIMIT 1',
    [originalName]
  );
  if (existing.length) return existing[0].id;

  // Kept whole and uncropped: the corner fractions are relative to the full
  // frame, so cropping here would silently move every artwork area.
  const buffer = await sharp(srcPath).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  const meta = await sharp(buffer).metadata();

  const now = new Date();
  const dir = path.join(UPLOAD_ROOT, String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'));
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.jpg`;
  const abs = path.join(dir, filename);
  await fs.promises.writeFile(abs, buffer);

  const thumbAbs = path.join(dir, `thumb-${filename.replace(/\.[^.]+$/, '')}.webp`);
  await sharp(buffer).resize(480, null, { withoutEnlargement: true })
    .webp({ quality: 78 }).toFile(thumbAbs);

  const url = (p) => '/uploads/' + path.relative(UPLOAD_ROOT, p).split(path.sep).join('/');

  const [res] = await db.execute(
    `INSERT INTO media
       (folder_id, filename, original_name, mime_type, kind, extension, size_bytes,
        width, height, storage_path, public_url, thumb_url, title, alt_text,
        is_public, checksum_sha256, uploaded_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      5, filename, originalName, 'image/jpeg', 'image', 'jpg', buffer.length,
      meta.width, meta.height, abs, url(abs), url(thumbAbs),
      name, `${name} mockup template`, 1,
      crypto.createHash('sha256').update(buffer).digest('hex'), UPLOADER_ID,
    ]
  );
  return res.insertId;
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'creative_engine',
  });

  let n = 0;
  for (const [i, t] of TEMPLATES.entries()) {
    if (DRY) {
      console.log(`dry   ${t.name.padEnd(32)} area ${t.area.join(', ')}`);
      n++;
      continue;
    }

    const baseId = await registerBase(db, t.file, t.name);
    if (!baseId) { console.warn(`skip  ${t.name} — missing ${t.file}`); continue; }

    // Four corners clockwise from top-left, matching how the admin screen
    // asks for them, plus the rectangle for anything that only needs bounds.
    const [x1, y1, x2, y2] = t.area;
    const overlay = {
      mode: 'rect',
      area: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
      corners: [
        { x: x1, y: y1 }, { x: x2, y: y1 },
        { x: x2, y: y2 }, { x: x1, y: y2 },
      ],
      units: 'fraction',
      blend: 'multiply',
    };

    const [exists] = await db.query(
      'SELECT id FROM mockup_templates WHERE name = ? LIMIT 1', [t.name]
    );
    if (exists.length) {
      await db.execute(
        `UPDATE mockup_templates
            SET category = ?, description = ?, base_media_id = ?, overlay_config = ?,
                is_published = 1, sort_order = ?, deleted_at = NULL
          WHERE id = ?`,
        [t.category, t.description, baseId, JSON.stringify(overlay), i, exists[0].id]
      );
    } else {
      await db.execute(
        `INSERT INTO mockup_templates
           (name, category, description, base_media_id, overlay_config,
            is_published, sort_order, created_by)
         VALUES (?,?,?,?,?,1,?,?)`,
        [t.name, t.category, t.description, baseId,
          JSON.stringify(overlay), i, UPLOADER_ID]
      );
    }

    console.log(`ok    ${t.name.padEnd(32)} <- ${t.file}`);
    n++;
  }

  console.log(`\n${n} mockup templates.`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
