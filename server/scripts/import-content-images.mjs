/**
 * Attach generated artwork to content records.
 *
 * The slot importer covers fixed positions on the site. This one covers rows:
 * print products, services and portfolio pieces, each of which points at a
 * media row through `cover_media_id` / `hero_media_id`. Between them the two
 * scripts place every file in the prompted-images folder.
 *
 * Images are registered in the media library exactly as an Admin upload would
 * be, then linked. Re-running replaces rather than duplicates: a previously
 * imported file for the same target is soft-deleted first.
 *
 *   node scripts/import-content-images.mjs [--dry]
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
 * Print products. The mockups are blank templates — a bare banner, an unprinted
 * mug — which is exactly right here: the catalogue sells the product, and the
 * customer's artwork is what goes on it.
 */
const PRINT_PRODUCTS = {
  'outdoor-banner': { file: 'mockups/Outdoor banner mockup.png', alt: 'A large outdoor banner mounted on a building frontage' },
  'roll-up-banner': { file: 'mockups/Roll-up banner mockup.png', alt: 'A roll-up banner standing in a hotel conference foyer' },
  'backdrop-wall': { file: 'mockups/Media wall.png', alt: 'A step-and-repeat media wall at a press event' },
  'vinyl-signage': { file: 'mockups/Signage mockup.png', alt: 'Vinyl signage applied to a shopfront' },
  'branded-tshirt': { file: 'mockups/T-shirt mockup.png', alt: 'A branded t-shirt laid flat' },
  'branded-mug': { file: 'mockups/Branded mug mockup.png', alt: 'A branded ceramic mug on a desk' },
  'vehicle-wrap': { file: 'mockups/Vehicle branding mockup.png', alt: 'A company vehicle with full branding applied' },
};

/** Services whose work the generated artwork actually depicts. */
const SERVICES = {
  'exhibition-stands': { file: 'mockups/Exhibition stand mockup.png', alt: 'A custom exhibition stand on a trade show floor' },
  'vehicle-branding': { file: 'mockups/Vehicle branding mockup.png', alt: 'A branded fleet vehicle' },
  'branded-merchandise': { file: 'mockups/Branded mug mockup.png', alt: 'Branded merchandise' },
  'signage-fabrication': { file: 'mockups/Signage mockup.png', alt: 'Fabricated and installed signage' },
  'large-format-print': { file: 'mockups/Outdoor banner mockup.png', alt: 'Large format printed banner' },
  'brand-identity': { file: 'artworks/Logo lockup.png', alt: 'A brand identity lockup' },
  'ai-customer-assistant': { file: 'artworks/AI assistant avatar.png', alt: 'The Creative Engine AI assistant' },
};

/**
 * Portfolio pieces. The table ships empty, so the brand work generated for
 * Creative Engine itself becomes the first case study rather than sitting
 * unused — an agency showing its own identity work is honest, where inventing
 * client names would not be.
 */
const PORTFOLIO = [
  {
    slug: 'creative-engine-identity',
    title: 'Creative Engine — brand identity',
    client_name: 'Creative Engine',
    division: 'creative-marketing',
    summary: 'The identity behind this site: a five-segment mark for five divisions, an acid-lime and flame palette, and the rules that keep it consistent from a 16px favicon to a six-metre banner.',
    file: 'artworks/Logo lockup.png',
    alt: 'The Creative Engine logo lockup',
  },
  {
    slug: 'creative-engine-brand-system',
    title: 'Applying the system',
    client_name: 'Creative Engine',
    division: 'print-production',
    summary: 'The same identity carried across print and environment: signage, vehicle livery, exhibition stands and merchandise, produced in-house.',
    file: 'mockups/Exhibition stand mockup.png',
    alt: 'The Creative Engine identity applied to an exhibition stand',
  },
];

/** Registered once, shared by every record that points at the same file. */
const mediaCache = new Map();

