/**
 * Seed the uploads volume from the copy committed to the repo.
 *
 * Railway's container filesystem is ephemeral, so uploads live on a mounted
 * volume (UPLOAD_DIR). The volume starts empty, while the repo carries the
 * media the seeded database already points at. This copies anything missing
 * from the repo onto the volume, so existing images resolve on a fresh
 * volume. Files already on the volume are never overwritten — uploads made
 * at runtime always win.
 *
 * A no-op when UPLOAD_DIR is unset or points at the repo directory itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoUploads = path.resolve(__dirname, '../uploads');
const target = process.env.UPLOAD_DIR;

if (!target || path.resolve(target) === repoUploads) {
  process.exit(0);
}
if (!fs.existsSync(repoUploads)) {
  console.log('[uploads] nothing to seed from the repo');
  process.exit(0);
}

let copied = 0;
let kept = 0;

function walk(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      walk(src, dest);
    } else if (fs.existsSync(dest)) {
      kept += 1;
    } else {
      fs.copyFileSync(src, dest);
      copied += 1;
    }
  }
}

try {
  walk(repoUploads, path.resolve(target));
  console.log(`[uploads] volume ready at ${target}: ${copied} copied, ${kept} already present`);
} catch (err) {
  // Never block boot over seeding: the app still serves and accepts uploads.
  console.error('[uploads] seeding failed:', err.message);
}
