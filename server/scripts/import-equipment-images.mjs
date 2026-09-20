/**
 * Attach catalogue photographs to equipment records.
 *
 * The equipment rows shipped without cover images. These photographs come
 * from Openverse and Wikimedia Commons under licences that permit commercial
 * use, which matters here because the catalogue is a commercial rental
 * listing. Each file was reviewed against the item's own specification before
 * being chosen: a line array rather than a generic speaker, box truss
 * sections rather than an erected roof.
 *
 * Attribution travels with the image. Every one of these licences requires
 * crediting the creator, so the credit line goes into the media row itself
 * rather than a file alongside it, and stays attached wherever the image is
 * used.
 *
 * Registration matches the other importers: a 4:3 cover, a webp thumbnail
 * and a media row, then the link onto the equipment record. Re-running
 * replaces a previous import for the same item rather than duplicating it.
 *
 *   node scripts/import-equipment-images.mjs [--dry]
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import mysql from 'mysql2/promise';

const DRY = process.argv.includes('--dry');
const SOURCE = process.env.EQ_IMAGE_DIR;
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(import.meta.dirname, '../uploads');
const UPLOADER_ID = 1;
const THUMB_WIDTH = 480;
const EQUIPMENT_FOLDER = 4; // "Equipment" in media_folders

/**
 * One entry per equipment slug. `alt` describes what the photograph shows for
 * screen readers; `credit` carries the licence requirement.
 */
const ITEMS = {
  'line-array-12': {
    file: 'line-array-12.img',
    alt: 'A flown line array of loudspeaker boxes rigged in a vertical column',
    title: 'Line array system',
    credit: 'Epolk, CC BY-SA 4.0, via Wikimedia Commons',
  },
  'generator-60kva': {
    file: 'generator-60kva.img',
    alt: 'A silent canopy diesel generator set standing outdoors',
    title: 'Silent diesel generator',
    credit: 'Biswarup Ganguly, CC BY 3.0, via Wikimedia Commons',
  },
  'led-p39-indoor': {
    file: 'led-p39-indoor.img',
    alt: 'A curved indoor LED video wall filling the end of a darkened venue',
    title: 'Indoor LED video wall',
    credit: 'Flickr contributor, CC BY 2.0, via Openverse',
  },
  'round-table-10': {
    file: 'round-table-10.img',
    alt: 'Banquet round tables dressed with linen and covered chairs in a function room',
    title: 'Dressed banquet round tables',
    credit: 'Flickr contributor, CC BY 2.0, via Openverse',
  },
  'truss-box-3m': {
    file: 'truss-box-3m.img',
    alt: 'Aluminium box truss sections resting on the floor showing the lattice and connectors',
    title: 'Aluminium box truss sections',
    credit: 'Wikimedia contributor, CC BY-SA 4.0, via Wikimedia Commons',
  },
  'tiffany-chair': {
    file: 'tiffany-chair.img',
    alt: 'A Tiffany chiavari chair with a padded seat cushion on a white background',
    title: 'Tiffany chiavari chair',
    credit: 'Wikimedia contributor, CC BY-SA 4.0, via Wikimedia Commons',
  },
};

