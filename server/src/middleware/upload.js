import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { ApiError } from '../utils/helpers.js';

const ALLOWED = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    // Print artwork formats
    'application/postscript', 'application/illustrator', 'image/vnd.adobe.photoshop',
  ],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
};

const ALL_MIMES = Object.values(ALLOWED).flat();

export function mediaKind(mimeType) {
  for (const [kind, mimes] of Object.entries(ALLOWED)) {
    if (mimes.includes(mimeType)) return kind;
  }
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('audio/')) return 'audio';
  return 'other';
}

/** Files are stored under uploads/YYYY/MM to keep directories manageable. */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function currentUploadDir() {
  const now = new Date();
  const dir = path.join(
    config.uploads.dir,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0')
  );
  return ensureDir(dir);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, currentUploadDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    const stamp = Date.now().toString(36);
    const rand = crypto.randomBytes(6).toString('hex');
    cb(null, `${stamp}-${rand}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: config.uploads.maxFileSizeMb * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    if (ALL_MIMES.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(ApiError.badRequest(`File type not allowed: ${file.mimetype}`));
  },
});

/** Public URL for a stored file, relative to the uploads mount point. */
export function publicUrlFor(absolutePath) {
  const relative = path.relative(config.uploads.dir, absolutePath).split(path.sep).join('/');
  return `${config.uploads.publicPath}/${relative}`;
}

export function fileChecksum(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function deleteFileQuietly(absolutePath) {
  try {
    if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch (err) {
    console.warn('[upload] could not delete file:', err.message);
  }
}