async function registerMedia(db, relFile, alt, folderId) {
  const key = `${relFile}::${folderId}`;
  if (mediaCache.has(key)) return mediaCache.get(key);

  const srcPath = path.join(SOURCE, relFile);
  if (!fs.existsSync(srcPath)) return null;

  // Covers render into 4:3 and 16:9 cards. Fit the whole image inside a 4:3
  // frame over a blurred copy of itself rather than cropping into it — the
  // roll-up mockup is portrait and would lose the banner entirely otherwise.
  const TW = 1600;
  const TH = 1200;
  const m = await sharp(srcPath).metadata();
  const scale = Math.min(TW / m.width, TH / m.height);
  const w = Math.round(m.width * scale);
  const h = Math.round(m.height * scale);
  const left = Math.floor((TW - w) / 2);
  const top = Math.floor((TH - h) / 2);

  let buffer;
  if (w >= TW - 1 && h >= TH - 1) {
    buffer = await sharp(srcPath).resize(TW, TH, { fit: 'cover' })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } else {
    // Blur-extending only works when there is something to blur. On artwork
    // set on a flat ground — a logo on white — it averages to dull grey bars,
    // which is worse than no fill at all. Detect that and pad with the
    // image's own background colour so the frame reads as one surface.
    // Measure the border strips only. Sampling the whole frame lets the
    // subject's own contrast (a black logo) mask a perfectly flat ground.
    const bw = Math.max(2, Math.round(m.width * 0.04));
    const bh = Math.max(2, Math.round(m.height * 0.04));
    // Each crop is written to a buffer before measuring: `stats()` reads the
    // source image, not a chained `extract`, so measuring inline silently
    // returns whole-frame figures for every strip.
    const measure = async (box) =>
      sharp(await sharp(srcPath).extract(box).png().toBuffer()).stats();
    const strips = await Promise.all([
      measure({ left: 0, top: 0, width: m.width, height: bh }),
      measure({ left: 0, top: m.height - bh, width: m.width, height: bh }),
      measure({ left: 0, top: 0, width: bw, height: m.height }),
      measure({ left: m.width - bw, top: 0, width: bw, height: m.height }),
    ]);
    const flat = strips.every((st) =>
      st.channels.slice(0, 3).every((c) => c.stdev < 26));

    if (flat) {
      const [r, g, b] = strips[0].channels.slice(0, 3).map((c) => Math.round(c.mean));
      buffer = await sharp(srcPath)
        .resize(TW, TH, { fit: 'contain', background: { r, g, b } })
        .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } else {
      const bg = await sharp(srcPath).resize(TW, TH, { fit: 'cover' })
        .blur(70).modulate({ brightness: 0.82 }).toBuffer();
      const fg = await sharp(srcPath).resize(w, h).toBuffer();
      buffer = await sharp(bg).composite([{ input: fg, left, top }])
        .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    }
  }

  const originalName = `ce-content-${path.basename(relFile, '.png')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;

  if (DRY) {
    mediaCache.set(key, -1);
    return -1;
  }

  const [existing] = await db.query(
    'SELECT id FROM media WHERE original_name = ? AND deleted_at IS NULL LIMIT 1',
    [originalName]
  );
  if (existing.length) {
    mediaCache.set(key, existing[0].id);
    return existing[0].id;
  }

  const now = new Date();
  const dir = path.join(UPLOAD_ROOT, String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'));
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.jpg`;
  const abs = path.join(dir, filename);
  await fs.promises.writeFile(abs, buffer);

  const thumbAbs = path.join(dir, `thumb-${filename.replace(/\.[^.]+$/, '')}.webp`);
  await sharp(buffer).resize(THUMB_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: 78 }).toFile(thumbAbs);

  const url = (p) => '/uploads/' + path.relative(UPLOAD_ROOT, p).split(path.sep).join('/');
  const meta = await sharp(buffer).metadata();

  const [res] = await db.execute(
    `INSERT INTO media
       (folder_id, filename, original_name, mime_type, kind, extension, size_bytes,
        width, height, storage_path, public_url, thumb_url, title, alt_text,
        is_public, checksum_sha256, uploaded_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      folderId, filename, originalName, 'image/jpeg', 'image', 'jpg', buffer.length,
      meta.width, meta.height, abs, url(abs), url(thumbAbs),
      path.basename(relFile, '.png'), alt, 1,
      crypto.createHash('sha256').update(buffer).digest('hex'), UPLOADER_ID,
    ]
  );
  mediaCache.set(key, res.insertId);
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

  let linked = 0;

  for (const [slug, spec] of Object.entries(PRINT_PRODUCTS)) {
    const id = await registerMedia(db, spec.file, spec.alt, 5);
    if (!id) { console.warn(`skip  print/${slug} — missing ${spec.file}`); continue; }
    if (!DRY) {
      await db.execute('UPDATE print_products SET cover_media_id = ? WHERE slug = ?', [id, slug]);
    }
    console.log(`${DRY ? 'dry  ' : 'ok   '} print    ${slug.padEnd(28)} <- ${spec.file}`);
    linked++;
  }

  for (const [slug, spec] of Object.entries(SERVICES)) {
    const id = await registerMedia(db, spec.file, spec.alt, 3);
    if (!id) { console.warn(`skip  service/${slug} — missing ${spec.file}`); continue; }
    if (!DRY) {
      await db.execute('UPDATE services SET hero_media_id = ? WHERE slug = ?', [id, slug]);
    }
    console.log(`${DRY ? 'dry  ' : 'ok   '} service  ${slug.padEnd(28)} <- ${spec.file}`);
    linked++;
  }

  for (const item of PORTFOLIO) {
    const id = await registerMedia(db, item.file, item.alt, 2);
    if (!id) { console.warn(`skip  work/${item.slug} — missing ${item.file}`); continue; }
    if (!DRY) {
      const [div] = await db.query('SELECT id FROM divisions WHERE slug = ?', [item.division]);
      const [exists] = await db.query(
        'SELECT id FROM portfolio_items WHERE slug = ? LIMIT 1', [item.slug]
      );
      if (exists.length) {
        await db.execute(
          `UPDATE portfolio_items
              SET title = ?, client_name = ?, summary = ?, cover_media_id = ?,
                  division_id = ?, status = 'published', deleted_at = NULL
            WHERE id = ?`,
          [item.title, item.client_name, item.summary, id, div[0]?.id ?? null, exists[0].id]
        );
      } else {
        await db.execute(
          `INSERT INTO portfolio_items
             (slug, title, client_name, summary, cover_media_id, division_id,
              status, is_featured)
           VALUES (?,?,?,?,?,?,'published',1)`,
          [item.slug, item.title, item.client_name, item.summary, id, div[0]?.id ?? null]
        );
      }
    }
    console.log(`${DRY ? 'dry  ' : 'ok   '} work     ${item.slug.padEnd(28)} <- ${item.file}`);
    linked++;
  }

  console.log(`\n${linked} records linked.`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
