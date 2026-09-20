import express from 'express';
import rateLimit from 'express-rate-limit';
import { query, queryOne, execute, transaction } from '../config/db.js';
import { getRates } from '../services/fxService.js';
import { resolveSlots } from '../services/mediaSlots.js';
import { notifyByPermission } from '../services/notifications.js';
import { ApiError, asyncHandler, generateReference, parseJsonRows, parseJsonFields, randomToken } from '../utils/helpers.js';

/**
 * Everything the public marketing site reads, plus the forms it writes.
 * No authentication — but only published rows are ever returned, and the
 * write endpoints are rate limited.
 */
const router = express.Router();

const formLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { error: 'Too many submissions. Please try again shortly.' },
});

// ---------------------------------------------------------- SITE SETTINGS
router.get('/settings', asyncHandler(async (_req, res) => {
  const rows = await query(
    'SELECT group_key, setting_key, setting_value, value_type FROM settings WHERE is_public = 1'
  );
  const grouped = {};
  for (const row of rows) {
    grouped[row.group_key] ??= {};
    let value = row.setting_value;
    if (row.value_type === 'number') value = Number(value);
    else if (row.value_type === 'boolean') value = value === 'true' || value === '1';
    else if (row.value_type === 'json') { try { value = JSON.parse(value); } catch { value = null; } }
    grouped[row.group_key][row.setting_key] = value;
  }
  res.json({ data: grouped });
}));

/**
 * Image slots — fixed positions on the site that resolve to whatever has been
 * uploaded under a reserved `ce-slot-*` filename, falling back to the shipped
 * photography.
 */
router.get('/slots', asyncHandler(async (_req, res) => {
  res.json({ data: await resolveSlots() });
}));

router.get('/menu', asyncHandler(async (_req, res) => {
  const items = await query(
    'SELECT id, menu_key, parent_id, label, url, icon, target, sort_order FROM menu_items WHERE is_active = 1 ORDER BY menu_key, sort_order'
  );
  const grouped = {};
  for (const item of items) {
    grouped[item.menu_key] ??= [];
    grouped[item.menu_key].push(item);
  }
  res.json({ data: grouped });
}));

// ------------------------------------------------------------- CURRENCIES
router.get('/rates', asyncHandler(async (_req, res) => {
  const rates = await getRates();
  res.json({ data: { base: 'TZS', rates, updated: new Date().toISOString() } });
}));

// -------------------------------------------------------------- DIVISIONS
router.get('/divisions', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT d.*, m.public_url AS hero_url,
            (SELECT COUNT(*) FROM services s WHERE s.division_id = d.id AND s.status = 'published' AND s.deleted_at IS NULL) AS service_count
       FROM divisions d
  LEFT JOIN media m ON m.id = d.hero_media_id
      WHERE d.is_active = 1 AND d.deleted_at IS NULL
      ORDER BY d.sort_order`
  );
  res.json({ data: rows });
}));

router.get('/divisions/:slug', asyncHandler(async (req, res) => {
  const division = await queryOne(
    `SELECT d.*, m.public_url AS hero_url FROM divisions d
  LEFT JOIN media m ON m.id = d.hero_media_id
     WHERE d.slug = ? AND d.is_active = 1 AND d.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!division) throw ApiError.notFound('Division not found');

  const services = await query(
    `SELECT s.*, m.public_url AS hero_url FROM services s
  LEFT JOIN media m ON m.id = s.hero_media_id
     WHERE s.division_id = ? AND s.status = 'published' AND s.deleted_at IS NULL
     ORDER BY s.sort_order, s.name`,
    [division.id]
  );

  const work = await query(
    `SELECT p.id, p.slug, p.title, p.client_name, p.summary, m.public_url AS cover_url
       FROM portfolio_items p
  LEFT JOIN media m ON m.id = p.cover_media_id
      WHERE p.division_id = ? AND p.status = 'published' AND p.deleted_at IS NULL
      ORDER BY p.is_featured DESC, p.sort_order LIMIT 6`,
    [division.id]
  );

  res.json({
    data: {
      ...division,
      services: parseJsonRows(services, ['deliverables', 'inclusions', 'exclusions']),
      work,
    },
  });
}));

