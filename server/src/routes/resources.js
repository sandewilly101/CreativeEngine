import express from 'express';
import bcrypt from 'bcryptjs';
import { createCrudRouter } from '../services/crudFactory.js';
import { ApiError } from '../utils/helpers.js';

/**
 * Admin CRUD for every managed table. Each resource declares its writable
 * fields, what can be searched, filtered and sorted, and any hooks it needs.
 * The factory supplies list/read/create/update/delete/restore/bulk/reorder.
 */
const router = express.Router();

// ------------------------------------------------------------------- CMS
router.use('/divisions', createCrudRouter({
  table: 'divisions',
  module: 'cms',
  fields: ['slug', 'code', 'name', 'tagline', 'description', 'icon', 'color_hex',
    'hero_media_id', 'revenue_model', 'sort_order', 'is_active', 'meta_title', 'meta_description'],
  searchable: ['name', 'tagline', 'description'],
  filterable: ['is_active'],
  sortable: ['id', 'name', 'sort_order', 'created_at'],
  slugFrom: 'name',
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT divisions.*, m.public_url AS hero_url,
                      (SELECT COUNT(*) FROM services s WHERE s.division_id = divisions.id AND s.deleted_at IS NULL) AS service_count
                 FROM divisions LEFT JOIN media m ON m.id = divisions.hero_media_id`,
}));

router.use('/services', createCrudRouter({
  table: 'services',
  module: 'cms',
  fields: ['division_id', 'slug', 'name', 'short_description', 'description', 'deliverables',
    'inclusions', 'exclusions', 'hero_media_id', 'icon', 'pricing_model', 'base_price_cents',
    'setup_fee_cents', 'recurring_interval', 'min_term_months', 'revision_limit',
    'turnaround_days', 'is_featured', 'is_bookable', 'status', 'sort_order',
    'meta_title', 'meta_description'],
  searchable: ['name', 'short_description', 'description'],
  filterable: ['division_id', 'status', 'is_featured', 'pricing_model'],
  sortable: ['id', 'name', 'base_price_cents', 'sort_order', 'created_at', 'updated_at'],
  jsonFields: ['deliverables', 'inclusions', 'exclusions'],
  slugFrom: 'name',
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT services.*, d.name AS division_name, d.color_hex AS division_color,
                      m.public_url AS hero_url, m.thumb_url AS hero_thumb
                 FROM services
            LEFT JOIN divisions d ON d.id = services.division_id
            LEFT JOIN media m ON m.id = services.hero_media_id`,
}));

router.use('/packages', createCrudRouter({
  table: 'packages',
  module: 'cms',
  fields: ['slug', 'name', 'tagline', 'description', 'division_id', 'tier', 'price_cents',
    'setup_fee_cents', 'billing_interval', 'features', 'capacity_note', 'hero_media_id',
    'is_featured', 'status', 'sort_order'],
  searchable: ['name', 'tagline', 'description'],
  filterable: ['status', 'tier', 'division_id', 'is_featured'],
  sortable: ['id', 'name', 'price_cents', 'sort_order', 'created_at'],
  jsonFields: ['features'],
  slugFrom: 'name',
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT packages.*, d.name AS division_name,
                      m.public_url AS hero_url, m.thumb_url AS hero_thumb
                 FROM packages
            LEFT JOIN divisions d ON d.id = packages.division_id
            LEFT JOIN media m ON m.id = packages.hero_media_id`,
}));

router.use('/portfolio', createCrudRouter({
  table: 'portfolio_items',
  module: 'cms',
  fields: ['slug', 'title', 'client_name', 'organisation_id', 'division_id', 'summary',
    'challenge', 'approach', 'result', 'metrics', 'services_used', 'cover_media_id',
    'gallery', 'video_url', 'project_date', 'location', 'is_featured', 'status',
    'sort_order', 'meta_title', 'meta_description'],
  searchable: ['title', 'client_name', 'summary'],
  filterable: ['status', 'division_id', 'is_featured'],
  sortable: ['id', 'title', 'project_date', 'sort_order', 'view_count', 'created_at'],
  jsonFields: ['metrics', 'services_used', 'gallery'],
  slugFrom: 'title',
  labelField: 'title',
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT portfolio_items.*, d.name AS division_name, m.public_url AS cover_url,
                      m.thumb_url AS cover_thumb
                 FROM portfolio_items
            LEFT JOIN divisions d ON d.id = portfolio_items.division_id
            LEFT JOIN media m ON m.id = portfolio_items.cover_media_id`,
}));

