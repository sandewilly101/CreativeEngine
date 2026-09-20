/**
 * Import the reference photography into the media library.
 *
 *   node db/importMedia.js
 *
 * Imports the curated reference photography — only images that have a real
 * place in the platform, rather than everything that happened to exist.
 * Generates a thumbnail, writes a media row with a proper title and alt
 * text, and files it in a folder.
 * Safe to re-run: files are matched on their SHA-256 checksum, so an image
 * already imported is skipped rather than duplicated.
 */
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'creative_engine',
};

/**
 * What each photograph is, so the library is browsable and the alt text is
 * genuinely descriptive rather than a filename.
 */
const CATALOGUE = {
  'IMG-01-hero-studio.jpg': {
    title: 'Creative studio session',
    alt: 'A creative team reviewing printed work pinned to a studio wall in warm afternoon light',
    folder: 'Website',
  },
  'IMG-02-one-partner.jpg': {
    title: 'One partner, not five suppliers',
    alt: 'Two colleagues reviewing brand materials together at a shared desk',
    folder: 'Website',
  },
  'IMG-17-ai-channels.jpg': {
    title: 'AI across channels',
    alt: 'The same AI assistant answering on a laptop, a kiosk screen and a phone',
    folder: 'Website',
  },
  'IMG-19-creative.jpg': {
    title: 'Creative and marketing',
    alt: 'A designer working on brand identity at a colour-calibrated monitor',
    folder: 'Website',
  },
  'IMG-20-digital.jpg': {
    title: 'Web and digital',
    alt: 'A website wireframe and its responsive mobile layout side by side',
    folder: 'Website',
  },
  'IMG-21-ai.jpg': {
    title: 'AI business systems',
    alt: 'An AI assistant interface open on a laptop in a warm workspace',
    folder: 'Website',
  },
  'IMG-22-events.jpg': {
    title: 'Events and experiences',
    alt: 'A live event stage with LED screen and dramatic lighting',
    folder: 'Website',
  },
  'IMG-23-print.jpg': {
    title: 'Print and branding',
    alt: 'A wide-format printer running a vivid colour banner',
    folder: 'Website',
  },
  'IMG-24-equipment.jpg': {
    title: 'Equipment hire',
    alt: 'Staging, lighting and AV equipment prepared for an event',
    folder: 'Equipment',
  },
  'IMG-27-big-idea.jpg': {
    title: 'The big idea',
    alt: 'A creative direction session working through a campaign concept',
    folder: 'Website',
  },
  'payment-methods.png': {
    title: 'Payment methods',
    alt: 'You can pay by mobile money: M-Pesa, Mixx by Yas, Airtel Money, bank transfer or cash',
    folder: 'Brand Assets',
  },
  'IMG-28-studio-contact.jpg': {
    title: 'Our studio',
    alt: 'The Creative Engine studio space with the team at work',
    folder: 'Team',
  },
};

const THUMB_WIDTH = 480;

async function main() {
  const dir = path.resolve(__dirname, '../uploads/reference');
  if (!fs.existsSync(dir)) {
    console.error(`\n  No reference images found at ${dir}\n`);
    process.exit(1);
  }

  const db = await mysql.createConnection(DB);
  console.log('\n  Importing reference photography into the media library\n');

  // Make sure the folders exist and remember their ids.
  const folderIds = {};
  for (const name of ['Website', 'Client Work', 'Equipment', 'Team', 'Brand Assets']) {
    const [rows] = await db.query('SELECT id FROM media_folders WHERE name = ? LIMIT 1', [name]);
    if (rows.length) {
      folderIds[name] = rows[0].id;
    } else {
      const [res] = await db.query(
        'INSERT INTO media_folders (name, path) VALUES (?, ?)', [name, `/${name}`]
      );
      folderIds[name] = res.insertId;
    }
  }

  // File everything under this year/month so it sits with normal uploads.
  const now = new Date();
  const relDir = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  const destDir = path.resolve(__dirname, '../uploads', relDir);
  fs.mkdirSync(destDir, { recursive: true });

  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const sourcePath = path.join(dir, file);
    const buffer = fs.readFileSync(sourcePath);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const [existing] = await db.query(
      'SELECT id FROM media WHERE checksum_sha256 = ? AND deleted_at IS NULL LIMIT 1',
      [checksum]
    );
    if (existing.length) {
      skipped += 1;
      continue;
    }

    const meta = CATALOGUE[file] || {
      title: file.replace(/^IMG-\d+-/, '').replace(/\.[^.]+$/, '').replace(/-/g, ' '),
      alt: null,
      folder: 'Website',
    };

    // Copy in under a collision-proof name, matching the upload middleware.
    const ext = path.extname(file).toLowerCase();
    const stamp = Date.now().toString(36);
    const rand = crypto.randomBytes(6).toString('hex');
    const storedName = `${stamp}-${rand}${ext}`;
    const storedPath = path.join(destDir, storedName);
    fs.writeFileSync(storedPath, buffer);

    const image = sharp(buffer);
    const { width, height } = await image.metadata();

    // Thumbnail, same settings the API uses.
    let thumbUrl = null;
    try {
      const thumbName = `thumb-${storedName.replace(/\.[^.]+$/, '')}.webp`;
      await sharp(buffer)
        .rotate()
        .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(destDir, thumbName));
      thumbUrl = `/uploads/${relDir.replace(/\\/g, '/')}/${thumbName}`;
    } catch (err) {
      console.warn(`    thumbnail failed for ${file}: ${err.message}`);
    }

    await db.query(
      `INSERT INTO media
         (folder_id, filename, original_name, mime_type, kind, extension, size_bytes,
          width, height, storage_path, public_url, thumb_url, title, alt_text,
          is_public, checksum_sha256)
       VALUES (?,?,?,?,'image',?,?,?,?,?,?,?,?,?,1,?)`,
      [
        folderIds[meta.folder] ?? null,
        storedName,
        file,
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
        ext.slice(1),
        buffer.length,
        width ?? null,
        height ?? null,
        storedPath,
        `/uploads/${relDir.replace(/\\/g, '/')}/${storedName}`,
        thumbUrl,
        meta.title,
        meta.alt,
        checksum,
      ]
    );

    console.log(`    ${meta.title}  (${width}x${height})`);
    imported += 1;
  }

  console.log(`\n  ${imported} imported, ${skipped} already present\n`);

  // Attach the division hero images so the site has real photography on it.
  const DIVISION_IMAGES = {
    'creative-marketing': 'IMG-19-creative.jpg',
    'web-digital': 'IMG-20-digital.jpg',
    'ai-business-systems': 'IMG-21-ai.jpg',
    'events-experiences': 'IMG-22-events.jpg',
    'print-production': 'IMG-23-print.jpg',
  };

  for (const [slug, original] of Object.entries(DIVISION_IMAGES)) {
    const [m] = await db.query(
      'SELECT id FROM media WHERE original_name = ? AND deleted_at IS NULL LIMIT 1', [original]
    );
    if (m.length) {
      await db.query('UPDATE divisions SET hero_media_id = ? WHERE slug = ?', [m[0].id, slug]);
    }
  }
  console.log('  Division hero images attached');

  await db.end();
  console.log('  Done.\n');
}

main().catch((err) => {
  console.error('\n  Import failed:', err.message, '\n');
  process.exit(1);
});