// ---------------------------------------------------------------- SERVICES
router.get('/services', asyncHandler(async (req, res) => {
  const where = ["s.status = 'published'", 's.deleted_at IS NULL'];
  const params = [];
  if (req.query.division) { where.push('d.slug = ?'); params.push(req.query.division); }
  if (req.query.featured === 'true') where.push('s.is_featured = 1');

  const rows = await query(
    `SELECT s.*, d.name AS division_name, d.slug AS division_slug, d.color_hex AS division_color,
            m.public_url AS hero_url
       FROM services s
       JOIN divisions d ON d.id = s.division_id
  LEFT JOIN media m ON m.id = s.hero_media_id
      WHERE ${where.join(' AND ')}
      ORDER BY s.is_featured DESC, s.sort_order, s.name`,
    params
  );
  res.json({ data: parseJsonRows(rows, ['deliverables', 'inclusions', 'exclusions']) });
}));

router.get('/services/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT s.*, d.name AS division_name, d.slug AS division_slug, d.color_hex AS division_color,
            m.public_url AS hero_url
       FROM services s
       JOIN divisions d ON d.id = s.division_id
  LEFT JOIN media m ON m.id = s.hero_media_id
      WHERE s.slug = ? AND s.status = 'published' AND s.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Service not found');

  const related = await query(
    `SELECT slug, name, short_description FROM services
      WHERE division_id = ? AND id != ? AND status = 'published' AND deleted_at IS NULL
      ORDER BY sort_order LIMIT 4`,
    [row.division_id, row.id]
  );
  const faqs = await query(
    'SELECT question, answer FROM faqs WHERE (division_id = ? OR division_id IS NULL) AND is_published = 1 ORDER BY sort_order LIMIT 8',
    [row.division_id]
  );

  res.json({ data: { ...parseJsonFields(row, ['deliverables', 'inclusions', 'exclusions']), related, faqs } });
}));

// ---------------------------------------------------------------- PACKAGES
router.get('/packages', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT p.*, d.name AS division_name, m.public_url AS hero_url
       FROM packages p
  LEFT JOIN divisions d ON d.id = p.division_id
  LEFT JOIN media m ON m.id = p.hero_media_id
      WHERE p.status = 'published' AND p.deleted_at IS NULL
      ORDER BY p.sort_order`
  );
  res.json({ data: parseJsonRows(rows, ['features']) });
}));

router.get('/packages/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT p.*, d.name AS division_name, m.public_url AS hero_url
       FROM packages p
  LEFT JOIN divisions d ON d.id = p.division_id
  LEFT JOIN media m ON m.id = p.hero_media_id
      WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Package not found');

  const services = await query(
    `SELECT s.slug, s.name, s.short_description, ps.quantity
       FROM package_services ps JOIN services s ON s.id = ps.service_id
      WHERE ps.package_id = ?`,
    [row.id]
  );
  res.json({ data: { ...parseJsonFields(row, ['features']), services } });
}));

// --------------------------------------------------------------- PORTFOLIO
router.get('/work', asyncHandler(async (req, res) => {
  const where = ["p.status = 'published'", 'p.deleted_at IS NULL'];
  const params = [];
  if (req.query.division) { where.push('d.slug = ?'); params.push(req.query.division); }
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 24);

  const rows = await query(
    `SELECT p.id, p.slug, p.title, p.client_name, p.summary, p.project_date, p.location,
            p.is_featured, p.metrics, d.name AS division_name, d.slug AS division_slug,
            d.color_hex AS division_color, m.public_url AS cover_url, m.thumb_url AS cover_thumb
       FROM portfolio_items p
  LEFT JOIN divisions d ON d.id = p.division_id
  LEFT JOIN media m ON m.id = p.cover_media_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.is_featured DESC, p.sort_order, p.project_date DESC
      LIMIT ${limit}`,
    params
  );
  res.json({ data: parseJsonRows(rows, ['metrics']) });
}));

router.get('/work/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT p.*, d.name AS division_name, d.slug AS division_slug, d.color_hex AS division_color,
            m.public_url AS cover_url
       FROM portfolio_items p
  LEFT JOIN divisions d ON d.id = p.division_id
  LEFT JOIN media m ON m.id = p.cover_media_id
      WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Case study not found');

  await execute('UPDATE portfolio_items SET view_count = view_count + 1 WHERE id = ?', [row.id]);
  const parsed = parseJsonFields(row, ['metrics', 'services_used', 'gallery']);

  // Resolve gallery media ids into usable urls.
  if (Array.isArray(parsed.gallery) && parsed.gallery.length) {
    const ids = parsed.gallery.map(Number).filter(Boolean);
    if (ids.length) {
      parsed.gallery_media = await query(
        `SELECT id, public_url, thumb_url, alt_text, caption FROM media WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }
  }

  const testimonial = await queryOne(
    "SELECT author_name, author_title, company, quote, rating FROM testimonials WHERE portfolio_item_id = ? AND status = 'published' LIMIT 1",
    [row.id]
  );

  res.json({ data: { ...parsed, testimonial } });
}));