router.use('/posts', createCrudRouter({
  table: 'posts',
  module: 'cms',
  fields: ['category_id', 'author_id', 'slug', 'title', 'excerpt', 'body', 'cover_media_id',
    'tags', 'reading_minutes', 'status', 'published_at', 'is_featured',
    'meta_title', 'meta_description'],
  searchable: ['title', 'excerpt', 'body'],
  filterable: ['status', 'category_id', 'is_featured', 'author_id'],
  sortable: ['id', 'title', 'published_at', 'view_count', 'created_at'],
  jsonFields: ['tags'],
  slugFrom: 'title',
  labelField: 'title',
  defaultSort: 'created_at',
  listSelect: `SELECT posts.*, c.name AS category_name, m.thumb_url AS cover_thumb,
                      CONCAT(u.first_name,' ',u.last_name) AS author_name
                 FROM posts
            LEFT JOIN post_categories c ON c.id = posts.category_id
            LEFT JOIN media m ON m.id = posts.cover_media_id
            LEFT JOIN users u ON u.id = posts.author_id`,
  beforeCreate: async (data, req) => {
    data.author_id ??= req.user.id;
    // Rough reading time at 200 words per minute.
    if (data.body && !data.reading_minutes) {
      data.reading_minutes = Math.max(1, Math.round(String(data.body).split(/\s+/).length / 200));
    }
    if (data.status === 'published' && !data.published_at) {
      data.published_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    return data;
  },
  beforeUpdate: async (data, _req, existing) => {
    if (data.body) {
      data.reading_minutes = Math.max(1, Math.round(String(data.body).split(/\s+/).length / 200));
    }
    if (data.status === 'published' && !existing.published_at && !data.published_at) {
      data.published_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    return data;
  },
}));

router.use('/post-categories', createCrudRouter({
  table: 'post_categories',
  module: 'cms',
  fields: ['slug', 'name', 'description', 'color_hex', 'sort_order'],
  searchable: ['name'],
  sortable: ['id', 'name', 'sort_order'],
  slugFrom: 'name',
  softDelete: false,
  defaultSort: 'sort_order',
  reorderable: true,
}));

router.use('/pages', createCrudRouter({
  table: 'pages',
  module: 'cms',
  fields: ['slug', 'title', 'subtitle', 'template', 'blocks', 'hero_media_id', 'body',
    'meta_title', 'meta_description', 'og_media_id', 'canonical_url', 'noindex',
    'status', 'published_at', 'sort_order'],
  searchable: ['title', 'subtitle', 'body'],
  filterable: ['status', 'template'],
  sortable: ['id', 'title', 'sort_order', 'created_at'],
  jsonFields: ['blocks'],
  slugFrom: 'title',
  labelField: 'title',
  defaultSort: 'sort_order',
  beforeCreate: async (data, req) => ({ ...data, created_by: req.user.id }),
  beforeUpdate: async (data, req) => ({ ...data, updated_by: req.user.id }),
}));

router.use('/team', createCrudRouter({
  table: 'team_members',
  module: 'cms',
  fields: ['user_id', 'name', 'role_title', 'bio', 'photo_media_id', 'email',
    'linkedin_url', 'twitter_url', 'division_id', 'sort_order', 'is_published'],
  searchable: ['name', 'role_title', 'bio'],
  filterable: ['is_published', 'division_id'],
  sortable: ['id', 'name', 'sort_order'],
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT team_members.*, m.public_url AS photo_url, m.thumb_url AS photo_thumb,
                      d.name AS division_name
                 FROM team_members
            LEFT JOIN media m ON m.id = team_members.photo_media_id
            LEFT JOIN divisions d ON d.id = team_members.division_id`,
}));

router.use('/testimonials', createCrudRouter({
  table: 'testimonials',
  module: 'cms',
  fields: ['author_name', 'author_title', 'company', 'organisation_id', 'quote', 'rating',
    'photo_media_id', 'logo_media_id', 'portfolio_item_id', 'is_featured', 'status', 'sort_order'],
  searchable: ['author_name', 'company', 'quote'],
  filterable: ['status', 'is_featured'],
  sortable: ['id', 'author_name', 'sort_order', 'created_at'],
  labelField: 'author_name',
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT testimonials.*, m.public_url AS photo_url, m.thumb_url AS photo_thumb,
                      l.public_url AS logo_url
                 FROM testimonials
            LEFT JOIN media m ON m.id = testimonials.photo_media_id
            LEFT JOIN media l ON l.id = testimonials.logo_media_id`,
}));

router.use('/client-logos', createCrudRouter({
  table: 'client_logos',
  module: 'cms',
  fields: ['name', 'logo_media_id', 'website_url', 'sort_order', 'is_published'],
  searchable: ['name'],
  sortable: ['id', 'name', 'sort_order'],
  softDelete: false,
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT client_logos.*, m.public_url AS logo_url
                 FROM client_logos LEFT JOIN media m ON m.id = client_logos.logo_media_id`,
}));

router.use('/faqs', createCrudRouter({
  table: 'faqs',
  module: 'cms',
  fields: ['question', 'answer', 'category', 'division_id', 'sort_order', 'is_published', 'use_in_ai_kb'],
  searchable: ['question', 'answer'],
  filterable: ['category', 'is_published', 'division_id'],
  sortable: ['id', 'sort_order', 'created_at'],
  labelField: 'question',
  softDelete: false,
  defaultSort: 'sort_order',
  reorderable: true,
}));

router.use('/menu-items', createCrudRouter({
  table: 'menu_items',
  module: 'cms',
  fields: ['menu_key', 'parent_id', 'label', 'url', 'icon', 'target', 'sort_order', 'is_active'],
  searchable: ['label', 'url'],
  filterable: ['menu_key', 'is_active'],
  sortable: ['id', 'sort_order'],
  labelField: 'label',
  softDelete: false,
  defaultSort: 'sort_order',
  reorderable: true,
}));

// ------------------------------------------------------------------- CRM
router.use('/organisations', createCrudRouter({
  table: 'organisations',
  module: 'organisations',
  fields: ['name', 'slug', 'legal_name', 'industry', 'tin', 'vrn', 'is_vat_exempt', 'email',
    'phone', 'website', 'address_line1', 'address_line2', 'city', 'region', 'country',
    'logo_media_id', 'preferred_currency', 'payment_terms_days', 'credit_limit_cents',
    'account_manager_id', 'status', 'notes'],
  searchable: ['name', 'legal_name', 'email', 'phone', 'tin'],
  filterable: ['status', 'industry', 'account_manager_id', 'city'],
  sortable: ['id', 'name', 'created_at', 'status'],
  slugFrom: 'name',
  defaultSort: 'name',
  listSelect: `SELECT organisations.*, m.public_url AS logo_url,
                      CONCAT(u.first_name,' ',u.last_name) AS account_manager_name,
                      (SELECT COUNT(*) FROM projects p WHERE p.organisation_id = organisations.id AND p.deleted_at IS NULL) AS project_count,
                      (SELECT COALESCE(SUM(balance_cents),0) FROM invoices i WHERE i.organisation_id = organisations.id
                         AND i.status IN ('sent','viewed','partial','overdue') AND i.deleted_at IS NULL) AS outstanding_cents
                 FROM organisations
            LEFT JOIN media m ON m.id = organisations.logo_media_id
            LEFT JOIN users u ON u.id = organisations.account_manager_id`,
  scopeFilter: (req) => req.user.role_slug === 'client'
    ? { clause: 'organisations.id = ?', params: [req.user.organisation_id] }
    : null,
}));

router.use('/leads', createCrudRouter({
  table: 'leads',
  module: 'leads',
  fields: ['organisation_id', 'contact_name', 'company_name', 'email', 'phone', 'whatsapp',
    'division_id', 'service_id', 'package_id', 'subject', 'message', 'budget_range',
    'estimated_value_cents', 'currency', 'source', 'source_detail', 'status', 'lost_reason',
    'score', 'assigned_to', 'next_followup_at'],
  searchable: ['contact_name', 'company_name', 'email', 'phone', 'message', 'reference'],
  filterable: ['status', 'source', 'assigned_to', 'division_id'],
  sortable: ['id', 'contact_name', 'created_at', 'score', 'estimated_value_cents', 'next_followup_at'],
  defaultSort: 'created_at',
  labelField: 'contact_name',
  listSelect: `SELECT leads.*, d.name AS division_name, s.name AS service_name,
                      CONCAT(u.first_name,' ',u.last_name) AS assigned_name
                 FROM leads
            LEFT JOIN divisions d ON d.id = leads.division_id
            LEFT JOIN services s ON s.id = leads.service_id
            LEFT JOIN users u ON u.id = leads.assigned_to`,
  beforeCreate: async (data) => {
    const { generateReference } = await import('../utils/helpers.js');
    data.reference = await generateReference('lead');
    return data;
  },
}));

router.use('/suppliers', createCrudRouter({
  table: 'suppliers',
  module: 'suppliers',
  fields: ['name', 'slug', 'category', 'specialties', 'contact_name', 'email', 'phone',
    'whatsapp', 'address', 'city', 'tin', 'vrn', 'bank_details', 'payment_terms_days',
    'rating', 'is_vetted', 'vetted_at', 'sla_notes', 'capabilities', 'status', 'notes'],
  searchable: ['name', 'contact_name', 'email', 'phone', 'capabilities'],
  filterable: ['category', 'status', 'is_vetted', 'city'],
  sortable: ['id', 'name', 'rating', 'jobs_completed', 'on_time_rate', 'created_at'],
  jsonFields: ['specialties'],
  slugFrom: 'name',
  defaultSort: 'name',
}));

// ------------------------------------------------------------- OPERATIONS
router.use('/tasks', createCrudRouter({
  table: 'tasks',
  module: 'tasks',
  fields: ['project_id', 'milestone_id', 'parent_task_id', 'title', 'description', 'status',
    'priority', 'assigned_to', 'due_date', 'estimated_hours', 'sort_order', 'is_client_visible'],
  searchable: ['title', 'description'],
  filterable: ['project_id', 'status', 'priority', 'assigned_to', 'milestone_id'],
  sortable: ['id', 'title', 'due_date', 'priority', 'sort_order', 'created_at'],
  labelField: 'title',
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT tasks.*, p.name AS project_name, p.reference AS project_reference,
                      CONCAT(u.first_name,' ',u.last_name) AS assignee_name
                 FROM tasks
            LEFT JOIN projects p ON p.id = tasks.project_id
            LEFT JOIN users u ON u.id = tasks.assigned_to`,
  beforeCreate: async (data, req) => ({ ...data, created_by: req.user.id }),
  beforeUpdate: async (data) => {
    if (data.status === 'done') data.completed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    else if (data.status) data.completed_at = null;
    return data;
  },
  scopeFilter: (req) => req.user.role_slug === 'client'
    ? { clause: 'tasks.is_client_visible = 1 AND p.organisation_id = ?', params: [req.user.organisation_id] }
    : null,
}));

router.use('/milestones', createCrudRouter({
  table: 'project_milestones',
  module: 'projects',
  fields: ['project_id', 'name', 'description', 'due_date', 'completed_at', 'sort_order', 'is_client_visible'],
  filterable: ['project_id'],
  sortable: ['id', 'due_date', 'sort_order'],
  softDelete: false,
  defaultSort: 'sort_order',
  reorderable: true,
}));

router.use('/events', createCrudRouter({
  table: 'events',
  module: 'events',
  fields: ['project_id', 'organisation_id', 'name', 'slug', 'type', 'description',
    'cover_media_id', 'venue', 'venue_address', 'city', 'start_datetime', 'end_datetime',
    'expected_attendees', 'actual_attendees', 'budget_cents', 'cost_cents', 'currency',
    'registration_open', 'registration_closes_at', 'capacity', 'is_ticketed',
    'ticket_price_cents', 'is_public', 'status', 'run_sheet', 'manager_id'],
  searchable: ['name', 'venue', 'description', 'reference'],
  filterable: ['status', 'type', 'is_public', 'organisation_id', 'manager_id'],
  sortable: ['id', 'name', 'start_datetime', 'created_at'],
  jsonFields: ['run_sheet'],
  slugFrom: 'name',
  defaultSort: 'start_datetime',
  listSelect: `SELECT events.*, o.name AS organisation_name, m.public_url AS cover_url,
                      (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = events.id AND r.status != 'cancelled') AS registered_count
                 FROM events
            LEFT JOIN organisations o ON o.id = events.organisation_id
            LEFT JOIN media m ON m.id = events.cover_media_id`,
  beforeCreate: async (data) => {
    const { generateReference } = await import('../utils/helpers.js');
    data.reference = await generateReference('event');
    return data;
  },
}));

router.use('/equipment-categories', createCrudRouter({
  table: 'equipment_categories',
  module: 'equipment',
  fields: ['parent_id', 'slug', 'name', 'description', 'icon', 'sort_order', 'is_published'],
  searchable: ['name'],
  sortable: ['id', 'name', 'sort_order'],
  slugFrom: 'name',
  softDelete: false,
  defaultSort: 'sort_order',
  reorderable: true,
}));

router.use('/print-products', createCrudRouter({
  table: 'print_products',
  module: 'print',
  fields: ['slug', 'name', 'category', 'description', 'cover_media_id', 'gallery',
    'pricing_basis', 'base_price_cents', 'min_order_qty', 'min_charge_cents', 'substrates',
    'finishing_options', 'size_presets', 'turnaround_days', 'rush_available',
    'rush_surcharge_percent', 'bleed_mm', 'safe_margin_mm', 'min_dpi', 'color_profile',
    'artwork_notes', 'supplier_id', 'supplier_cost_cents', 'is_published', 'is_featured', 'sort_order'],
  searchable: ['name', 'description', 'category'],
  filterable: ['category', 'is_published', 'is_featured', 'pricing_basis'],
  sortable: ['id', 'name', 'base_price_cents', 'sort_order'],
  jsonFields: ['substrates', 'finishing_options', 'size_presets', 'gallery'],
  slugFrom: 'name',
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT print_products.*, m.public_url AS cover_url, m.thumb_url AS cover_thumb
                 FROM print_products LEFT JOIN media m ON m.id = print_products.cover_media_id`,
}));

router.use('/mockup-templates', createCrudRouter({
  table: 'mockup_templates',
  module: 'print',
  fields: ['name', 'category', 'description', 'base_media_id', 'overlay_config', 'is_published', 'sort_order'],
  searchable: ['name', 'category'],
  filterable: ['category', 'is_published'],
  sortable: ['id', 'name', 'sort_order'],
  jsonFields: ['overlay_config'],
  defaultSort: 'sort_order',
  reorderable: true,
  listSelect: `SELECT mockup_templates.*, m.public_url AS base_url, m.thumb_url AS base_thumb
                 FROM mockup_templates LEFT JOIN media m ON m.id = mockup_templates.base_media_id`,
  beforeCreate: async (data, req) => ({ ...data, created_by: req.user.id }),
}));

router.use('/hosting-accounts', createCrudRouter({
  table: 'hosting_accounts',
  module: 'subscriptions',
  fields: ['organisation_id', 'subscription_id', 'domain', 'type', 'provider', 'plan',
    'registered_at', 'expires_at', 'auto_renew', 'cost_cents', 'price_cents', 'currency',
    'nameservers', 'status', 'uptime_percent', 'notes'],
  searchable: ['domain', 'provider', 'plan'],
  filterable: ['status', 'type', 'organisation_id', 'auto_renew'],
  sortable: ['id', 'domain', 'expires_at', 'created_at'],
  labelField: 'domain',
  defaultSort: 'expires_at',
  listSelect: `SELECT hosting_accounts.*, o.name AS organisation_name,
                      DATEDIFF(hosting_accounts.expires_at, CURDATE()) AS days_to_expiry
                 FROM hosting_accounts
            LEFT JOIN organisations o ON o.id = hosting_accounts.organisation_id`,
  scopeFilter: (req) => req.user.role_slug === 'client'
    ? { clause: 'hosting_accounts.organisation_id = ?', params: [req.user.organisation_id] }
    : null,
}));

router.use('/expenses', createCrudRouter({
  table: 'expenses',
  module: 'expenses',
  fields: ['project_id', 'supplier_id', 'purchase_order_id', 'category', 'description',
    'amount_cents', 'currency', 'vat_cents', 'expense_date', 'is_billable', 'is_reimbursed',
    'receipt_media_id', 'status', 'approved_by'],
  searchable: ['description', 'reference', 'category'],
  filterable: ['status', 'category', 'project_id', 'supplier_id', 'is_billable'],
  sortable: ['id', 'expense_date', 'amount_cents', 'created_at'],
  labelField: 'description',
  defaultSort: 'expense_date',
  listSelect: `SELECT expenses.*, p.name AS project_name, s.name AS supplier_name,
                      m.public_url AS receipt_url
                 FROM expenses
            LEFT JOIN projects p ON p.id = expenses.project_id
            LEFT JOIN suppliers s ON s.id = expenses.supplier_id
            LEFT JOIN media m ON m.id = expenses.receipt_media_id`,
  beforeCreate: async (data, req) => {
    const { generateReference } = await import('../utils/helpers.js');
    data.reference = await generateReference('expense');
    data.recorded_by = req.user.id;
    return data;
  },
}));

router.use('/purchase-orders', createCrudRouter({
  table: 'purchase_orders',
  module: 'suppliers',
  fields: ['supplier_id', 'project_id', 'print_order_id', 'booking_id', 'description',
    'currency', 'subtotal_cents', 'vat_cents', 'total_cents', 'status', 'expected_date',
    'delivered_at', 'quality_rating', 'qc_notes'],
  searchable: ['reference', 'description'],
  filterable: ['status', 'supplier_id', 'project_id'],
  sortable: ['id', 'created_at', 'expected_date', 'total_cents'],
  labelField: 'reference',
  defaultSort: 'created_at',
  listSelect: `SELECT purchase_orders.*, s.name AS supplier_name, p.name AS project_name
                 FROM purchase_orders
            LEFT JOIN suppliers s ON s.id = purchase_orders.supplier_id
            LEFT JOIN projects p ON p.id = purchase_orders.project_id`,
  beforeCreate: async (data, req) => {
    const { generateReference } = await import('../utils/helpers.js');
    data.reference = await generateReference('purchase_order');
    data.created_by = req.user.id;
    return data;
  },
}));

router.use('/service-requests', createCrudRouter({
  table: 'service_requests',
  // Its own module: a client may raise a request without gaining project rights.
  module: 'requests',
  fields: ['organisation_id', 'service_id', 'subscription_id', 'project_id', 'title',
    'description', 'attachments', 'priority', 'status', 'consumes_capacity',
    'capacity_units', 'assigned_to', 'due_date'],
  searchable: ['title', 'description', 'reference'],
  filterable: ['status', 'priority', 'organisation_id', 'assigned_to'],
  sortable: ['id', 'created_at', 'due_date', 'priority'],
  jsonFields: ['attachments'],
  labelField: 'title',
  defaultSort: 'created_at',
  listSelect: `SELECT service_requests.*, o.name AS organisation_name, s.name AS service_name,
                      CONCAT(u.first_name,' ',u.last_name) AS assignee_name
                 FROM service_requests
            LEFT JOIN organisations o ON o.id = service_requests.organisation_id
            LEFT JOIN services s ON s.id = service_requests.service_id
            LEFT JOIN users u ON u.id = service_requests.assigned_to`,
  beforeCreate: async (data, req) => {
    const { generateReference } = await import('../utils/helpers.js');
    data.reference = await generateReference('service_request');
    data.requested_by = req.user.id;
    if (req.user.role_slug === 'client') data.organisation_id = req.user.organisation_id;
    return data;
  },
  scopeFilter: (req) => req.user.role_slug === 'client'
    ? { clause: 'service_requests.organisation_id = ?', params: [req.user.organisation_id] }
    : null,
}));

router.use('/subscriptions', createCrudRouter({
  table: 'subscriptions',
  module: 'subscriptions',
  fields: ['organisation_id', 'package_id', 'service_id', 'name', 'description', 'type',
    'amount_cents', 'currency', 'billing_interval', 'capacity_units', 'capacity_used',
    'overage_rate_cents', 'start_date', 'end_date', 'next_billing_date', 'auto_invoice',
    'collection_method', 'status', 'cancellation_reason', 'min_term_months', 'notes'],
  searchable: ['name', 'reference', 'description'],
  filterable: ['status', 'type', 'organisation_id', 'billing_interval'],
  sortable: ['id', 'name', 'amount_cents', 'next_billing_date', 'created_at'],
  defaultSort: 'next_billing_date',
  listSelect: `SELECT subscriptions.*, o.name AS organisation_name, p.name AS package_name
                 FROM subscriptions
            LEFT JOIN organisations o ON o.id = subscriptions.organisation_id
            LEFT JOIN packages p ON p.id = subscriptions.package_id`,
  beforeCreate: async (data) => {
    const { generateReference } = await import('../utils/helpers.js');
    data.reference = await generateReference('subscription');
    return data;
  },
  scopeFilter: (req) => req.user.role_slug === 'client'
    ? { clause: 'subscriptions.organisation_id = ?', params: [req.user.organisation_id] }
    : null,
}));

// ----------------------------------------------------------------- USERS
router.use('/users', createCrudRouter({
  table: 'users',
  module: 'users',
  fields: ['organisation_id', 'role_id', 'first_name', 'last_name', 'email', 'phone',
    'avatar_media_id', 'job_title', 'division', 'locale', 'timezone', 'display_currency',
    'is_active', 'must_change_password'],
  searchable: ['first_name', 'last_name', 'email', 'phone', 'job_title'],
  filterable: ['role_id', 'organisation_id', 'is_active', 'division'],
  sortable: ['id', 'first_name', 'last_name', 'email', 'created_at', 'last_login_at'],
  labelField: 'email',
  defaultSort: 'created_at',
  listSelect: `SELECT users.id, users.organisation_id, users.role_id, users.first_name,
                      users.last_name, users.email, users.phone, users.job_title, users.division,
                      users.is_active, users.last_login_at, users.created_at, users.deleted_at,
                      users.avatar_media_id, r.name AS role_name, r.slug AS role_slug,
                      o.name AS organisation_name, m.public_url AS avatar_url
                 FROM users
            LEFT JOIN roles r ON r.id = users.role_id
            LEFT JOIN organisations o ON o.id = users.organisation_id
            LEFT JOIN media m ON m.id = users.avatar_media_id`,
  singleSelect: `SELECT users.id, users.organisation_id, users.role_id, users.first_name,
                        users.last_name, users.email, users.phone, users.job_title, users.division,
                        users.is_active, users.last_login_at, users.created_at, users.avatar_media_id,
                        users.locale, users.timezone, users.display_currency, users.must_change_password,
                        r.name AS role_name, r.slug AS role_slug, o.name AS organisation_name
                   FROM users
              LEFT JOIN roles r ON r.id = users.role_id
              LEFT JOIN organisations o ON o.id = users.organisation_id`,
  beforeCreate: async (data, req) => {
    if (!data.email) throw ApiError.badRequest('Email is required');
    data.email = String(data.email).toLowerCase().trim();
    const password = req.body.password;
    if (!password || password.length < 8) {
      throw ApiError.badRequest('A password of at least 8 characters is required');
    }
    data.password_hash = await bcrypt.hash(password, 12);
    return data;
  },
  beforeUpdate: async (data, req) => {
    if (data.email) data.email = String(data.email).toLowerCase().trim();
    // Password changes come through this same endpoint for admins.
    if (req.body.password) {
      if (req.body.password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
      data.password_hash = await bcrypt.hash(req.body.password, 12);
    }
    return data;
  },
  beforeDelete: async (row, req) => {
    if (Number(row.id) === Number(req.user.id)) {
      throw ApiError.badRequest('You cannot delete your own account');
    }
  },
}));

export default router;
