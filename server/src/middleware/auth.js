import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import { ApiError, asyncHandler } from '../utils/helpers.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role_slug, org: user.organisation_id ?? null },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
}

/** Load the user plus their effective permission set. */
async function loadUser(userId) {
  const user = await queryOne(
    `SELECT u.*, r.slug AS role_slug, r.name AS role_name, o.name AS organisation_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
  LEFT JOIN organisations o ON o.id = u.organisation_id
      WHERE u.id = ? AND u.deleted_at IS NULL AND u.is_active = 1`,
    [userId]
  );
  if (!user) return null;

  const rows = await query(
    `SELECT p.slug,
            COALESCE(up.effect, 'allow') AS effect,
            (up.user_id IS NOT NULL)     AS is_override
       FROM permissions p
  LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ?
  LEFT JOIN user_permissions up ON up.permission_id = p.id AND up.user_id = ?
      WHERE rp.role_id IS NOT NULL OR up.user_id IS NOT NULL`,
    [user.role_id, user.id]
  );

  const permissions = new Set();
  for (const row of rows) {
    if (row.effect === 'deny') permissions.delete(row.slug);
    else permissions.add(row.slug);
  }

  delete user.password_hash;
  delete user.reset_token;
  return { ...user, permissions: [...permissions] };
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.access_token || null;
}

/** Require a valid token. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  const user = await loadUser(payload.sub);
  if (!user) throw ApiError.unauthorized('Account is inactive');

  req.user = user;
  next();
});

/** Attach the user when a token is present, but allow anonymous access. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      req.user = await loadUser(payload.sub);
    } catch {
      req.user = null;
    }
  }
  next();
});

/** Require one of the given role slugs. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role_slug)) return next(ApiError.forbidden());
  next();
};

/** Require a specific permission. Admins bypass the check. */
export const requirePermission = (...slugs) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role_slug === 'admin') return next();
  const ok = slugs.some((slug) => req.user.permissions.includes(slug));
  if (!ok) return next(ApiError.forbidden(`Missing permission: ${slugs.join(' or ')}`));
  next();
};

/**
 * Restrict clients to their own organisation's records.
 * Adds req.orgScope, which resource queries apply as a WHERE clause.
 */
export const scopeToOrganisation = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  req.orgScope = req.user.role_slug === 'client' ? req.user.organisation_id : null;
  if (req.user.role_slug === 'client' && !req.user.organisation_id) {
    return next(ApiError.forbidden('Your account is not linked to an organisation'));
  }
  next();
};