// -------------------------------------------------------------------- BLOG
router.get('/posts', asyncHandler(async (req, res) => {
  const where = ["p.status = 'published'", 'p.deleted_at IS NULL', 'p.published_at <= NOW()'];
  const params = [];
  if (req.query.category) { where.push('c.slug = ?'); params.push(req.query.category); }
  if (req.query.search) {
    where.push('(p.title LIKE ? OR p.excerpt LIKE ?)');
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
  const offset = ((parseInt(req.query.page, 10) || 1) - 1) * limit;

  const rows = await query(
    `SELECT p.id, p.slug, p.title, p.excerpt, p.published_at, p.reading_minutes, p.tags,
            c.name AS category_name, c.slug AS category_slug, c.color_hex AS category_color,
            m.public_url AS cover_url, m.thumb_url AS cover_thumb,
            CONCAT(u.first_name, ' ', u.last_name) AS author_name
       FROM posts p
  LEFT JOIN post_categories c ON c.id = p.category_id
  LEFT JOIN media m ON m.id = p.cover_media_id
  LEFT JOIN users u ON u.id = p.author_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.is_featured DESC, p.published_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM posts p LEFT JOIN post_categories c ON c.id = p.category_id WHERE ${where.join(' AND ')}`,
    params
  );
  res.json({ data: parseJsonRows(rows, ['tags']), total: Number(countRow.total) });
}));

router.get('/posts/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            m.public_url AS cover_url, CONCAT(u.first_name,' ',u.last_name) AS author_name,
            u.job_title AS author_title
       FROM posts p
  LEFT JOIN post_categories c ON c.id = p.category_id
  LEFT JOIN media m ON m.id = p.cover_media_id
  LEFT JOIN users u ON u.id = p.author_id
      WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Article not found');
  await execute('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [row.id]);

  const related = await query(
    `SELECT slug, title, excerpt FROM posts
      WHERE category_id <=> ? AND id != ? AND status = 'published' AND deleted_at IS NULL
      ORDER BY published_at DESC LIMIT 3`,
    [row.category_id, row.id]
  );
  res.json({ data: { ...parseJsonFields(row, ['tags']), related } });
}));

