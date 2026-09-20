import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query, queryOne, execute } from '../config/db.js';
import { config } from '../config/env.js';
import { signAccessToken, authenticate } from '../middleware/auth.js';
import { logActivity } from '../services/activityLog.js';
import { ApiError, asyncHandler, randomToken, sha256, addDays, toMysqlDateTime } from '../utils/helpers.js';

const router = express.Router();

// Brute-force protection on credential endpoints.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

async function fullUser(id) {
  const user = await queryOne(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.job_title, u.division,
            u.organisation_id, u.display_currency, u.locale, u.timezone, u.avatar_media_id,
            u.must_change_password, u.last_login_at,
            r.slug AS role_slug, r.name AS role_name,
            o.name AS organisation_name, o.logo_media_id AS organisation_logo_id,
            m.public_url AS avatar_url
       FROM users u
       JOIN roles r ON r.id = u.role_id
  LEFT JOIN organisations o ON o.id = u.organisation_id
  LEFT JOIN media m ON m.id = u.avatar_media_id
      WHERE u.id = ?`,
    [id]
  );
  if (!user) return null;

  const perms = await query(
    `SELECT p.slug, COALESCE(up.effect, 'allow') AS effect
       FROM permissions p
  LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = (SELECT role_id FROM users WHERE id = ?)
  LEFT JOIN user_permissions up ON up.permission_id = p.id AND up.user_id = ?
      WHERE rp.role_id IS NOT NULL OR up.user_id IS NOT NULL`,
    [id, id]
  );
  const set = new Set();
  for (const p of perms) {
    if (p.effect === 'deny') set.delete(p.slug);
    else set.add(p.slug);
  }
  return { ...user, permissions: [...set] };
}

// ------------------------------------------------------------------ LOGIN
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw ApiError.badRequest('Email and password are required');

  const user = await queryOne(
    `SELECT u.*, r.slug AS role_slug FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.email = ? AND u.deleted_at IS NULL`,
    [String(email).toLowerCase().trim()]
  );

  // Same message whether the account exists or not.
  const genericFailure = ApiError.unauthorized('Email or password is incorrect');
  if (!user) throw genericFailure;

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new ApiError(423, `Account locked. Try again in ${mins} minute(s).`);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const failed = user.failed_login_count + 1;
    const lock = failed >= MAX_FAILED
      ? toMysqlDateTime(new Date(Date.now() + LOCK_MINUTES * 60000))
      : null;
    await execute(
      'UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?',
      [failed, lock, user.id]
    );
    if (lock) throw new ApiError(423, `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`);
    throw genericFailure;
  }

  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated');

  await execute(
    'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
    [user.id]
  );

  const accessToken = signAccessToken({ ...user, role_slug: user.role_slug });
  const refreshRaw = randomToken(32);
  await execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      user.id,
      sha256(refreshRaw),
      req.headers['user-agent']?.slice(0, 255) ?? null,
      req.ip?.slice(0, 45) ?? null,
      toMysqlDateTime(addDays(new Date(), config.jwt.refreshExpiryDays)),
    ]
  );

  await logActivity(req, 'login', 'users', user.id, user.email);

  res.json({
    accessToken,
    refreshToken: refreshRaw,
    user: await fullUser(user.id),
  });
}));

// ---------------------------------------------------------------- REFRESH
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('Refresh token required');

  const row = await queryOne(
    `SELECT rt.*, u.id AS uid, r.slug AS role_slug, u.organisation_id
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > NOW()
        AND u.is_active = 1 AND u.deleted_at IS NULL`,
    [sha256(refreshToken)]
  );
  if (!row) throw ApiError.unauthorized('Session expired, please sign in again');

  const accessToken = signAccessToken({
    id: row.uid, role_slug: row.role_slug, organisation_id: row.organisation_id,
  });
  res.json({ accessToken, user: await fullUser(row.uid) });
}));

// ----------------------------------------------------------------- LOGOUT
router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await execute(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?',
      [sha256(refreshToken)]
    );
  }
  res.json({ message: 'Signed out' });
}));

// ------------------------------------------------------------------- ME
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: await fullUser(req.user.id) });
}));

router.patch('/me', authenticate, asyncHandler(async (req, res) => {
  const allowed = ['first_name', 'last_name', 'phone', 'job_title', 'locale', 'timezone', 'display_currency', 'avatar_media_id'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');

  const clause = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
  await execute(`UPDATE users SET ${clause} WHERE id = ?`, [...Object.values(updates), req.user.id]);
  await logActivity(req, 'updated', 'users', req.user.id, req.user.email, { after: updates });

  res.json({ user: await fullUser(req.user.id), message: 'Profile updated' });
}));

// -------------------------------------------------------- CHANGE PASSWORD
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }

  const user = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  const valid = await bcrypt.compare(currentPassword || '', user.password_hash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');

  await execute(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [await bcrypt.hash(newPassword, 12), req.user.id]
  );
  // Force other sessions to re-authenticate.
  await execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [req.user.id]
  );
  await logActivity(req, 'password_changed', 'users', req.user.id, req.user.email);

  res.json({ message: 'Password changed. Other sessions have been signed out.' });
}));

// --------------------------------------------------------- FORGOT / RESET
router.post('/forgot-password', loginLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await queryOne(
    'SELECT id, email, first_name FROM users WHERE email = ? AND deleted_at IS NULL',
    [String(email || '').toLowerCase().trim()]
  );

  // Always the same response, so the endpoint cannot enumerate accounts.
  const response = { message: 'If that email is registered, a reset link has been sent.' };
  if (!user) return res.json(response);

  const token = randomToken(32);
  await execute(
    'UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?',
    [sha256(token), toMysqlDateTime(new Date(Date.now() + 3600000)), user.id]
  );

  // Wire this to your mail provider; logged in development so the flow is testable.
  const link = `${config.clientUrl}/reset-password?token=${token}`;
  if (config.env !== 'production') console.log(`[auth] password reset link for ${user.email}: ${link}`);

  res.json(response);
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) throw ApiError.badRequest('Token and new password are required');
  if (newPassword.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

  const user = await queryOne(
    'SELECT id, email FROM users WHERE reset_token = ? AND reset_expires_at > NOW() AND deleted_at IS NULL',
    [sha256(token)]
  );
  if (!user) throw ApiError.badRequest('That reset link is invalid or has expired');

  await execute(
    `UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL,
            failed_login_count = 0, locked_until = NULL, must_change_password = 0
      WHERE id = ?`,
    [await bcrypt.hash(newPassword, 12), user.id]
  );
  await execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?', [user.id]);
  await logActivity(req, 'password_reset', 'users', user.id, user.email);

  res.json({ message: 'Password reset. You can now sign in.' });
}));

// ------------------------------------------------------- SESSION LISTING
router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
  const sessions = await query(
    `SELECT id, user_agent, ip_address, created_at, expires_at
       FROM refresh_tokens
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ data: sessions });
}));

router.delete('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
  await execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Session revoked' });
}));

export default router;