/** Build the 1600x1200 cover, matching the framing the other importers use. */
async function buildCover(srcPath) {
  const TW = 1600, TH = 1200;
  const m = await sharp(srcPath).metadata();
  const scale = Math.min(TW / m.width, TH / m.height);
  const w = Math.round(m.width * scale);
  const h = Math.round(m.height * scale);

  if (w >= TW - 1 && h >= TH - 1) {
    return sharp(srcPath).resize(TW, TH, { fit: 'cover' })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }

  // Portrait sources (the chair, the truss) would lose their subject to a
  // crop, so they sit inside the frame over a blurred copy of themselves.
  // On a flat studio background that blur averages to grey bars, so a flat
  // border is detected first and padded with its own colour instead.
  const bw = Math.max(2, Math.round(m.width * 0.04));
  const bh = Math.max(2, Math.round(m.height * 0.04));
  const measure = async (box) =>
    sharp(await sharp(srcPath).extract(box).png().toBuffer()).stats();
  const strips = await Promise.all([
    measure({ left: 0, top: 0, width: m.width, height: bh }),
    measure({ left: 0, top: m.height - bh, width: m.width, height: bh }),
    measure({ left: 0, top: 0, width: bw, height: m.height }),
    measure({ left: m.width - bw, top: 0, width: bw, height: m.height }),
  ]);
  const flat = strips.every((st) => st.channels.slice(0, 3).every((c) => c.stdev < 26));

  if (flat) {
    const [r, g, b] = strips[0].channels.slice(0, 3).map((c) => Math.round(c.mean));
    return sharp(srcPath).resize(TW, TH, { fit: 'contain', background: { r, g, b } })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }
  const bg = await sharp(srcPath).resize(TW, TH, { fit: 'cover' })
    .blur(70).modulate({ brightness: 0.82 }).toBuffer();
  const fg = await sharp(srcPath).resize(w, h).toBuffer();
  return sharp(bg)
    .composite([{ input: fg, left: Math.floor((TW - w) / 2), top: Math.floor((TH - h) / 2) }])
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

async function main() {
  if (!SOURCE) {
    console.error('Set EQ_IMAGE_DIR to the folder holding the sourced files.');
    process.exit(1);
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  const now = new Date();
  const dir = path.join(UPLOAD_ROOT, String(now.getFullYear()),
                        String(now.getMonth() + 1).padStart(2, '0'));
  if (!DRY) fs.mkdirSync(dir, { recursive: true });

  let done = 0;
  for (const [slug, spec] of Object.entries(ITEMS)) {
    const srcPath = path.join(SOURCE, spec.file);
    if (!fs.existsSync(srcPath)) { console.warn(`skip ${slug} — missing ${spec.file}`); continue; }

    const [[eq] = []] = await db.query('SELECT id, name FROM equipment WHERE slug = ?', [slug]);
    if (!eq) { console.warn(`skip ${slug} — no such equipment row`); continue; }

    const buffer = await buildCover(srcPath);
    const meta = await sharp(buffer).metadata();
    const stamp = Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');
    const filename = `${stamp}.jpg`;
    const abs = path.join(dir, filename);
    const thumbAbs = path.join(dir, `thumb-${stamp}.webp`);

    if (!DRY) {
      fs.writeFileSync(abs, buffer);
      await sharp(buffer).resize(THUMB_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: 78 }).toFile(thumbAbs);
    }

    const url = (p) => '/uploads/' + path.relative(UPLOAD_ROOT, p).split(path.sep).join('/');

    if (!DRY) {
      // Drop a previous import for this item so re-running does not pile up
      // unused media rows.
      const [[prev] = []] = await db.query(
        'SELECT cover_media_id FROM equipment WHERE id = ?', [eq.id]);
      if (prev && prev.cover_media_id) {
        await db.execute('UPDATE media SET deleted_at = NOW() WHERE id = ?', [prev.cover_media_id]);
      }

      const [res] = await db.execute(
        `INSERT INTO media
           (folder_id, filename, original_name, mime_type, kind, extension, size_bytes,
            width, height, storage_path, public_url, thumb_url, title, alt_text,
            credit, is_public, checksum_sha256, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          EQUIPMENT_FOLDER, filename, spec.file, 'image/jpeg', 'image', 'jpg', buffer.length,
          meta.width, meta.height, abs, url(abs), url(thumbAbs), spec.title, spec.alt,
          spec.credit, 1, crypto.createHash('sha256').update(buffer).digest('hex'), UPLOADER_ID,
        ]
      );
      await db.execute('UPDATE equipment SET cover_media_id = ? WHERE id = ?', [res.insertId, eq.id]);
    }

    console.log(`${DRY ? 'dry ' : 'ok  '} ${slug.padEnd(20)} ${eq.name}`);
    done++;
  }

  console.log(`\n${DRY ? 'Would attach' : 'Attached'} ${done} image(s).`);
  await db.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