router.get('/post-categories', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM posts WHERE category_id = c.id AND status='published' AND deleted_at IS NULL) AS post_count
       FROM post_categories c ORDER BY c.sort_order`
  );
  res.json({ data: rows });
}));

// --------------------------------------------------------------- EQUIPMENT
router.get('/equipment', asyncHandler(async (req, res) => {
  const where = ['e.is_published = 1', "e.status = 'available'", 'e.deleted_at IS NULL'];
  const params = [];
  if (req.query.category) { where.push('c.slug = ?'); params.push(req.query.category); }
  if (req.query.search) { where.push('(e.name LIKE ? OR e.description LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }

  const rows = await query(
    `SELECT e.id, e.slug, e.sku, e.name, e.description, e.daily_rate_cents, e.half_day_rate_cents,
            e.weekly_rate_cents, e.unit_of_measure, e.deposit_cents, e.total_units,
            e.requires_operator, e.min_rental_days, e.specifications, e.is_featured,
            c.name AS category_name, c.slug AS category_slug,
            m.public_url AS cover_url, m.thumb_url AS cover_thumb
       FROM equipment e
  LEFT JOIN equipment_categories c ON c.id = e.category_id
  LEFT JOIN media m ON m.id = e.cover_media_id
      WHERE ${where.join(' AND ')}
      ORDER BY e.is_featured DESC, e.name`,
    params
  );
  res.json({ data: parseJsonRows(rows, ['specifications', 'gallery']) });
}));

router.get('/equipment/categories', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM equipment WHERE category_id = c.id AND is_published = 1 AND deleted_at IS NULL) AS item_count
       FROM equipment_categories c WHERE c.is_published = 1 ORDER BY c.sort_order`
  );
  res.json({ data: rows });
}));

router.get('/equipment/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT e.*, c.name AS category_name, c.slug AS category_slug, m.public_url AS cover_url
       FROM equipment e
  LEFT JOIN equipment_categories c ON c.id = e.category_id
  LEFT JOIN media m ON m.id = e.cover_media_id
      WHERE e.slug = ? AND e.is_published = 1 AND e.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Equipment not found');
  res.json({ data: parseJsonFields(row, ['specifications', 'gallery']) });
}));

/** Availability check: how many units are free across a date range. */
router.get('/equipment/:id/availability', asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) throw ApiError.badRequest('start and end dates are required');

  const item = await queryOne(
    'SELECT id, name, total_units FROM equipment WHERE id = ? AND deleted_at IS NULL',
    [req.params.id]
  );
  if (!item) throw ApiError.notFound('Equipment not found');

  // Overlap test: an existing booking conflicts when it starts before our end
  // and ends after our start. Setup/teardown windows extend the block.
  const booked = await queryOne(
    `SELECT COALESCE(SUM(bi.quantity), 0) AS qty
       FROM booking_items bi
       JOIN bookings b ON b.id = bi.booking_id
      WHERE bi.equipment_id = ?
        AND b.status IN ('confirmed','dispatched','on_hire')
        AND b.deleted_at IS NULL
        AND COALESCE(b.setup_date, b.start_date) < ?
        AND COALESCE(b.teardown_date, b.end_date) > ?`,
    [req.params.id, end, start]
  );

  const inMaintenance = await queryOne(
    `SELECT COUNT(*) AS units FROM equipment_maintenance
      WHERE equipment_id = ? AND status IN ('scheduled','in_progress')
        AND start_date < ? AND end_date > ?`,
    [req.params.id, end, start]
  );

  const available = Math.max(0, item.total_units - Number(booked.qty) - Number(inMaintenance.units));
  res.json({
    data: {
      equipment_id: item.id,
      name: item.name,
      total_units: item.total_units,
      booked: Number(booked.qty),
      in_maintenance: Number(inMaintenance.units),
      available,
      is_available: available > 0,
    },
  });
}));

