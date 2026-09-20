-- ============================================================================
-- CREATIVE ENGINE — DATABASE SCHEMA
-- Integrated Creative, Digital, AI, Events & Production Platform
-- Target: MySQL 8.0+ / MariaDB 10.6+
-- Currency: TZS base (minor units / cents), USD derived via live FX
-- Tax: Tanzania VAT 18%, TRA EFDMS-ready invoice fields
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- SECTION 1: IDENTITY, ACCESS CONTROL & ORGANISATIONS
-- ============================================================================

-- Roles are fixed tiers; granular permissions layer on top.
CREATE TABLE IF NOT EXISTS roles (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug          VARCHAR(50)  NOT NULL UNIQUE,   -- admin | staff | client
  name          VARCHAR(100) NOT NULL,
  description   VARCHAR(255) NULL,
  is_system     TINYINT(1)   NOT NULL DEFAULT 0, -- system roles cannot be deleted
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug          VARCHAR(100) NOT NULL UNIQUE,   -- e.g. projects.create, invoices.delete
  module        VARCHAR(50)  NOT NULL,          -- projects | invoices | cms | media ...
  description   VARCHAR(255) NULL,
  INDEX idx_perm_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Client companies. Staff/admin users may have no organisation.
CREATE TABLE IF NOT EXISTS organisations (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(220) NOT NULL UNIQUE,
  legal_name      VARCHAR(255) NULL,
  industry        VARCHAR(100) NULL,
  -- Tanzania tax identifiers, required on fiscalised invoices
  tin             VARCHAR(32)  NULL COMMENT 'Taxpayer Identification Number',
  vrn             VARCHAR(32)  NULL COMMENT 'VAT Registration Number',
  is_vat_exempt   TINYINT(1)   NOT NULL DEFAULT 0,
  email           VARCHAR(190) NULL,
  phone           VARCHAR(40)  NULL,
  website         VARCHAR(255) NULL,
  address_line1   VARCHAR(255) NULL,
  address_line2   VARCHAR(255) NULL,
  city            VARCHAR(100) NULL DEFAULT 'Dar es Salaam',
  region          VARCHAR(100) NULL,
  country         CHAR(2)      NOT NULL DEFAULT 'TZ',
  logo_media_id   INT UNSIGNED NULL,
  preferred_currency CHAR(3)   NOT NULL DEFAULT 'TZS',
  payment_terms_days INT       NOT NULL DEFAULT 30,
  credit_limit_cents BIGINT    NOT NULL DEFAULT 0,
  account_manager_id INT UNSIGNED NULL,
  status          ENUM('lead','active','dormant','archived') NOT NULL DEFAULT 'active',
  notes           TEXT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  INDEX idx_org_status (status),
  INDEX idx_org_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organisation_id    INT UNSIGNED NULL,
  role_id            INT UNSIGNED NOT NULL,
  first_name         VARCHAR(100) NOT NULL,
  last_name          VARCHAR(100) NOT NULL,
  email              VARCHAR(190) NOT NULL UNIQUE,
  phone              VARCHAR(40)  NULL,
  password_hash      VARCHAR(255) NOT NULL,
  avatar_media_id    INT UNSIGNED NULL,
  job_title          VARCHAR(120) NULL,
  division           ENUM('creative','digital','ai','events','production','finance','management') NULL
                     COMMENT 'Staff pod assignment; scopes staff visibility',
  locale             VARCHAR(10)  NOT NULL DEFAULT 'en',
  timezone           VARCHAR(64)  NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  display_currency   CHAR(3)      NOT NULL DEFAULT 'TZS',
  is_active          TINYINT(1)   NOT NULL DEFAULT 1,
  email_verified_at  TIMESTAMP NULL,
  last_login_at      TIMESTAMP NULL,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until       TIMESTAMP NULL,
  reset_token        VARCHAR(255) NULL,
  reset_expires_at   TIMESTAMP NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMP NULL,
  FOREIGN KEY (role_id)         REFERENCES roles(id),
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
  INDEX idx_user_org (organisation_id),
  INDEX idx_user_role (role_id),
  INDEX idx_user_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-user permission overrides (grant or revoke beyond the role)
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  effect        ENUM('allow','deny') NOT NULL DEFAULT 'allow',
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)  NOT NULL UNIQUE,
  user_agent  VARCHAR(255) NULL,
  ip_address  VARCHAR(45)  NULL,
  expires_at  TIMESTAMP NOT NULL,
  revoked_at  TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 2: MEDIA LIBRARY
-- Central asset store: uploads from device, reusable across CMS/mockups/proofs
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_folders (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  parent_id   INT UNSIGNED NULL,
  name        VARCHAR(150) NOT NULL,
  path        VARCHAR(500) NOT NULL,
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id)  REFERENCES media_folders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_folder_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  folder_id      INT UNSIGNED NULL,
  filename       VARCHAR(255) NOT NULL COMMENT 'stored filename on disk',
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  kind           ENUM('image','video','document','audio','archive','other') NOT NULL DEFAULT 'other',
  extension      VARCHAR(16)  NULL,
  size_bytes     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  width          INT NULL,
  height         INT NULL,
  duration_secs  INT NULL COMMENT 'for video/audio',
  storage_path   VARCHAR(500) NOT NULL,
  public_url     VARCHAR(500) NOT NULL,
  thumb_url      VARCHAR(500) NULL,
  -- editorial metadata
  title          VARCHAR(255) NULL,
  alt_text       VARCHAR(500) NULL COMMENT 'accessibility + SEO',
  caption        TEXT NULL,
  credit         VARCHAR(255) NULL,
  tags           JSON NULL,
  -- governance
  is_public      TINYINT(1) NOT NULL DEFAULT 1,
  organisation_id INT UNSIGNED NULL COMMENT 'if set, client-private asset',
  checksum_sha256 CHAR(64) NULL,
  uploaded_by    INT UNSIGNED NULL,
  usage_count    INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMP NULL,
  FOREIGN KEY (folder_id)       REFERENCES media_folders(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by)     REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
  INDEX idx_media_kind (kind),
  INDEX idx_media_folder (folder_id),
  INDEX idx_media_deleted (deleted_at),
  INDEX idx_media_checksum (checksum_sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 3: CMS — PUBLIC WEBSITE CONTENT
-- Everything on the marketing site is editable from admin.
-- ============================================================================

-- Key/value site settings (brand, contact, social, SEO defaults, integrations)
CREATE TABLE IF NOT EXISTS settings (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  group_key    VARCHAR(50)  NOT NULL COMMENT 'brand|contact|social|seo|finance|ai|email',
  setting_key  VARCHAR(100) NOT NULL,
  setting_value LONGTEXT NULL,
  value_type   ENUM('string','number','boolean','json','media','html') NOT NULL DEFAULT 'string',
  label        VARCHAR(255) NULL,
  description  VARCHAR(500) NULL,
  is_public    TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'exposed to public site API',
  sort_order   INT NOT NULL DEFAULT 0,
  updated_by   INT UNSIGNED NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_setting (group_key, setting_key),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Navigation menus, fully editable
CREATE TABLE IF NOT EXISTS menu_items (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  menu_key    VARCHAR(50) NOT NULL DEFAULT 'header' COMMENT 'header|footer_1|footer_2|legal',
  parent_id   INT UNSIGNED NULL,
  label       VARCHAR(150) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  icon        VARCHAR(50) NULL,
  target      ENUM('_self','_blank') NOT NULL DEFAULT '_self',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_menu_key (menu_key, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Generic pages built from a block/section array (page builder)
CREATE TABLE IF NOT EXISTS pages (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug             VARCHAR(220) NOT NULL UNIQUE,
  title            VARCHAR(255) NOT NULL,
  subtitle         VARCHAR(500) NULL,
  template         VARCHAR(50) NOT NULL DEFAULT 'default' COMMENT 'default|landing|contact|about',
  blocks           JSON NULL COMMENT 'ordered array of section objects rendered by the front end',
  hero_media_id    INT UNSIGNED NULL,
  body             LONGTEXT NULL,
  -- SEO
  meta_title       VARCHAR(255) NULL,
  meta_description VARCHAR(500) NULL,
  og_media_id      INT UNSIGNED NULL,
  canonical_url    VARCHAR(500) NULL,
  noindex          TINYINT(1) NOT NULL DEFAULT 0,
  status           ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at     TIMESTAMP NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  created_by       INT UNSIGNED NULL,
  updated_by       INT UNSIGNED NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       TIMESTAMP NULL,
  FOREIGN KEY (hero_media_id) REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (og_media_id)   REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_page_status (status),
  INDEX idx_page_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The five divisions of the Creative Engine
CREATE TABLE IF NOT EXISTS divisions (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug           VARCHAR(80) NOT NULL UNIQUE,
  code           VARCHAR(10) NOT NULL COMMENT '01..05',
  name           VARCHAR(150) NOT NULL,
  tagline        VARCHAR(255) NULL,
  description    TEXT NULL,
  icon           VARCHAR(50) NULL,
  color_hex      CHAR(7) NULL,
  hero_media_id  INT UNSIGNED NULL,
  revenue_model  VARCHAR(255) NULL COMMENT 'e.g. Project + monthly retainer',
  sort_order     INT NOT NULL DEFAULT 0,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  meta_title       VARCHAR(255) NULL,
  meta_description VARCHAR(500) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMP NULL,
  FOREIGN KEY (hero_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual services within a division; these are the sellable catalogue
CREATE TABLE IF NOT EXISTS services (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  division_id        INT UNSIGNED NOT NULL,
  slug               VARCHAR(220) NOT NULL UNIQUE,
  name               VARCHAR(200) NOT NULL,
  short_description  VARCHAR(500) NULL,
  description        LONGTEXT NULL,
  deliverables       JSON NULL COMMENT 'array of strings shown as scope list',
  inclusions         JSON NULL,
  exclusions         JSON NULL,
  hero_media_id      INT UNSIGNED NULL,
  icon               VARCHAR(50) NULL,
  -- commercial
  pricing_model      ENUM('fixed','from','hourly','daily','monthly','per_sqm','per_unit','quote_only')
                     NOT NULL DEFAULT 'quote_only',
  base_price_cents   BIGINT NOT NULL DEFAULT 0 COMMENT 'TZS minor units',
  setup_fee_cents    BIGINT NOT NULL DEFAULT 0,
  recurring_interval ENUM('none','monthly','quarterly','annual') NOT NULL DEFAULT 'none',
  min_term_months    INT NOT NULL DEFAULT 0,
  revision_limit     INT NULL COMMENT 'guards low-margin custom work',
  turnaround_days    INT NULL,
  is_featured        TINYINT(1) NOT NULL DEFAULT 0,
  is_bookable        TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'can be added to an online request',
  status             ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  sort_order         INT NOT NULL DEFAULT 0,
  meta_title         VARCHAR(255) NULL,
  meta_description   VARCHAR(500) NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMP NULL,
  FOREIGN KEY (division_id)   REFERENCES divisions(id) ON DELETE CASCADE,
  FOREIGN KEY (hero_media_id) REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_service_division (division_id),
  INDEX idx_service_status (status),
  INDEX idx_service_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Packaged flagship offers (blueprint 90-day priority #2)
CREATE TABLE IF NOT EXISTS packages (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug              VARCHAR(220) NOT NULL UNIQUE,
  name              VARCHAR(200) NOT NULL,
  tagline           VARCHAR(255) NULL,
  description       LONGTEXT NULL,
  division_id       INT UNSIGNED NULL,
  tier              ENUM('starter','growth','enterprise','custom') NOT NULL DEFAULT 'starter',
  price_cents       BIGINT NOT NULL DEFAULT 0,
  setup_fee_cents   BIGINT NOT NULL DEFAULT 0,
  billing_interval  ENUM('once','monthly','quarterly','annual') NOT NULL DEFAULT 'monthly',
  features          JSON NULL COMMENT 'array of {label, included:boolean}',
  capacity_note     VARCHAR(255) NULL COMMENT 'e.g. 12 deliverables/month — capacity-priced, not unlimited',
  hero_media_id     INT UNSIGNED NULL,
  is_featured       TINYINT(1) NOT NULL DEFAULT 0,
  status            ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (division_id)   REFERENCES divisions(id) ON DELETE SET NULL,
  FOREIGN KEY (hero_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_services (
  package_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  quantity   INT NOT NULL DEFAULT 1,
  PRIMARY KEY (package_id, service_id),
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Portfolio / case studies
CREATE TABLE IF NOT EXISTS portfolio_items (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug              VARCHAR(220) NOT NULL UNIQUE,
  title             VARCHAR(255) NOT NULL,
  client_name       VARCHAR(200) NULL COMMENT 'display name; may differ from organisation',
  organisation_id   INT UNSIGNED NULL,
  division_id       INT UNSIGNED NULL,
  summary           VARCHAR(500) NULL,
  challenge         TEXT NULL,
  approach          TEXT NULL,
  result            TEXT NULL,
  metrics           JSON NULL COMMENT 'array of {label, value} outcome stats',
  services_used     JSON NULL,
  cover_media_id    INT UNSIGNED NULL,
  gallery           JSON NULL COMMENT 'array of media ids',
  video_url         VARCHAR(500) NULL,
  project_date      DATE NULL,
  location          VARCHAR(150) NULL,
  is_featured       TINYINT(1) NOT NULL DEFAULT 0,
  status            ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  sort_order        INT NOT NULL DEFAULT 0,
  meta_title        VARCHAR(255) NULL,
  meta_description  VARCHAR(500) NULL,
  view_count        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (division_id)     REFERENCES divisions(id) ON DELETE SET NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_media_id)  REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_portfolio_status (status),
  INDEX idx_portfolio_featured (is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blog / insights
CREATE TABLE IF NOT EXISTS post_categories (
  id         INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  color_hex  CHAR(7) NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  category_id       INT UNSIGNED NULL,
  author_id         INT UNSIGNED NULL,
  slug              VARCHAR(220) NOT NULL UNIQUE,
  title             VARCHAR(255) NOT NULL,
  excerpt           VARCHAR(500) NULL,
  body              LONGTEXT NULL,
  cover_media_id    INT UNSIGNED NULL,
  tags              JSON NULL,
  reading_minutes   INT NULL,
  status            ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at      TIMESTAMP NULL,
  is_featured       TINYINT(1) NOT NULL DEFAULT 0,
  view_count        INT NOT NULL DEFAULT 0,
  meta_title        VARCHAR(255) NULL,
  meta_description  VARCHAR(500) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (category_id)    REFERENCES post_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (author_id)      REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_post_status (status, published_at),
  INDEX idx_post_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id        INT UNSIGNED NULL,
  name           VARCHAR(150) NOT NULL,
  role_title     VARCHAR(150) NOT NULL,
  bio            TEXT NULL,
  photo_media_id INT UNSIGNED NULL,
  email          VARCHAR(190) NULL,
  linkedin_url   VARCHAR(255) NULL,
  twitter_url    VARCHAR(255) NULL,
  division_id    INT UNSIGNED NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  is_published   TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMP NULL,
  FOREIGN KEY (user_id)        REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (photo_media_id) REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (division_id)    REFERENCES divisions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS testimonials (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  author_name    VARCHAR(150) NOT NULL,
  author_title   VARCHAR(150) NULL,
  company        VARCHAR(150) NULL,
  organisation_id INT UNSIGNED NULL,
  quote          TEXT NOT NULL,
  rating         TINYINT NULL COMMENT '1-5',
  photo_media_id INT UNSIGNED NULL,
  logo_media_id  INT UNSIGNED NULL,
  portfolio_item_id INT UNSIGNED NULL,
  is_featured    TINYINT(1) NOT NULL DEFAULT 0,
  status         ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMP NULL,
  FOREIGN KEY (organisation_id)   REFERENCES organisations(id) ON DELETE SET NULL,
  FOREIGN KEY (photo_media_id)    REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (logo_media_id)     REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (portfolio_item_id) REFERENCES portfolio_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_logos (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  logo_media_id INT UNSIGNED NULL,
  website_url   VARCHAR(255) NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_published  TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (logo_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faqs (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  question    VARCHAR(500) NOT NULL,
  answer      TEXT NOT NULL,
  category    VARCHAR(100) NULL,
  division_id INT UNSIGNED NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  use_in_ai_kb TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'feed to AI assistant knowledge base',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 4: CRM — LEADS & PIPELINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference         VARCHAR(30) NOT NULL UNIQUE COMMENT 'LEAD-2026-0001',
  organisation_id   INT UNSIGNED NULL,
  contact_name      VARCHAR(150) NOT NULL,
  company_name      VARCHAR(200) NULL,
  email             VARCHAR(190) NULL,
  phone             VARCHAR(40)  NULL,
  whatsapp          VARCHAR(40)  NULL,
  division_id       INT UNSIGNED NULL,
  service_id        INT UNSIGNED NULL,
  package_id        INT UNSIGNED NULL,
  subject           VARCHAR(255) NULL,
  message           TEXT NULL,
  budget_range      VARCHAR(50) NULL,
  estimated_value_cents BIGINT NOT NULL DEFAULT 0,
  currency          CHAR(3) NOT NULL DEFAULT 'TZS',
  source            ENUM('website','ai_assistant','whatsapp','referral','event','social','phone','walk_in','qr_code','other')
                    NOT NULL DEFAULT 'website',
  source_detail     VARCHAR(255) NULL,
  status            ENUM('new','contacted','qualified','proposal_sent','won','lost','spam')
                    NOT NULL DEFAULT 'new',
  lost_reason       VARCHAR(255) NULL,
  score             INT NOT NULL DEFAULT 0 COMMENT 'lead scoring 0-100',
  assigned_to       INT UNSIGNED NULL,
  next_followup_at  DATETIME NULL,
  converted_at      TIMESTAMP NULL,
  ip_address        VARCHAR(45) NULL,
  user_agent        VARCHAR(255) NULL,
  utm_source        VARCHAR(100) NULL,
  utm_medium        VARCHAR(100) NULL,
  utm_campaign      VARCHAR(100) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
  FOREIGN KEY (division_id)     REFERENCES divisions(id) ON DELETE SET NULL,
  FOREIGN KEY (service_id)      REFERENCES services(id) ON DELETE SET NULL,
  FOREIGN KEY (package_id)      REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to)     REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_lead_status (status),
  INDEX idx_lead_assigned (assigned_to),
  INDEX idx_lead_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_activities (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  lead_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NULL,
  type       ENUM('note','call','email','meeting','whatsapp','status_change','assignment') NOT NULL,
  content    TEXT NULL,
  metadata   JSON NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activity_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 5: QUOTES / PROPOSALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotes (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference          VARCHAR(30) NOT NULL UNIQUE COMMENT 'QT-2026-0001',
  organisation_id    INT UNSIGNED NOT NULL,
  lead_id            INT UNSIGNED NULL,
  title              VARCHAR(255) NOT NULL,
  intro              TEXT NULL,
  terms              TEXT NULL,
  notes              TEXT NULL,
  currency           CHAR(3) NOT NULL DEFAULT 'TZS',
  fx_rate_to_tzs     DECIMAL(18,6) NOT NULL DEFAULT 1.000000 COMMENT 'locked at issue',
  subtotal_cents     BIGINT NOT NULL DEFAULT 0,
  discount_type      ENUM('none','percent','fixed') NOT NULL DEFAULT 'none',
  discount_value     DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_cents     BIGINT NOT NULL DEFAULT 0,
  vat_rate           DECIMAL(5,2) NOT NULL DEFAULT 18.00 COMMENT 'Tanzania standard VAT',
  vat_cents          BIGINT NOT NULL DEFAULT 0,
  total_cents        BIGINT NOT NULL DEFAULT 0,
  valid_until        DATE NULL,
  status             ENUM('draft','sent','viewed','accepted','rejected','expired','revised')
                     NOT NULL DEFAULT 'draft',
  sent_at            TIMESTAMP NULL,
  viewed_at          TIMESTAMP NULL,
  responded_at       TIMESTAMP NULL,
  rejection_reason   TEXT NULL,
  signature_name     VARCHAR(150) NULL,
  signature_data     LONGTEXT NULL COMMENT 'base64 signature image',
  signed_at          TIMESTAMP NULL,
  signed_ip          VARCHAR(45) NULL,
  public_token       CHAR(48) NULL UNIQUE COMMENT 'shareable view link',
  version            INT NOT NULL DEFAULT 1,
  parent_quote_id    INT UNSIGNED NULL,
  created_by         INT UNSIGNED NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id)         REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)      REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_quote_id) REFERENCES quotes(id) ON DELETE SET NULL,
  INDEX idx_quote_org (organisation_id),
  INDEX idx_quote_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quote_items (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  quote_id     INT UNSIGNED NOT NULL,
  service_id   INT UNSIGNED NULL,
  package_id   INT UNSIGNED NULL,
  equipment_id INT UNSIGNED NULL,
  item_type    ENUM('service','package','equipment','print','custom','discount') NOT NULL DEFAULT 'custom',
  description  VARCHAR(500) NOT NULL,
  detail       TEXT NULL,
  quantity     DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit         VARCHAR(30) NOT NULL DEFAULT 'item' COMMENT 'item|day|sqm|hour|month',
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  line_total_cents BIGINT NOT NULL DEFAULT 0,
  is_taxable   TINYINT(1) NOT NULL DEFAULT 1,
  is_optional  TINYINT(1) NOT NULL DEFAULT 0,
  sort_order   INT NOT NULL DEFAULT 0,
  FOREIGN KEY (quote_id)   REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  INDEX idx_qi_quote (quote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 6: PROJECTS, TASKS, APPROVALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference          VARCHAR(30) NOT NULL UNIQUE COMMENT 'PRJ-2026-0001',
  organisation_id    INT UNSIGNED NOT NULL,
  quote_id           INT UNSIGNED NULL,
  division_id        INT UNSIGNED NULL,
  name               VARCHAR(255) NOT NULL,
  description        TEXT NULL,
  brief              LONGTEXT NULL COMMENT 'the agreed creative/production brief',
  stage              ENUM('discover','strategy','create','build','activate','measure','optimize')
                     NOT NULL DEFAULT 'discover' COMMENT 'blueprint customer journey',
  status             ENUM('planning','active','on_hold','review','completed','cancelled')
                     NOT NULL DEFAULT 'planning',
  health             ENUM('on_track','at_risk','off_track') NOT NULL DEFAULT 'on_track',
  priority           ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  progress_percent   TINYINT NOT NULL DEFAULT 0,
  start_date         DATE NULL,
  due_date           DATE NULL,
  completed_at       TIMESTAMP NULL,
  budget_cents       BIGINT NOT NULL DEFAULT 0,
  cost_cents         BIGINT NOT NULL DEFAULT 0 COMMENT 'supplier + internal cost for margin',
  currency           CHAR(3) NOT NULL DEFAULT 'TZS',
  project_manager_id INT UNSIGNED NULL,
  cover_media_id     INT UNSIGNED NULL,
  is_client_visible  TINYINT(1) NOT NULL DEFAULT 1,
  created_by         INT UNSIGNED NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMP NULL,
  FOREIGN KEY (organisation_id)    REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (quote_id)           REFERENCES quotes(id) ON DELETE SET NULL,
  FOREIGN KEY (division_id)        REFERENCES divisions(id) ON DELETE SET NULL,
  FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_media_id)     REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_project_org (organisation_id),
  INDEX idx_project_status (status),
  INDEX idx_project_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_members (
  project_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  role       VARCHAR(80) NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_milestones (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT NULL,
  due_date    DATE NULL,
  completed_at TIMESTAMP NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_client_visible TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_ms_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_id     INT UNSIGNED NULL,
  milestone_id   INT UNSIGNED NULL,
  parent_task_id INT UNSIGNED NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT NULL,
  status         ENUM('todo','in_progress','review','blocked','done','cancelled') NOT NULL DEFAULT 'todo',
  priority       ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  assigned_to    INT UNSIGNED NULL,
  created_by     INT UNSIGNED NULL,
  due_date       DATE NULL,
  estimated_hours DECIMAL(8,2) NULL,
  logged_hours   DECIMAL(8,2) NOT NULL DEFAULT 0,
  completed_at   TIMESTAMP NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  is_client_visible TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMP NULL,
  FOREIGN KEY (project_id)     REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (milestone_id)   REFERENCES project_milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to)    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_task_project (project_id),
  INDEX idx_task_assigned (assigned_to),
  INDEX idx_task_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS time_entries (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  task_id     INT UNSIGNED NULL,
  project_id  INT UNSIGNED NULL,
  user_id     INT UNSIGNED NOT NULL,
  description VARCHAR(500) NULL,
  hours       DECIMAL(8,2) NOT NULL,
  entry_date  DATE NOT NULL,
  is_billable TINYINT(1) NOT NULL DEFAULT 1,
  rate_cents  BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id)    REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_time_project (project_id),
  INDEX idx_time_date (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proofing & approvals: versioned deliverables with annotation
CREATE TABLE IF NOT EXISTS deliverables (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_id     INT UNSIGNED NOT NULL,
  task_id        INT UNSIGNED NULL,
  name           VARCHAR(255) NOT NULL,
  description    TEXT NULL,
  type           ENUM('design','video','document','website','print_proof','mockup','other')
                 NOT NULL DEFAULT 'design',
  current_version INT NOT NULL DEFAULT 1,
  status         ENUM('draft','in_review','changes_requested','approved','rejected')
                 NOT NULL DEFAULT 'draft',
  revision_count INT NOT NULL DEFAULT 0,
  revision_limit INT NULL COMMENT 'from service; extra revisions are billable',
  due_date       DATE NULL,
  approved_at    TIMESTAMP NULL,
  approved_by    INT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMP NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id)     REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_deliv_project (project_id),
  INDEX idx_deliv_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deliverable_versions (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  deliverable_id INT UNSIGNED NOT NULL,
  version        INT NOT NULL,
  media_id       INT UNSIGNED NULL,
  notes          TEXT NULL,
  uploaded_by    INT UNSIGNED NULL,
  status         ENUM('pending','approved','changes_requested','superseded') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_deliv_version (deliverable_id, version),
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id)       REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by)    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pin-point annotations on a proof (x/y as percentages for responsive display)
CREATE TABLE IF NOT EXISTS annotations (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  version_id    INT UNSIGNED NOT NULL,
  user_id       INT UNSIGNED NULL,
  parent_id     BIGINT UNSIGNED NULL COMMENT 'threaded replies',
  body          TEXT NOT NULL,
  pos_x         DECIMAL(6,3) NULL COMMENT 'percent from left',
  pos_y         DECIMAL(6,3) NULL COMMENT 'percent from top',
  shape         ENUM('pin','rect','ellipse','arrow','freehand') NOT NULL DEFAULT 'pin',
  shape_data    JSON NULL,
  page_number   INT NULL COMMENT 'for multi-page PDFs',
  timecode_secs DECIMAL(10,3) NULL COMMENT 'for video proofs',
  is_resolved   TINYINT(1) NOT NULL DEFAULT 0,
  resolved_by   INT UNSIGNED NULL,
  resolved_at   TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id)  REFERENCES annotations(id) ON DELETE CASCADE,
  INDEX idx_anno_version (version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_files (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_id  INT UNSIGNED NOT NULL,
  media_id    INT UNSIGNED NOT NULL,
  category    ENUM('brief','asset','reference','contract','final','other') NOT NULL DEFAULT 'asset',
  is_client_visible TINYINT(1) NOT NULL DEFAULT 1,
  uploaded_by INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id)    REFERENCES media(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pf_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  entity_type   VARCHAR(50) NOT NULL COMMENT 'project|task|quote|invoice|deliverable|order|booking',
  entity_id     INT UNSIGNED NOT NULL,
  user_id       INT UNSIGNED NULL,
  parent_id     BIGINT UNSIGNED NULL,
  body          TEXT NOT NULL,
  attachments   JSON NULL COMMENT 'array of media ids',
  is_internal   TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'hidden from client portal',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP NULL,
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_comment_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 7: EQUIPMENT HIRE
-- Asset-level availability to prevent double-booking (rental-native model)
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipment_categories (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  parent_id   INT UNSIGNED NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  name        VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  icon        VARCHAR(50) NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (parent_id) REFERENCES equipment_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  category_id       INT UNSIGNED NULL,
  sku               VARCHAR(50) NOT NULL UNIQUE,
  slug              VARCHAR(220) NOT NULL UNIQUE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT NULL,
  specifications    JSON NULL COMMENT 'array of {label, value}',
  cover_media_id    INT UNSIGNED NULL,
  gallery           JSON NULL,
  -- stock: total units owned; availability computed against bookings
  total_units       INT NOT NULL DEFAULT 1,
  -- pricing tiers (TZS cents)
  daily_rate_cents     BIGINT NOT NULL DEFAULT 0,
  half_day_rate_cents  BIGINT NOT NULL DEFAULT 0,
  weekly_rate_cents    BIGINT NOT NULL DEFAULT 0,
  monthly_rate_cents   BIGINT NOT NULL DEFAULT 0,
  -- for LED walls etc., priced per square metre per day
  unit_of_measure   ENUM('unit','sqm','metre','set') NOT NULL DEFAULT 'unit',
  deposit_cents     BIGINT NOT NULL DEFAULT 0,
  damage_waiver_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  replacement_value_cents BIGINT NOT NULL DEFAULT 0,
  requires_operator TINYINT(1) NOT NULL DEFAULT 0,
  operator_day_rate_cents BIGINT NOT NULL DEFAULT 0,
  requires_transport TINYINT(1) NOT NULL DEFAULT 0,
  transport_cents   BIGINT NOT NULL DEFAULT 0,
  setup_hours       DECIMAL(5,2) NULL,
  power_requirement VARCHAR(150) NULL,
  weight_kg         DECIMAL(10,2) NULL,
  dimensions        VARCHAR(150) NULL,
  min_rental_days   INT NOT NULL DEFAULT 1,
  -- ownership: own fleet vs supplier-sourced (blueprint: rent first, buy on utilisation)
  ownership         ENUM('owned','supplier','consignment') NOT NULL DEFAULT 'owned',
  supplier_id       INT UNSIGNED NULL,
  supplier_cost_cents BIGINT NOT NULL DEFAULT 0,
  condition_notes   TEXT NULL,
  status            ENUM('available','maintenance','retired','draft') NOT NULL DEFAULT 'available',
  is_published      TINYINT(1) NOT NULL DEFAULT 1,
  is_featured       TINYINT(1) NOT NULL DEFAULT 0,
  utilisation_days  INT NOT NULL DEFAULT 0 COMMENT 'lifetime days rented, drives buy decisions',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (category_id)    REFERENCES equipment_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_equip_category (category_id),
  INDEX idx_equip_status (status),
  INDEX idx_equip_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual serialised units, for asset-level tracking
CREATE TABLE IF NOT EXISTS equipment_units (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  equipment_id  INT UNSIGNED NOT NULL,
  asset_tag     VARCHAR(60) NOT NULL UNIQUE,
  serial_number VARCHAR(100) NULL,
  -- "condition" is a reserved word in MySQL/MariaDB, hence the prefix.
  unit_condition ENUM('new','good','fair','damaged','lost') NOT NULL DEFAULT 'good',
  status        ENUM('available','on_hire','maintenance','retired') NOT NULL DEFAULT 'available',
  purchase_date DATE NULL,
  purchase_cost_cents BIGINT NOT NULL DEFAULT 0,
  last_service_date DATE NULL,
  next_service_date DATE NULL,
  notes         TEXT NULL,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  INDEX idx_unit_equip (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference         VARCHAR(30) NOT NULL UNIQUE COMMENT 'BK-2026-0001',
  organisation_id   INT UNSIGNED NULL,
  project_id        INT UNSIGNED NULL,
  contact_name      VARCHAR(150) NOT NULL,
  contact_email     VARCHAR(190) NULL,
  contact_phone     VARCHAR(40) NULL,
  event_name        VARCHAR(255) NULL,
  venue             VARCHAR(255) NULL,
  venue_address     TEXT NULL,
  start_date        DATETIME NOT NULL,
  end_date          DATETIME NOT NULL,
  setup_date        DATETIME NULL COMMENT 'gear leaves store earlier than event start',
  teardown_date     DATETIME NULL COMMENT 'gear returns after event end',
  rental_days       INT NOT NULL DEFAULT 1,
  currency          CHAR(3) NOT NULL DEFAULT 'TZS',
  fx_rate_to_tzs    DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
  subtotal_cents    BIGINT NOT NULL DEFAULT 0,
  transport_cents   BIGINT NOT NULL DEFAULT 0,
  operator_cents    BIGINT NOT NULL DEFAULT 0,
  damage_waiver_cents BIGINT NOT NULL DEFAULT 0,
  discount_cents    BIGINT NOT NULL DEFAULT 0,
  vat_rate          DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  vat_cents         BIGINT NOT NULL DEFAULT 0,
  total_cents       BIGINT NOT NULL DEFAULT 0,
  deposit_cents     BIGINT NOT NULL DEFAULT 0,
  deposit_paid      TINYINT(1) NOT NULL DEFAULT 0,
  deposit_refunded_cents BIGINT NOT NULL DEFAULT 0,
  status            ENUM('enquiry','quoted','confirmed','dispatched','on_hire','returned','completed','cancelled')
                    NOT NULL DEFAULT 'enquiry',
  dispatch_notes    TEXT NULL,
  return_notes      TEXT NULL,
  damage_report     TEXT NULL,
  damage_charge_cents BIGINT NOT NULL DEFAULT 0,
  dispatched_at     TIMESTAMP NULL,
  returned_at       TIMESTAMP NULL,
  handled_by        INT UNSIGNED NULL,
  created_by        INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)      REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (handled_by)      REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_booking_dates (start_date, end_date),
  INDEX idx_booking_status (status),
  INDEX idx_booking_org (organisation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_items (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  booking_id    INT UNSIGNED NOT NULL,
  equipment_id  INT UNSIGNED NOT NULL,
  unit_id       INT UNSIGNED NULL COMMENT 'specific asset assigned at dispatch',
  quantity      INT NOT NULL DEFAULT 1,
  measure_qty   DECIMAL(10,2) NOT NULL DEFAULT 1 COMMENT 'sqm for LED etc.',
  rate_type     ENUM('daily','half_day','weekly','monthly') NOT NULL DEFAULT 'daily',
  rate_cents    BIGINT NOT NULL DEFAULT 0,
  days          INT NOT NULL DEFAULT 1,
  line_total_cents BIGINT NOT NULL DEFAULT 0,
  returned_qty  INT NOT NULL DEFAULT 0,
  condition_out ENUM('new','good','fair','damaged') NULL,
  condition_in  ENUM('new','good','fair','damaged','lost') NULL,
  notes         VARCHAR(500) NULL,
  FOREIGN KEY (booking_id)   REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT,
  FOREIGN KEY (unit_id)      REFERENCES equipment_units(id) ON DELETE SET NULL,
  INDEX idx_bi_booking (booking_id),
  INDEX idx_bi_equipment (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Maintenance blocks that remove stock from availability
CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  equipment_id INT UNSIGNED NOT NULL,
  unit_id      INT UNSIGNED NULL,
  reason       VARCHAR(255) NOT NULL,
  start_date   DATETIME NOT NULL,
  end_date     DATETIME NOT NULL,
  cost_cents   BIGINT NOT NULL DEFAULT 0,
  status       ENUM('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  notes        TEXT NULL,
  created_by   INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id)      REFERENCES equipment_units(id) ON DELETE CASCADE,
  INDEX idx_maint_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 8: PRINT ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS print_products (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug              VARCHAR(220) NOT NULL UNIQUE,
  name              VARCHAR(200) NOT NULL,
  category          VARCHAR(100) NULL COMMENT 'banner|signage|apparel|merchandise|stationery|vehicle',
  description       TEXT NULL,
  cover_media_id    INT UNSIGNED NULL,
  gallery           JSON NULL,
  -- pricing: per sqm for large format, per unit for merchandise
  pricing_basis     ENUM('per_sqm','per_unit','tiered') NOT NULL DEFAULT 'per_sqm',
  base_price_cents  BIGINT NOT NULL DEFAULT 0,
  min_order_qty     INT NOT NULL DEFAULT 1,
  min_charge_cents  BIGINT NOT NULL DEFAULT 0,
  -- production spec options offered to the client
  substrates        JSON NULL COMMENT 'array of {name, price_modifier_cents, unit}',
  finishing_options JSON NULL COMMENT 'array of {name, price_cents, unit} e.g. grommets, hemming, pole pockets',
  size_presets      JSON NULL COMMENT 'array of {label, width_mm, height_mm}',
  turnaround_days   INT NOT NULL DEFAULT 3,
  rush_available    TINYINT(1) NOT NULL DEFAULT 1,
  rush_surcharge_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  bleed_mm          DECIMAL(6,2) NOT NULL DEFAULT 10.00,
  safe_margin_mm    DECIMAL(6,2) NOT NULL DEFAULT 20.00,
  min_dpi           INT NOT NULL DEFAULT 100 COMMENT 'large format viewed at distance',
  color_profile     VARCHAR(50) NULL DEFAULT 'CMYK',
  artwork_notes     TEXT NULL,
  supplier_id       INT UNSIGNED NULL,
  supplier_cost_cents BIGINT NOT NULL DEFAULT 0,
  is_published      TINYINT(1) NOT NULL DEFAULT 1,
  is_featured       TINYINT(1) NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_print_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS print_orders (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference         VARCHAR(30) NOT NULL UNIQUE COMMENT 'PO-2026-0001',
  organisation_id   INT UNSIGNED NULL,
  project_id        INT UNSIGNED NULL,
  contact_name      VARCHAR(150) NOT NULL,
  contact_email     VARCHAR(190) NULL,
  contact_phone     VARCHAR(40) NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'TZS',
  fx_rate_to_tzs    DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
  subtotal_cents    BIGINT NOT NULL DEFAULT 0,
  rush_cents        BIGINT NOT NULL DEFAULT 0,
  delivery_cents    BIGINT NOT NULL DEFAULT 0,
  installation_cents BIGINT NOT NULL DEFAULT 0,
  discount_cents    BIGINT NOT NULL DEFAULT 0,
  vat_rate          DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  vat_cents         BIGINT NOT NULL DEFAULT 0,
  total_cents       BIGINT NOT NULL DEFAULT 0,
  status            ENUM('draft','quoted','artwork_pending','preflight','proof_sent','approved',
                         'in_production','ready','delivered','completed','cancelled')
                    NOT NULL DEFAULT 'draft',
  is_rush           TINYINT(1) NOT NULL DEFAULT 0,
  required_by       DATE NULL,
  delivery_method   ENUM('pickup','delivery','installation') NOT NULL DEFAULT 'pickup',
  delivery_address  TEXT NULL,
  production_notes  TEXT NULL,
  supplier_id       INT UNSIGNED NULL,
  supplier_cost_cents BIGINT NOT NULL DEFAULT 0,
  assigned_to       INT UNSIGNED NULL,
  completed_at      TIMESTAMP NULL,
  created_by        INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)      REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to)     REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_status (status),
  INDEX idx_po_org (organisation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS print_order_items (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id        INT UNSIGNED NOT NULL,
  product_id      INT UNSIGNED NULL,
  description     VARCHAR(500) NOT NULL,
  quantity        INT NOT NULL DEFAULT 1,
  width_mm        DECIMAL(10,2) NULL,
  height_mm       DECIMAL(10,2) NULL,
  area_sqm        DECIMAL(10,4) NULL COMMENT 'computed w*h*qty',
  substrate       VARCHAR(150) NULL,
  finishing       JSON NULL COMMENT 'selected finishing options with counts',
  sides           ENUM('single','double') NOT NULL DEFAULT 'single',
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  line_total_cents BIGINT NOT NULL DEFAULT 0,
  -- artwork & mockups
  artwork_media_id INT UNSIGNED NULL,
  mockup_media_id  INT UNSIGNED NULL,
  proof_media_id   INT UNSIGNED NULL,
  preflight_status ENUM('pending','passed','warnings','failed') NOT NULL DEFAULT 'pending',
  preflight_notes  TEXT NULL,
  artwork_dpi      INT NULL,
  artwork_colorspace VARCHAR(30) NULL,
  approved_at      TIMESTAMP NULL,
  approved_by      INT UNSIGNED NULL,
  production_status ENUM('queued','printing','finishing','done') NOT NULL DEFAULT 'queued',
  sort_order       INT NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id)         REFERENCES print_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)       REFERENCES print_products(id) ON DELETE SET NULL,
  FOREIGN KEY (artwork_media_id) REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (mockup_media_id)  REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (proof_media_id)   REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_poi_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reusable mockup templates (client sees their artwork on a real-world scene)
CREATE TABLE IF NOT EXISTS mockup_templates (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(100) NULL COMMENT 'banner|billboard|tshirt|mug|vehicle|stand|signage',
  description     TEXT NULL,
  base_media_id   INT UNSIGNED NULL COMMENT 'the scene photo',
  -- four corner points defining the perspective quad where artwork is placed
  overlay_config  JSON NULL COMMENT '{corners:[{x,y}x4], blend, opacity, shadow}',
  is_published    TINYINT(1) NOT NULL DEFAULT 1,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      INT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (base_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 9: EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference         VARCHAR(30) NOT NULL UNIQUE COMMENT 'EV-2026-0001',
  project_id        INT UNSIGNED NULL,
  organisation_id   INT UNSIGNED NULL,
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(255) NULL UNIQUE,
  type              ENUM('conference','launch','activation','exhibition','gala','workshop','roadshow','other')
                    NOT NULL DEFAULT 'conference',
  description       LONGTEXT NULL,
  cover_media_id    INT UNSIGNED NULL,
  venue             VARCHAR(255) NULL,
  venue_address     TEXT NULL,
  city              VARCHAR(100) NULL DEFAULT 'Dar es Salaam',
  start_datetime    DATETIME NOT NULL,
  end_datetime      DATETIME NOT NULL,
  expected_attendees INT NULL,
  actual_attendees  INT NULL,
  budget_cents      BIGINT NOT NULL DEFAULT 0,
  cost_cents        BIGINT NOT NULL DEFAULT 0,
  currency          CHAR(3) NOT NULL DEFAULT 'TZS',
  -- public registration page
  registration_open TINYINT(1) NOT NULL DEFAULT 0,
  registration_closes_at DATETIME NULL,
  capacity          INT NULL,
  is_ticketed       TINYINT(1) NOT NULL DEFAULT 0,
  ticket_price_cents BIGINT NOT NULL DEFAULT 0,
  is_public         TINYINT(1) NOT NULL DEFAULT 0,
  status            ENUM('planning','confirmed','live','completed','cancelled') NOT NULL DEFAULT 'planning',
  run_sheet         JSON NULL COMMENT 'array of {time, item, owner, notes}',
  manager_id        INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (project_id)      REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_media_id)  REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_id)      REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_event_dates (start_datetime),
  INDEX idx_event_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_registrations (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_id       INT UNSIGNED NOT NULL,
  ticket_code    VARCHAR(40) NOT NULL UNIQUE,
  full_name      VARCHAR(200) NOT NULL,
  email          VARCHAR(190) NOT NULL,
  phone          VARCHAR(40) NULL,
  company        VARCHAR(200) NULL,
  job_title      VARCHAR(150) NULL,
  custom_fields  JSON NULL,
  status         ENUM('registered','confirmed','waitlist','checked_in','cancelled','no_show')
                 NOT NULL DEFAULT 'registered',
  payment_status ENUM('not_required','pending','paid','refunded') NOT NULL DEFAULT 'not_required',
  amount_cents   BIGINT NOT NULL DEFAULT 0,
  qr_payload     VARCHAR(255) NULL,
  checked_in_at  TIMESTAMP NULL,
  checked_in_by  INT UNSIGNED NULL,
  source         VARCHAR(50) NULL DEFAULT 'website',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id)      REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reg_event (event_id),
  INDEX idx_reg_status (status),
  INDEX idx_reg_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 10: SUPPLIERS / PRODUCTION NETWORK
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(220) NOT NULL UNIQUE,
  category         ENUM('printer','fabricator','av','equipment','freelancer','logistics','catering','venue','other')
                   NOT NULL DEFAULT 'other',
  specialties      JSON NULL,
  contact_name     VARCHAR(150) NULL,
  email            VARCHAR(190) NULL,
  phone            VARCHAR(40) NULL,
  whatsapp         VARCHAR(40) NULL,
  address          TEXT NULL,
  city             VARCHAR(100) NULL DEFAULT 'Dar es Salaam',
  tin              VARCHAR(32) NULL,
  vrn              VARCHAR(32) NULL,
  bank_details     TEXT NULL,
  payment_terms_days INT NOT NULL DEFAULT 14,
  -- vetting & QC (blueprint risk control: supplier inconsistency)
  rating           DECIMAL(3,2) NOT NULL DEFAULT 0 COMMENT '0-5',
  jobs_completed   INT NOT NULL DEFAULT 0,
  on_time_rate     DECIMAL(5,2) NOT NULL DEFAULT 0,
  quality_score    DECIMAL(3,2) NOT NULL DEFAULT 0,
  is_vetted        TINYINT(1) NOT NULL DEFAULT 0,
  vetted_at        DATE NULL,
  sla_notes        TEXT NULL,
  capabilities     TEXT NULL,
  status           ENUM('active','probation','suspended','archived') NOT NULL DEFAULT 'active',
  notes            TEXT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       TIMESTAMP NULL,
  INDEX idx_supplier_category (category),
  INDEX idx_supplier_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference       VARCHAR(30) NOT NULL UNIQUE COMMENT 'SPO-2026-0001',
  supplier_id     INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NULL,
  print_order_id  INT UNSIGNED NULL,
  booking_id      INT UNSIGNED NULL,
  description     TEXT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'TZS',
  subtotal_cents  BIGINT NOT NULL DEFAULT 0,
  vat_cents       BIGINT NOT NULL DEFAULT 0,
  total_cents     BIGINT NOT NULL DEFAULT 0,
  status          ENUM('draft','sent','accepted','in_progress','delivered','invoiced','paid','cancelled')
                  NOT NULL DEFAULT 'draft',
  expected_date   DATE NULL,
  delivered_at    TIMESTAMP NULL,
  quality_rating  TINYINT NULL COMMENT '1-5 post-job QC',
  qc_notes        TEXT NULL,
  created_by      INT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (supplier_id)    REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (project_id)     REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (print_order_id) REFERENCES print_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (booking_id)     REFERENCES bookings(id) ON DELETE SET NULL,
  INDEX idx_spo_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 11: FINANCE — INVOICES, PAYMENTS, SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference          VARCHAR(30) NOT NULL UNIQUE COMMENT 'INV-2026-0001',
  organisation_id    INT UNSIGNED NOT NULL,
  project_id         INT UNSIGNED NULL,
  quote_id           INT UNSIGNED NULL,
  booking_id         INT UNSIGNED NULL,
  print_order_id     INT UNSIGNED NULL,
  subscription_id    INT UNSIGNED NULL,
  type               ENUM('standard','proforma','deposit','recurring','credit_note') NOT NULL DEFAULT 'standard',
  title              VARCHAR(255) NULL,
  -- currency: amounts stored in `currency`; fx locked at issue for historical accuracy
  currency           CHAR(3) NOT NULL DEFAULT 'TZS',
  fx_rate_to_tzs     DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
  fx_captured_at     TIMESTAMP NULL,
  subtotal_cents     BIGINT NOT NULL DEFAULT 0,
  discount_cents     BIGINT NOT NULL DEFAULT 0,
  vat_rate           DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  vat_cents          BIGINT NOT NULL DEFAULT 0,
  withholding_percent DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT 'TZ withholding tax where applicable',
  withholding_cents  BIGINT NOT NULL DEFAULT 0,
  total_cents        BIGINT NOT NULL DEFAULT 0,
  paid_cents         BIGINT NOT NULL DEFAULT 0,
  balance_cents      BIGINT NOT NULL DEFAULT 0,
  issue_date         DATE NOT NULL,
  due_date           DATE NOT NULL,
  status             ENUM('draft','sent','viewed','partial','paid','overdue','cancelled','refunded')
                     NOT NULL DEFAULT 'draft',
  -- Tanzania fiscalisation (TRA EFDMS). Populated when a fiscal receipt is raised.
  fiscal_receipt_no  VARCHAR(60) NULL,
  fiscal_verification_code VARCHAR(120) NULL,
  fiscal_device_no   VARCHAR(60) NULL,
  fiscalised_at      TIMESTAMP NULL,
  seller_tin         VARCHAR(32) NULL,
  seller_vrn         VARCHAR(32) NULL,
  buyer_tin          VARCHAR(32) NULL,
  buyer_vrn          VARCHAR(32) NULL,
  notes              TEXT NULL,
  terms              TEXT NULL,
  payment_instructions TEXT NULL,
  public_token       CHAR(48) NULL UNIQUE,
  sent_at            TIMESTAMP NULL,
  viewed_at          TIMESTAMP NULL,
  paid_at            TIMESTAMP NULL,
  reminder_count     INT NOT NULL DEFAULT 0,
  last_reminder_at   TIMESTAMP NULL,
  created_by         INT UNSIGNED NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE RESTRICT,
  FOREIGN KEY (project_id)      REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (quote_id)        REFERENCES quotes(id) ON DELETE SET NULL,
  FOREIGN KEY (booking_id)      REFERENCES bookings(id) ON DELETE SET NULL,
  FOREIGN KEY (print_order_id)  REFERENCES print_orders(id) ON DELETE SET NULL,
  INDEX idx_inv_org (organisation_id),
  INDEX idx_inv_status (status),
  INDEX idx_inv_due (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id    INT UNSIGNED NOT NULL,
  service_id    INT UNSIGNED NULL,
  description   VARCHAR(500) NOT NULL,
  detail        TEXT NULL,
  quantity      DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit          VARCHAR(30) NOT NULL DEFAULT 'item',
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  line_total_cents BIGINT NOT NULL DEFAULT 0,
  is_taxable    TINYINT(1) NOT NULL DEFAULT 1,
  sort_order    INT NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  INDEX idx_ii_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference         VARCHAR(30) NOT NULL UNIQUE COMMENT 'PAY-2026-0001',
  invoice_id        INT UNSIGNED NULL,
  organisation_id   INT UNSIGNED NULL,
  amount_cents      BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'TZS',
  fx_rate_to_tzs    DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
  -- Tanzanian rails: mobile money is dominant and split across three operators
  method            ENUM('mpesa','tigopesa_mixx','airtel_money','halopesa','bank_transfer','cash','cheque','card','other')
                    NOT NULL DEFAULT 'mpesa',
  provider_ref      VARCHAR(120) NULL COMMENT 'M-Pesa transaction id etc.',
  payer_name        VARCHAR(150) NULL,
  payer_phone       VARCHAR(40) NULL,
  paid_at           DATETIME NOT NULL,
  status            ENUM('pending','confirmed','failed','refunded') NOT NULL DEFAULT 'confirmed',
  notes             TEXT NULL,
  receipt_media_id  INT UNSIGNED NULL COMMENT 'uploaded proof of payment',
  recorded_by       INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id)      REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
  FOREIGN KEY (receipt_media_id) REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by)     REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pay_invoice (invoice_id),
  INDEX idx_pay_date (paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference       VARCHAR(30) NOT NULL UNIQUE,
  project_id      INT UNSIGNED NULL,
  supplier_id     INT UNSIGNED NULL,
  purchase_order_id INT UNSIGNED NULL,
  category        VARCHAR(100) NOT NULL COMMENT 'supplier|transport|materials|salary|rent|software|other',
  description     VARCHAR(500) NOT NULL,
  amount_cents    BIGINT NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'TZS',
  vat_cents       BIGINT NOT NULL DEFAULT 0,
  expense_date    DATE NOT NULL,
  is_billable     TINYINT(1) NOT NULL DEFAULT 0,
  is_reimbursed   TINYINT(1) NOT NULL DEFAULT 0,
  receipt_media_id INT UNSIGNED NULL,
  status          ENUM('pending','approved','rejected','paid') NOT NULL DEFAULT 'pending',
  approved_by     INT UNSIGNED NULL,
  recorded_by     INT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (receipt_media_id)  REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_exp_date (expense_date),
  INDEX idx_exp_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recurring revenue: retainers, hosting, AI subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference          VARCHAR(30) NOT NULL UNIQUE COMMENT 'SUB-2026-0001',
  organisation_id    INT UNSIGNED NOT NULL,
  package_id         INT UNSIGNED NULL,
  service_id         INT UNSIGNED NULL,
  name               VARCHAR(255) NOT NULL,
  description        TEXT NULL,
  type               ENUM('retainer','hosting','ai_assistant','maintenance','print_account','other')
                     NOT NULL DEFAULT 'retainer',
  amount_cents       BIGINT NOT NULL DEFAULT 0,
  currency           CHAR(3) NOT NULL DEFAULT 'TZS',
  billing_interval   ENUM('monthly','quarterly','annual') NOT NULL DEFAULT 'monthly',
  -- capacity-based, not "unlimited" — guards margin
  capacity_units     INT NULL COMMENT 'e.g. deliverables or hours included per cycle',
  capacity_used      INT NOT NULL DEFAULT 0,
  overage_rate_cents BIGINT NOT NULL DEFAULT 0,
  start_date         DATE NOT NULL,
  end_date           DATE NULL,
  next_billing_date  DATE NULL,
  last_billed_at     DATE NULL,
  auto_invoice       TINYINT(1) NOT NULL DEFAULT 1,
  -- Tanzanian rails note: Tigo Pesa/Mixx lacks recurring debit, so most clients
  -- are invoiced and push payment manually rather than being auto-debited.
  collection_method  ENUM('invoice_push','auto_debit','standing_order') NOT NULL DEFAULT 'invoice_push',
  status             ENUM('trial','active','past_due','paused','cancelled','expired') NOT NULL DEFAULT 'active',
  cancelled_at       TIMESTAMP NULL,
  cancellation_reason VARCHAR(500) NULL,
  min_term_months    INT NOT NULL DEFAULT 0,
  notes              TEXT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id)      REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (service_id)      REFERENCES services(id) ON DELETE SET NULL,
  INDEX idx_sub_org (organisation_id),
  INDEX idx_sub_status (status),
  INDEX idx_sub_billing (next_billing_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hosting / domain accounts — the "sticky infrastructure" revenue line
CREATE TABLE IF NOT EXISTS hosting_accounts (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organisation_id  INT UNSIGNED NOT NULL,
  subscription_id  INT UNSIGNED NULL,
  domain           VARCHAR(255) NOT NULL,
  type             ENUM('domain','hosting','email','ssl','maintenance') NOT NULL DEFAULT 'hosting',
  provider         VARCHAR(150) NULL,
  plan             VARCHAR(150) NULL,
  registered_at    DATE NULL,
  expires_at       DATE NULL,
  auto_renew       TINYINT(1) NOT NULL DEFAULT 1,
  cost_cents       BIGINT NOT NULL DEFAULT 0 COMMENT 'our cost',
  price_cents      BIGINT NOT NULL DEFAULT 0 COMMENT 'client price',
  currency         CHAR(3) NOT NULL DEFAULT 'TZS',
  nameservers      VARCHAR(500) NULL,
  status           ENUM('active','expiring','expired','suspended','cancelled') NOT NULL DEFAULT 'active',
  uptime_percent   DECIMAL(5,2) NULL,
  last_checked_at  TIMESTAMP NULL,
  notes            TEXT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  INDEX idx_host_org (organisation_id),
  INDEX idx_host_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FX rates, refreshed from a free public API and cached here
CREATE TABLE IF NOT EXISTS exchange_rates (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  base_currency CHAR(3) NOT NULL DEFAULT 'USD',
  quote_currency CHAR(3) NOT NULL DEFAULT 'TZS',
  rate          DECIMAL(18,6) NOT NULL,
  source        VARCHAR(100) NOT NULL DEFAULT 'open.er-api.com',
  is_manual     TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'admin override beats API',
  fetched_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_date    DATE NOT NULL,
  UNIQUE KEY uk_rate_day (base_currency, quote_currency, valid_date),
  INDEX idx_rate_date (valid_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 12: AI BUSINESS SYSTEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_assistants (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organisation_id   INT UNSIGNED NULL COMMENT 'NULL = Creative Engine own site assistant',
  subscription_id   INT UNSIGNED NULL,
  name              VARCHAR(150) NOT NULL,
  slug              VARCHAR(180) NOT NULL UNIQUE,
  description       TEXT NULL,
  avatar_media_id   INT UNSIGNED NULL,
  greeting          TEXT NULL,
  system_prompt     LONGTEXT NULL,
  -- provider-swappable: never hard-wire one vendor
  provider          VARCHAR(50) NOT NULL DEFAULT 'anthropic',
  model             VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-5',
  temperature       DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  max_tokens        INT NOT NULL DEFAULT 1024,
  channels          JSON NULL COMMENT 'array: website|whatsapp|messenger|qr_kiosk',
  -- guardrails (blueprint risk control: AI reliability / hallucination)
  fallback_message  TEXT NULL,
  escalation_email  VARCHAR(190) NULL,
  escalation_phone  VARCHAR(40) NULL,
  handoff_keywords  JSON NULL COMMENT 'phrases that force a human handoff',
  capture_leads     TINYINT(1) NOT NULL DEFAULT 1,
  require_kb_grounding TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'answer only from approved sources',
  theme_color       CHAR(7) NULL,
  widget_position   ENUM('bottom-right','bottom-left') NOT NULL DEFAULT 'bottom-right',
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  monthly_message_limit INT NULL,
  messages_this_month  INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (avatar_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_knowledge_items (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  assistant_id  INT UNSIGNED NOT NULL,
  title         VARCHAR(255) NOT NULL,
  content       LONGTEXT NOT NULL,
  source_type   ENUM('manual','faq','service','page','document','url') NOT NULL DEFAULT 'manual',
  source_ref    VARCHAR(255) NULL,
  media_id      INT UNSIGNED NULL,
  tags          JSON NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  priority      INT NOT NULL DEFAULT 0,
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP NULL,
  FOREIGN KEY (assistant_id) REFERENCES ai_assistants(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id)     REFERENCES media(id) ON DELETE SET NULL,
  INDEX idx_kb_assistant (assistant_id),
  FULLTEXT KEY ft_kb_content (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  assistant_id   INT UNSIGNED NOT NULL,
  session_token  CHAR(48) NOT NULL UNIQUE,
  channel        ENUM('website','whatsapp','messenger','qr_kiosk','api') NOT NULL DEFAULT 'website',
  visitor_name   VARCHAR(150) NULL,
  visitor_email  VARCHAR(190) NULL,
  visitor_phone  VARCHAR(40) NULL,
  user_id        INT UNSIGNED NULL,
  lead_id        INT UNSIGNED NULL,
  message_count  INT NOT NULL DEFAULT 0,
  was_escalated  TINYINT(1) NOT NULL DEFAULT 0,
  escalated_at   TIMESTAMP NULL,
  satisfaction   TINYINT NULL COMMENT '1-5 rating',
  ip_address     VARCHAR(45) NULL,
  user_agent     VARCHAR(255) NULL,
  started_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NULL,
  ended_at       TIMESTAMP NULL,
  FOREIGN KEY (assistant_id) REFERENCES ai_assistants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (lead_id)      REFERENCES leads(id) ON DELETE SET NULL,
  INDEX idx_conv_assistant (assistant_id),
  INDEX idx_conv_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  role            ENUM('user','assistant','system') NOT NULL,
  content         LONGTEXT NOT NULL,
  tokens_used     INT NULL,
  latency_ms      INT NULL,
  kb_items_used   JSON NULL COMMENT 'grounding citations',
  was_fallback    TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  INDEX idx_msg_conv (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 13: SERVICE REQUESTS (client portal self-service)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_requests (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference       VARCHAR(30) NOT NULL UNIQUE COMMENT 'REQ-2026-0001',
  organisation_id INT UNSIGNED NOT NULL,
  requested_by    INT UNSIGNED NULL,
  service_id      INT UNSIGNED NULL,
  subscription_id INT UNSIGNED NULL,
  project_id      INT UNSIGNED NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NULL,
  attachments     JSON NULL,
  priority        ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  status          ENUM('submitted','acknowledged','in_progress','awaiting_client','completed','rejected','cancelled')
                  NOT NULL DEFAULT 'submitted',
  consumes_capacity TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'draws down subscription allowance',
  capacity_units  INT NOT NULL DEFAULT 1,
  assigned_to     INT UNSIGNED NULL,
  due_date        DATE NULL,
  completed_at    TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by)    REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (service_id)      REFERENCES services(id) ON DELETE SET NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)      REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to)     REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_req_org (organisation_id),
  INDEX idx_req_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 14: SYSTEM — NOTIFICATIONS, AUDIT, FORMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(80) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NULL,
  link_url    VARCHAR(500) NULL,
  entity_type VARCHAR(50) NULL,
  entity_id   INT UNSIGNED NULL,
  icon        VARCHAR(50) NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  read_at     TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_log (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id       INT UNSIGNED NULL,
  action        VARCHAR(80) NOT NULL COMMENT 'created|updated|deleted|restored|login|export',
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     INT UNSIGNED NULL,
  entity_label  VARCHAR(255) NULL,
  changes       JSON NULL COMMENT 'before/after diff',
  ip_address    VARCHAR(45) NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_log_entity (entity_type, entity_id),
  INDEX idx_log_user (user_id),
  INDEX idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_submissions (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  form_key     VARCHAR(80) NOT NULL COMMENT 'contact|newsletter|careers|brief',
  payload      JSON NOT NULL,
  lead_id      INT UNSIGNED NULL,
  ip_address   VARCHAR(45) NULL,
  user_agent   VARCHAR(255) NULL,
  is_spam      TINYINT(1) NOT NULL DEFAULT 0,
  is_handled   TINYINT(1) NOT NULL DEFAULT 0,
  handled_by   INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id)    REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_form_key (form_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email          VARCHAR(190) NOT NULL UNIQUE,
  name           VARCHAR(150) NULL,
  status         ENUM('pending','subscribed','unsubscribed','bounced') NOT NULL DEFAULT 'subscribed',
  confirm_token  CHAR(48) NULL,
  source         VARCHAR(50) NULL DEFAULT 'website',
  subscribed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_templates (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  template_key VARCHAR(80) NOT NULL UNIQUE,
  name         VARCHAR(150) NOT NULL,
  subject      VARCHAR(255) NOT NULL,
  body_html    LONGTEXT NOT NULL,
  variables    JSON NULL COMMENT 'available merge tags',
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sequential reference number generator per entity/year
CREATE TABLE IF NOT EXISTS counters (
  entity      VARCHAR(40) NOT NULL,
  year        INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (entity, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DEFERRED FOREIGN KEYS (created after all tables exist)
-- ============================================================================
ALTER TABLE organisations
  ADD CONSTRAINT fk_org_logo FOREIGN KEY (logo_media_id) REFERENCES media(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_org_manager FOREIGN KEY (account_manager_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_user_avatar FOREIGN KEY (avatar_media_id) REFERENCES media(id) ON DELETE SET NULL;

ALTER TABLE equipment
  ADD CONSTRAINT fk_equip_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE print_products
  ADD CONSTRAINT fk_printprod_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE print_orders
  ADD CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE invoices
  ADD CONSTRAINT fk_inv_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- VIEWS — dashboard aggregates
-- ============================================================================

-- Quarterly and annual amounts are normalised to a monthly figure. The
-- division yields a DECIMAL, so the result is cast back to an integer number
-- of cents — every other money value in the platform is an integer, and the
-- API would otherwise hand the client "450000000.0000".
CREATE OR REPLACE VIEW v_mrr AS
SELECT
  COUNT(*) AS active_subscriptions,
  CAST(COALESCE(SUM(
    CASE billing_interval
      WHEN 'monthly'   THEN amount_cents
      WHEN 'quarterly' THEN amount_cents / 3
      WHEN 'annual'    THEN amount_cents / 12
      ELSE 0
    END
  ), 0) AS SIGNED) AS mrr_cents
FROM subscriptions
WHERE status = 'active' AND deleted_at IS NULL;

CREATE OR REPLACE VIEW v_receivables AS
SELECT
  i.organisation_id,
  o.name AS organisation_name,
  COUNT(*)              AS open_invoices,
  SUM(i.balance_cents)  AS outstanding_cents,
  SUM(CASE WHEN i.due_date < CURDATE() THEN i.balance_cents ELSE 0 END) AS overdue_cents
FROM invoices i
JOIN organisations o ON o.id = i.organisation_id
WHERE i.status IN ('sent','viewed','partial','overdue') AND i.deleted_at IS NULL
GROUP BY i.organisation_id, o.name;

CREATE OR REPLACE VIEW v_equipment_utilisation AS
SELECT
  e.id,
  e.name,
  e.total_units,
  e.utilisation_days,
  e.replacement_value_cents,
  COALESCE(SUM(bi.line_total_cents), 0) AS lifetime_revenue_cents,
  CASE WHEN e.replacement_value_cents > 0
       THEN ROUND(COALESCE(SUM(bi.line_total_cents),0) / e.replacement_value_cents * 100, 2)
       ELSE NULL END AS payback_percent
FROM equipment e
LEFT JOIN booking_items bi ON bi.equipment_id = e.id
LEFT JOIN bookings b ON b.id = bi.booking_id AND b.status IN ('completed','returned')
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.name, e.total_units, e.utilisation_days, e.replacement_value_cents;