// ------------------------------------------------------------ PRINT SHOP
router.get('/print-products', asyncHandler(async (req, res) => {
  const where = ['is_published = 1', 'deleted_at IS NULL'];
  const params = [];
  if (req.query.category) { where.push('category = ?'); params.push(req.query.category); }

  const rows = await query(
    `SELECT p.*, m.public_url AS cover_url, m.thumb_url AS cover_thumb
       FROM print_products p LEFT JOIN media m ON m.id = p.cover_media_id
      WHERE ${where.map((w) => `p.${w.includes('.') ? w : w}`).join(' AND ')}
      ORDER BY p.is_featured DESC, p.sort_order`,
    params
  );
  res.json({ data: parseJsonRows(rows, ['substrates', 'finishing_options', 'size_presets', 'gallery']) });
}));

router.get('/print-products/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT p.*, m.public_url AS cover_url FROM print_products p
  LEFT JOIN media m ON m.id = p.cover_media_id
     WHERE p.slug = ? AND p.is_published = 1 AND p.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Product not found');
  res.json({ data: parseJsonFields(row, ['substrates', 'finishing_options', 'size_presets', 'gallery']) });
}));

// ------------------------------------------------------------------ PAGES
router.get('/pages/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT p.*, m.public_url AS hero_url FROM pages p
  LEFT JOIN media m ON m.id = p.hero_media_id
     WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Page not found');
  res.json({ data: parseJsonFields(row, ['blocks']) });
}));

// ---------------------------------------------------- TEAM / SOCIAL PROOF
router.get('/team', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT t.*, m.public_url AS photo_url, d.name AS division_name
       FROM team_members t
  LEFT JOIN media m ON m.id = t.photo_media_id
  LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.is_published = 1 AND t.deleted_at IS NULL ORDER BY t.sort_order`
  );
  res.json({ data: rows });
}));

router.get('/testimonials', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT t.*, mp.public_url AS photo_url, ml.public_url AS logo_url
       FROM testimonials t
  LEFT JOIN media mp ON mp.id = t.photo_media_id
  LEFT JOIN media ml ON ml.id = t.logo_media_id
      WHERE t.status = 'published' AND t.deleted_at IS NULL
      ORDER BY t.is_featured DESC, t.sort_order`
  );
  res.json({ data: rows });
}));

router.get('/clients', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT c.name, c.website_url, m.public_url AS logo_url
       FROM client_logos c LEFT JOIN media m ON m.id = c.logo_media_id
      WHERE c.is_published = 1 ORDER BY c.sort_order`
  );
  res.json({ data: rows });
}));

router.get('/faqs', asyncHandler(async (req, res) => {
  const where = ['is_published = 1'];
  const params = [];
  if (req.query.category) { where.push('category = ?'); params.push(req.query.category); }
  const rows = await query(
    `SELECT id, question, answer, category FROM faqs WHERE ${where.join(' AND ')} ORDER BY sort_order`,
    params
  );
  res.json({ data: rows });
}));

// -------------------------------------------------------------- HOMEPAGE
/** One call that returns everything the landing page needs. */
router.get('/homepage', asyncHandler(async (_req, res) => {
  const [divisions, featuredServices, featuredWork, packages, testimonials, clients, posts] = await Promise.all([
    query(`SELECT id, slug, code, name, tagline, description, icon, color_hex FROM divisions
            WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order`),
    query(`SELECT s.slug, s.name, s.short_description, s.base_price_cents, s.pricing_model,
                  d.slug AS division_slug, d.color_hex AS division_color, m.public_url AS hero_url
             FROM services s JOIN divisions d ON d.id = s.division_id
        LEFT JOIN media m ON m.id = s.hero_media_id
            WHERE s.is_featured = 1 AND s.status='published' AND s.deleted_at IS NULL
            ORDER BY s.sort_order LIMIT 6`),
    query(`SELECT p.slug, p.title, p.client_name, p.summary, d.name AS division_name,
                  d.color_hex AS division_color, m.public_url AS cover_url, m.thumb_url AS cover_thumb
             FROM portfolio_items p
        LEFT JOIN divisions d ON d.id = p.division_id
        LEFT JOIN media m ON m.id = p.cover_media_id
            WHERE p.status='published' AND p.deleted_at IS NULL
            ORDER BY p.is_featured DESC, p.sort_order LIMIT 6`),
    query(`SELECT slug, name, tagline, price_cents, billing_interval, tier, features, capacity_note, is_featured
             FROM packages WHERE status='published' AND deleted_at IS NULL ORDER BY sort_order LIMIT 4`),
    query(`SELECT t.author_name, t.author_title, t.company, t.quote, t.rating, m.public_url AS photo_url
             FROM testimonials t LEFT JOIN media m ON m.id = t.photo_media_id
            WHERE t.status='published' AND t.deleted_at IS NULL
            ORDER BY t.is_featured DESC, t.sort_order LIMIT 6`),
    query(`SELECT c.name, c.website_url, m.public_url AS logo_url
             FROM client_logos c LEFT JOIN media m ON m.id = c.logo_media_id
            WHERE c.is_published = 1 ORDER BY c.sort_order LIMIT 12`),
    query(`SELECT p.slug, p.title, p.excerpt, p.published_at, c.name AS category_name,
                  m.thumb_url AS cover_thumb, m.public_url AS cover_url
             FROM posts p LEFT JOIN post_categories c ON c.id = p.category_id
        LEFT JOIN media m ON m.id = p.cover_media_id
            WHERE p.status='published' AND p.deleted_at IS NULL AND p.published_at <= NOW()
            ORDER BY p.published_at DESC LIMIT 3`),
  ]);

  res.json({
    data: {
      divisions,
      featured_services: featuredServices,
      featured_work: featuredWork,
      packages: parseJsonRows(packages, ['features']),
      testimonials,
      clients,
      posts,
    },
  });
}));

// ------------------------------------------------------------------ FORMS
router.post('/contact', formLimiter, asyncHandler(async (req, res) => {
  const { name, email, phone, company, message, service_id, division_id, budget_range, source = 'website' } = req.body;
  if (!name?.trim() || !message?.trim()) throw ApiError.badRequest('Name and message are required');
  if (!email && !phone) throw ApiError.badRequest('Please provide an email address or phone number');

  const lead = await transaction(async (tx) => {
    const reference = await generateReference('lead', tx);
    const result = await tx.execute(
      `INSERT INTO leads
         (reference, contact_name, company_name, email, phone, message, service_id, division_id,
          budget_range, source, ip_address, user_agent, utm_source, utm_medium, utm_campaign)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reference, name.trim(), company || null, email || null, phone || null, message.trim(),
        service_id || null, division_id || null, budget_range || null, source,
        req.ip?.slice(0, 45) ?? null, req.headers['user-agent']?.slice(0, 255) ?? null,
        req.body.utm_source || null, req.body.utm_medium || null, req.body.utm_campaign || null,
      ]
    );
    await tx.execute(
      'INSERT INTO form_submissions (form_key, payload, lead_id, ip_address) VALUES (?,?,?,?)',
      ['contact', JSON.stringify(req.body), result.insertId, req.ip?.slice(0, 45) ?? null]
    );
    return { id: result.insertId, reference };
  });

  await notifyByPermission('leads.view', {
    type: 'lead.new',
    title: `New enquiry from ${name}`,
    body: message.slice(0, 160),
    linkUrl: `/admin/leads/${lead.id}`,
    entityType: 'leads',
    entityId: lead.id,
    icon: 'inbox',
  });

  res.status(201).json({
    message: 'Thank you. We have received your enquiry and will be in touch shortly.',
    reference: lead.reference,
  });
}));

router.post('/newsletter', formLimiter, asyncHandler(async (req, res) => {
  const { email, name } = req.body;
  if (!email?.includes('@')) throw ApiError.badRequest('A valid email address is required');
  await execute(
    `INSERT INTO newsletter_subscribers (email, name, confirm_token, status)
     VALUES (?, ?, ?, 'subscribed')
     ON DUPLICATE KEY UPDATE status = 'subscribed', unsubscribed_at = NULL`,
    [email.toLowerCase().trim(), name || null, randomToken(24)]
  );
  res.status(201).json({ message: 'You are subscribed. Thank you.' });
}));

router.post('/newsletter/unsubscribe', asyncHandler(async (req, res) => {
  const { email } = req.body;
  await execute(
    "UPDATE newsletter_subscribers SET status='unsubscribed', unsubscribed_at=NOW() WHERE email = ?",
    [String(email || '').toLowerCase().trim()]
  );
  res.json({ message: 'You have been unsubscribed.' });
}));

// ------------------------------------------------------ EVENT REGISTRATION
router.get('/events/:slug', asyncHandler(async (req, res) => {
  const row = await queryOne(
    `SELECT e.id, e.slug, e.name, e.type, e.description, e.venue, e.venue_address, e.city,
            e.start_datetime, e.end_datetime, e.capacity, e.is_ticketed, e.ticket_price_cents,
            e.registration_open, e.registration_closes_at, m.public_url AS cover_url,
            (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status != 'cancelled') AS registered_count
       FROM events e LEFT JOIN media m ON m.id = e.cover_media_id
      WHERE e.slug = ? AND e.is_public = 1 AND e.deleted_at IS NULL`,
    [req.params.slug]
  );
  if (!row) throw ApiError.notFound('Event not found');
  res.json({ data: row });
}));

router.post('/events/:slug/register', formLimiter, asyncHandler(async (req, res) => {
  const event = await queryOne(
    "SELECT * FROM events WHERE slug = ? AND is_public = 1 AND deleted_at IS NULL",
    [req.params.slug]
  );
  if (!event) throw ApiError.notFound('Event not found');
  if (!event.registration_open) throw ApiError.badRequest('Registration is closed for this event');
  if (event.registration_closes_at && new Date(event.registration_closes_at) < new Date()) {
    throw ApiError.badRequest('Registration has closed for this event');
  }

  const { full_name, email, phone, company, job_title, custom_fields } = req.body;
  if (!full_name?.trim() || !email?.includes('@')) {
    throw ApiError.badRequest('Full name and a valid email address are required');
  }

  const existing = await queryOne(
    "SELECT id FROM event_registrations WHERE event_id = ? AND email = ? AND status != 'cancelled'",
    [event.id, email.toLowerCase().trim()]
  );
  if (existing) throw ApiError.conflict('This email is already registered for this event');

  const counted = await queryOne(
    "SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ? AND status != 'cancelled'",
    [event.id]
  );
  const isWaitlist = event.capacity && Number(counted.c) >= event.capacity;

  const ticketCode = `${event.reference || 'EV'}-${randomToken(4).toUpperCase()}`;
  const result = await execute(
    `INSERT INTO event_registrations
       (event_id, ticket_code, full_name, email, phone, company, job_title, custom_fields,
        status, payment_status, amount_cents, qr_payload)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      event.id, ticketCode, full_name.trim(), email.toLowerCase().trim(), phone || null,
      company || null, job_title || null, custom_fields ? JSON.stringify(custom_fields) : null,
      isWaitlist ? 'waitlist' : 'registered',
      event.is_ticketed ? 'pending' : 'not_required',
      event.is_ticketed ? event.ticket_price_cents : 0,
      ticketCode,
    ]
  );

  res.status(201).json({
    message: isWaitlist
      ? 'You have been added to the waitlist. We will contact you if a place opens up.'
      : 'Registration confirmed. Please keep your check-in code.',
    data: { ticket_code: ticketCode, status: isWaitlist ? 'waitlist' : 'registered', id: result.insertId },
  });
}));

// ----------------------------------------------------- PUBLIC QUOTE VIEW
/** Clients open quotes from an emailed link without signing in. */
router.get('/quotes/:token', asyncHandler(async (req, res) => {
  const quote = await queryOne(
    `SELECT q.*, o.name AS organisation_name, o.tin AS buyer_tin, o.vrn AS buyer_vrn
       FROM quotes q JOIN organisations o ON o.id = q.organisation_id
      WHERE q.public_token = ? AND q.deleted_at IS NULL`,
    [req.params.token]
  );
  if (!quote) throw ApiError.notFound('Quote not found');

  if (!quote.viewed_at) {
    await execute("UPDATE quotes SET viewed_at = NOW(), status = IF(status='sent','viewed',status) WHERE id = ?", [quote.id]);
  }
  const items = await query(
    'SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id',
    [quote.id]
  );
  res.json({ data: { ...quote, items } });
}));

router.post('/quotes/:token/respond', formLimiter, asyncHandler(async (req, res) => {
  const { action, signature_name, signature_data, rejection_reason } = req.body;
  const quote = await queryOne(
    "SELECT * FROM quotes WHERE public_token = ? AND deleted_at IS NULL",
    [req.params.token]
  );
  if (!quote) throw ApiError.notFound('Quote not found');
  if (['accepted', 'rejected'].includes(quote.status)) {
    throw ApiError.badRequest('This quote has already been responded to');
  }

  if (action === 'accept') {
    if (!signature_name?.trim()) throw ApiError.badRequest('Please type your full name to sign');
    await execute(
      `UPDATE quotes SET status='accepted', responded_at=NOW(), signed_at=NOW(),
              signature_name=?, signature_data=?, signed_ip=? WHERE id = ?`,
      [signature_name.trim(), signature_data || null, req.ip?.slice(0, 45) ?? null, quote.id]
    );
    await notifyByPermission('quotes.view', {
      type: 'quote.accepted',
      title: `Quote ${quote.reference} accepted`,
      body: `Signed by ${signature_name}`,
      linkUrl: `/admin/quotes/${quote.id}`,
      entityType: 'quotes', entityId: quote.id, icon: 'check-circle',
    });
    return res.json({ message: 'Thank you. Your acceptance has been recorded.' });
  }

  if (action === 'reject') {
    await execute(
      "UPDATE quotes SET status='rejected', responded_at=NOW(), rejection_reason=? WHERE id = ?",
      [rejection_reason || null, quote.id]
    );
    await notifyByPermission('quotes.view', {
      type: 'quote.rejected',
      title: `Quote ${quote.reference} declined`,
      body: rejection_reason || 'No reason given',
      linkUrl: `/admin/quotes/${quote.id}`,
      entityType: 'quotes', entityId: quote.id, icon: 'x-circle',
    });
    return res.json({ message: 'Your response has been recorded. Thank you.' });
  }

  throw ApiError.badRequest("action must be 'accept' or 'reject'");
}));

// --------------------------------------------------- PUBLIC INVOICE VIEW
router.get('/invoices/:token', asyncHandler(async (req, res) => {
  const invoice = await queryOne(
    `SELECT i.*, o.name AS organisation_name FROM invoices i
       JOIN organisations o ON o.id = i.organisation_id
      WHERE i.public_token = ? AND i.deleted_at IS NULL`,
    [req.params.token]
  );
  if (!invoice) throw ApiError.notFound('Invoice not found');

  if (!invoice.viewed_at) {
    await execute("UPDATE invoices SET viewed_at = NOW(), status = IF(status='sent','viewed',status) WHERE id = ?", [invoice.id]);
  }
  const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id', [invoice.id]);
  const payments = await query(
    "SELECT amount_cents, method, paid_at, provider_ref FROM payments WHERE invoice_id = ? AND status='confirmed' ORDER BY paid_at",
    [invoice.id]
  );
  res.json({ data: { ...invoice, items, payments } });
}));

export default router;
