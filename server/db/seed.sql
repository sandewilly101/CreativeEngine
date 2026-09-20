-- ============================================================================
-- CREATIVE ENGINE — SEED DATA
-- Realistic Tanzanian market data. All prices in TZS minor units (cents).
-- 1,000,000 cents = TZS 10,000. Reference: USD 1 ~ TZS 2,645 (Sept 2026)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- ROLES & PERMISSIONS
-- ---------------------------------------------------------------------------
INSERT INTO roles (id, slug, name, description, is_system) VALUES
  (1, 'admin',  'Administrator', 'Full platform control. Can create, read, update and delete everything.', 1),
  (2, 'staff',  'Staff',         'Internal team member. Scoped to their division and assigned work.', 1),
  (3, 'client', 'Client',        'External client. Sees only their own organisation''s records.', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO permissions (slug, module, description) VALUES
  ('dashboard.view','dashboard','View the admin dashboard'),
  ('users.view','users','View users'), ('users.create','users','Create users'),
  ('users.update','users','Edit users'), ('users.delete','users','Delete users'),
  ('roles.manage','users','Manage roles and permissions'),
  ('organisations.view','organisations','View client organisations'),
  ('organisations.create','organisations','Create organisations'),
  ('organisations.update','organisations','Edit organisations'),
  ('organisations.delete','organisations','Delete organisations'),
  ('leads.view','leads','View leads'), ('leads.create','leads','Create leads'),
  ('leads.update','leads','Edit leads'), ('leads.delete','leads','Delete leads'),
  ('quotes.view','quotes','View quotes'), ('quotes.create','quotes','Create quotes'),
  ('quotes.update','quotes','Edit quotes'), ('quotes.delete','quotes','Delete quotes'),
  ('quotes.send','quotes','Send quotes to clients'),
  ('projects.view','projects','View projects'), ('projects.create','projects','Create projects'),
  ('projects.update','projects','Edit projects'), ('projects.delete','projects','Delete projects'),
  ('tasks.view','tasks','View tasks'), ('tasks.create','tasks','Create tasks'),
  ('tasks.update','tasks','Edit tasks'), ('tasks.delete','tasks','Delete tasks'),
  ('deliverables.view','deliverables','View deliverables'),
  ('deliverables.create','deliverables','Upload deliverables'),
  ('deliverables.update','deliverables','Edit deliverables'),
  ('deliverables.delete','deliverables','Delete deliverables'),
  ('deliverables.approve','deliverables','Approve deliverables'),
  ('invoices.view','invoices','View invoices'), ('invoices.create','invoices','Create invoices'),
  ('invoices.update','invoices','Edit invoices'), ('invoices.delete','invoices','Delete invoices'),
  ('invoices.send','invoices','Send invoices'),
  ('payments.view','payments','View payments'), ('payments.create','payments','Record payments'),
  ('payments.update','payments','Edit payments'), ('payments.delete','payments','Delete payments'),
  ('expenses.view','expenses','View expenses'), ('expenses.create','expenses','Record expenses'),
  ('expenses.update','expenses','Edit expenses'), ('expenses.delete','expenses','Delete expenses'),
  ('expenses.approve','expenses','Approve expenses'),
  ('subscriptions.view','subscriptions','View subscriptions'),
  ('subscriptions.create','subscriptions','Create subscriptions'),
  ('subscriptions.update','subscriptions','Edit subscriptions'),
  ('subscriptions.delete','subscriptions','Delete subscriptions'),
  ('equipment.view','equipment','View equipment'), ('equipment.create','equipment','Add equipment'),
  ('equipment.update','equipment','Edit equipment'), ('equipment.delete','equipment','Delete equipment'),
  ('bookings.view','bookings','View bookings'), ('bookings.create','bookings','Create bookings'),
  ('bookings.update','bookings','Edit bookings'), ('bookings.delete','bookings','Delete bookings'),
  ('print.view','print','View print orders'), ('print.create','print','Create print orders'),
  ('print.update','print','Edit print orders'), ('print.delete','print','Delete print orders'),
  ('events.view','events','View events'), ('events.create','events','Create events'),
  ('events.update','events','Edit events'), ('events.delete','events','Delete events'),
  ('suppliers.view','suppliers','View suppliers'), ('suppliers.create','suppliers','Add suppliers'),
  ('suppliers.update','suppliers','Edit suppliers'), ('suppliers.delete','suppliers','Delete suppliers'),
  ('cms.view','cms','View site content'), ('cms.create','cms','Create site content'),
  ('cms.update','cms','Edit site content'), ('cms.delete','cms','Delete site content'),
  ('cms.publish','cms','Publish site content'),
  ('media.view','media','View media library'), ('media.upload','media','Upload media'),
  ('media.update','media','Edit media metadata'), ('media.delete','media','Delete media'),
  ('ai.view','ai','View AI assistants'), ('ai.create','ai','Create AI assistants'),
  ('ai.update','ai','Configure AI assistants'), ('ai.delete','ai','Delete AI assistants'),
  ('ai.conversations','ai','Read AI conversation logs'),
  ('requests.view','requests','View service requests'),
  ('requests.create','requests','Raise a service request'),
  ('requests.update','requests','Edit service requests'),
  ('requests.delete','requests','Delete service requests'),
  ('reports.view','reports','View reports'), ('reports.export','reports','Export reports'),
  ('settings.view','settings','View settings'), ('settings.update','settings','Change settings'),
  ('activity.view','activity','View the audit log')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Admin gets everything
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Client: read-only access to their own organisation's records, plus the
-- few things a client actually does — approve work and raise requests.
-- Every one of these endpoints additionally scopes rows to their own
-- organisation, so "view" here never means "view everyone's".
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE slug IN (
  'projects.view',
  'tasks.view',
  'deliverables.view','deliverables.approve',
  'invoices.view',
  'payments.view',
  'quotes.view',
  'subscriptions.view',
  'bookings.view',
  'print.view',
  'media.view',
  'organisations.view',
  'requests.view','requests.create','requests.update'
);

-- Staff: operational access, no destructive finance/settings powers
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE slug IN (
  'dashboard.view','organisations.view','organisations.update',
  'leads.view','leads.create','leads.update',
  'quotes.view','quotes.create','quotes.update','quotes.send',
  'projects.view','projects.create','projects.update',
  'tasks.view','tasks.create','tasks.update','tasks.delete',
  'deliverables.view','deliverables.create','deliverables.update',
  'invoices.view','invoices.create','invoices.update',
  'payments.view','payments.create',
  'expenses.view','expenses.create',
  'subscriptions.view',
  'requests.view','requests.create','requests.update',
  'equipment.view','equipment.update',
  'bookings.view','bookings.create','bookings.update',
  'print.view','print.create','print.update',
  'events.view','events.create','events.update',
  'suppliers.view','suppliers.create','suppliers.update',
  'cms.view','cms.create','cms.update',
  'media.view','media.upload','media.update',
  'ai.view','ai.conversations',
  'reports.view'
);

-- ---------------------------------------------------------------------------
-- SETTINGS
-- ---------------------------------------------------------------------------
INSERT INTO settings (group_key, setting_key, setting_value, value_type, label, is_public) VALUES
  ('brand','company_name','Creative Engine','string','Company name',1),
  ('brand','tagline','From Ideas to Impact.','string','Tagline',1),
  ('brand','promise','One partner. One engine. Everything from idea to execution.','string','Brand promise',1),
  ('brand','primary_color','#ccff01','string','Primary colour (lime)',1),
  ('brand','accent_color','#f74932','string','Accent colour (flame)',1),
  ('brand','secondary_color','#191919','string','Ink',1),
  ('contact','email','hello@creativeengine.co.tz','string','Primary email',1),
  ('contact','phone','+255 7XX XXX XXX','string','Primary phone',1),
  ('contact','whatsapp','+255 7XX XXX XXX','string','WhatsApp number',1),
  ('contact','address_line1','Plot 123, Nyerere Road','string','Address line 1',1),
  ('contact','city','Dar es Salaam','string','City',1),
  ('contact','country','Tanzania','string','Country',1),
  ('contact','working_hours','Mon–Fri 08:00–17:30 EAT','string','Working hours',1),
  ('social','facebook','https://facebook.com/creativeengine','string','Facebook',1),
  ('social','instagram','https://instagram.com/creativeengine','string','Instagram',1),
  ('social','linkedin','https://linkedin.com/company/creativeengine','string','LinkedIn',1),
  ('social','twitter','https://x.com/creativeengine','string','X / Twitter',1),
  ('social','youtube','https://youtube.com/@creativeengine','string','YouTube',1),
  ('social','tiktok','','string','TikTok',1),
  ('social','whatsapp','','string','WhatsApp channel',1),
  ('seo','default_title','Creative Engine — Integrated Creative, Digital, AI, Events & Production','string','Default meta title',1),
  ('seo','default_description','One partner for branding, websites, AI business systems, events, print and equipment hire in Tanzania. From ideas to impact.','string','Default meta description',1),
  ('finance','vat_rate','18.00','number','VAT rate (%)',0),
  ('finance','base_currency','TZS','string','Base currency',1),
  ('finance','display_currencies','["TZS","USD"]','json','Currencies shown to users',1),
  ('finance','company_tin','','string','Company TIN',0),
  ('finance','company_vrn','','string','Company VRN',0),
  ('finance','bank_name','CRDB Bank','string','Bank name',0),
  ('finance','bank_account','0000000000','string','Bank account',0),
  ('finance','payment_terms_days','30','number','Default payment terms (days)',0),
  ('finance','quote_validity_days','30','number','Quote validity (days)',0),
  ('finance','fx_provider','open.er-api.com','string','FX rate provider',0),
  ('finance','fx_auto_refresh','true','boolean','Auto-refresh FX daily',0),
  ('ai','default_provider','anthropic','string','Default AI provider',0),
  ('ai','default_model','claude-sonnet-5','string','Default AI model',0),
  ('ai','enabled','false','boolean','AI assistant enabled',0)
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ---------------------------------------------------------------------------
-- DIVISIONS — the five pillars
-- ---------------------------------------------------------------------------
INSERT INTO divisions (id, slug, code, name, tagline, description, icon, color_hex, revenue_model, sort_order) VALUES
  (1,'creative-marketing','01','Creative & Marketing',
   'Brands people remember.',
   'Brand identity, campaigns, social media, content, photography and video. We build the brand and keep it working every month.',
   'palette','#f74932','Project + monthly retainer',1),
  (2,'web-digital','02','Web & Digital Infrastructure',
   'Digital that stays up.',
   'Websites, domains, hosting, maintenance, SEO, e-commerce and analytics. We build it, then we keep it running.',
   'globe','#2f6fed','Setup + recurring subscription',2),
  (3,'ai-business-systems','03','AI Business Systems',
   'Respond faster. Capture more.',
   'AI assistants, chatbots, lead capture, knowledge systems and workflow automation — grounded in your approved information, with a human always one step away.',
   'cpu','#0f9488','Setup + monthly subscription',3),
  (4,'events-experiences','04','Events & Experiences',
   'Moments that move people.',
   'Conferences, launches, activations, exhibitions, stages and experiential campaigns — concept through to strike.',
   'sparkles','#8b46e0','Project + production margin',4),
  (5,'print-production','05','Print, Branding & Equipment',
   'Built, printed, delivered.',
   'Large format print, signage, merchandise, structures, AV and event equipment hire. The physical layer most agencies outsource and lose control of.',
   'printer','#d98200','Per order + daily hire',5)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------------------------------------------------------------------------
-- SERVICES
-- Pricing reflects the Tanzanian corporate market.
-- ---------------------------------------------------------------------------
INSERT INTO services (division_id, slug, name, short_description, description, pricing_model, base_price_cents, setup_fee_cents, recurring_interval, revision_limit, turnaround_days, is_featured, status, sort_order, deliverables) VALUES
  -- 01 Creative & Marketing
  (1,'brand-identity','Brand Identity & Logo Design','A complete visual identity: logo, colour, type, and the rules that keep it consistent.',
   'We start with positioning, not pixels. You receive a primary logo with variants, a colour and typography system, and a brand guideline document your team and every supplier can follow.',
   'from',350000000,0,'none',3,21,1,'published',1,
   '["Brand discovery workshop","Primary logo + 3 variants","Colour and typography system","Brand guidelines PDF","Social media kit","All source files"]'),
  (1,'brand-refresh','Brand Refresh','Modernise an existing brand without losing its equity.',
   'For brands that are known but tired. We keep what your market recognises and rebuild the rest.',
   'from',250000000,0,'none',3,18,0,'published',2,
   '["Brand audit","Refreshed identity system","Updated guidelines","Rollout asset pack"]'),
  (1,'social-media-retainer','Social Media Retainer','Monthly content, planned, produced and posted.',
   'A capacity-based monthly retainer — a fixed number of deliverables per month, not an open-ended "unlimited" promise that degrades quality.',
   'monthly',180000000,50000000,'monthly',2,0,1,'published',3,
   '["Monthly content calendar","16 static posts or 12 posts + 4 reels","Copywriting in English and Swahili","Community management","Monthly performance report"]'),
  (1,'campaign-development','Campaign Development','A big idea, built to run across every channel.',
   'Concept, key visual, messaging architecture and channel adaptation for launches and always-on campaigns.',
   'from',600000000,0,'none',2,30,0,'published',4,
   '["Campaign concept and key visual","Messaging framework","Channel adaptations","Production-ready master files"]'),
  (1,'photography-video','Photography & Video Production','Corporate, product, event and campaign content.',
   'Full production: direction, shoot, edit and delivery in every aspect ratio you need.',
   'daily',120000000,0,'none',2,10,0,'published',5,
   '["Pre-production and shot list","Full shoot day with crew","Professional edit and colour","Delivery in all required formats"]'),
  (1,'content-copywriting','Content & Copywriting','Words that work, in English and Swahili.',
   'Website copy, campaign lines, scripts, profiles and reports — written for a Tanzanian audience, not translated at the last minute.',
   'from',80000000,0,'none',2,7,0,'published',6,
   '["Tone of voice guide","Page or asset copy","English and Swahili versions","Two rounds of revision"]'),

  -- 02 Web & Digital
  (2,'website-design-build','Website Design & Build','A fast, mobile-first website that earns its keep.',
   'Designed for how Tanzania actually browses: mobile-first, optimised for slower connections, and built so your team can update it without calling us.',
   'from',450000000,0,'none',3,35,1,'published',1,
   '["UX wireframes and design","Responsive build","CMS so you can edit content","SEO foundations","Analytics setup","Training session"]'),
  (2,'ecommerce-build','E-Commerce Build','Sell online, with the payment rails your customers use.',
   'Full online store with mobile money integration — M-Pesa, Mixx by Yas and Airtel Money — alongside card and bank transfer.',
   'from',850000000,0,'none',3,45,0,'published',2,
   '["Store design and build","Product catalogue setup","Mobile money + card payments","Delivery and tax configuration","Staff training"]'),
  (2,'hosting-care','Hosting & Web Care','Hosting, backups, updates and uptime monitoring.',
   'The recurring layer that keeps a website alive. Monthly backups, security patching, uptime monitoring and a small change allowance each month.',
   'monthly',12000000,0,'monthly',NULL,0,1,'published',3,
   '["Managed hosting","Daily backups","Security updates","Uptime monitoring","Up to 2 hours of changes per month","Monthly uptime report"]'),
  (2,'domain-registration','Domain Registration & Management','.co.tz and international domains, managed for you.',
   'Registration, renewal tracking and DNS management so a domain never lapses quietly.',
   'from',8000000,0,'annual',NULL,2,0,'published',4,
   '["Domain registration or transfer","DNS management","Renewal monitoring","Email routing setup"]'),
  (2,'seo-growth','SEO & Search Growth','Get found by people already searching.',
   'Technical fixes, content strategy and local search optimisation for the Tanzanian market.',
   'monthly',95000000,80000000,'monthly',NULL,0,0,'published',5,
   '["Technical SEO audit and fixes","Keyword strategy","Monthly content recommendations","Google Business Profile optimisation","Monthly ranking report"]'),
  (2,'analytics-reporting','Analytics & Reporting','Know what is actually working.',
   'Proper measurement setup and a monthly report a non-technical director can read.',
   'monthly',45000000,60000000,'monthly',NULL,0,0,'published',6,
   '["Analytics and tag setup","Conversion tracking","Custom dashboard","Monthly insight report"]'),

  -- 03 AI Business Systems
  (3,'ai-customer-assistant','AI Customer Assistant','Answers customer questions 24/7, from your approved information.',
   'Not a gimmick chatbot. It answers only from the knowledge you approve, hands off to a human the moment a question is high-value or unclear, and logs every conversation so you can see what customers actually ask.',
   'monthly',150000000,250000000,'monthly',NULL,14,1,'published',1,
   '["Knowledge base built from your content","Website and WhatsApp deployment","Human handoff rules","Conversation dashboard","Monthly tuning","Guardrails against invented answers"]'),
  (3,'ai-lead-engine','AI Lead Engine','Captures enquiries and routes qualified prospects to sales.',
   'The assistant qualifies, captures contact details, and pushes the lead straight into your pipeline with a notification to the right person.',
   'monthly',180000000,300000000,'monthly',NULL,14,1,'published',2,
   '["Qualification question flow","CRM lead capture","Instant team notification","Lead scoring","Source and conversion reporting"]'),
  (3,'whatsapp-business-setup','WhatsApp Business Assistant','Meet customers where they already are.',
   'WhatsApp Business API setup with an assistant that handles FAQs, captures leads and escalates to your team.',
   'monthly',120000000,200000000,'monthly',NULL,21,0,'published',3,
   '["WhatsApp Business API setup","Message templates approved by Meta","Automated responses","Human takeover inbox","Broadcast capability"]'),
  (3,'workflow-automation','Workflow Automation','Stop rekeying the same information.',
   'We connect the systems you already use so enquiries, quotes, approvals and reminders move without a person copying data between them.',
   'from',400000000,0,'none',2,21,0,'published',4,
   '["Process mapping","Automation build","System integrations","Documentation and handover"]'),
  (3,'knowledge-base-build','Knowledge Base Build','One approved source of truth.',
   'We turn your scattered documents, FAQs and staff knowledge into a structured base your assistant and your team can both use.',
   'from',280000000,0,'none',2,18,0,'published',5,
   '["Content audit","Structured knowledge base","Approval workflow","Ongoing update process"]'),

  -- 04 Events & Experiences
  (4,'event-concept-design','Event Concept & Design','The idea, the look, and how the room should feel.',
   'Concept development, theming, stage and space design, and full 3D visualisation so you approve the look before anything is built.',
   'from',500000000,0,'none',2,21,1,'published',1,
   '["Event concept and theme","3D stage and space visualisation","Floor plan and flow","Branding application across touchpoints","Production-ready drawings"]'),
  (4,'event-production','Full Event Production','End-to-end delivery, one accountable partner.',
   'We manage everything from supplier coordination to strike: stage, sound, lighting, LED, branding, crew and run sheet.',
   'quote_only',0,0,'none',NULL,0,1,'published',2,
   '["Production management","Supplier coordination and vetting","Technical direction","On-site crew","Run sheet and rehearsal","Post-event report"]'),
  (4,'brand-activation','Brand Activation & Roadshow','Take the brand to where people are.',
   'Mall activations, market roadshows, sampling and experiential campaigns with trained brand ambassadors.',
   'from',750000000,0,'none',2,25,0,'published',3,
   '["Activation concept","Stand or unit design and build","Brand ambassador recruitment and training","Logistics across regions","Data capture","Performance report"]'),
  (4,'exhibition-stands','Exhibition Stand Design & Build','Stand out on a crowded floor.',
   'Custom stand design, 3D visualisation, fabrication, install and dismantle for trade fairs including DITF Sabasaba.',
   'from',900000000,0,'none',2,30,0,'published',4,
   '["Stand design with 3D visuals","Fabrication","Transport and installation","On-site support","Dismantle and storage"]'),
  (4,'conference-management','Conference & Delegate Management','Registration, badges, check-in, done properly.',
   'Online registration, QR check-in, badge printing and delegate communication — the parts that go wrong when they are handled on a spreadsheet.',
   'from',400000000,0,'none',2,20,0,'published',5,
   '["Branded registration page","Automated confirmations","QR code check-in","On-site badge printing","Attendance reporting"]'),

  -- 05 Print, Branding & Equipment
  (5,'large-format-print','Large Format Printing','Banners, backdrops, billboards and signage.',
   'Indoor and outdoor large format on the right substrate for the job, with finishing that survives a Dar es Salaam rainy season.',
   'per_sqm',3500000,0,'none',NULL,3,1,'published',1,
   '["Artwork preflight check","Printing on selected substrate","Finishing: hemming, eyelets, pole pockets","Delivery or installation"]'),
  (5,'signage-fabrication','Signage & Fabrication','Built signage that lasts.',
   'Illuminated signs, 3D lettering, ACP cladding, reception branding and wayfinding — surveyed, fabricated and installed.',
   'quote_only',0,0,'none',NULL,14,0,'published',2,
   '["Site survey","Design and technical drawings","Fabrication","Installation","Warranty"]'),
  (5,'branded-merchandise','Branded Merchandise & Apparel','Corporate gifts and staff uniforms.',
   'T-shirts, polos, caps, mugs, notebooks, bottles and bags — branded by the right method for the item and the quantity.',
   'per_unit',1500000,0,'none',NULL,7,0,'published',3,
   '["Product sourcing","Branding method advice","Pre-production sample","Bulk production","Delivery"]'),
  (5,'vehicle-branding','Vehicle Branding','Turn the fleet into moving media.',
   'Full or partial vehicle wraps in cast vinyl, fitted by trained installers.',
   'from',180000000,0,'none',2,7,0,'published',4,
   '["Vehicle template and design","Cast vinyl printing","Professional installation","Care instructions"]'),
  (5,'led-screen-hire','LED Screen Hire','Indoor and outdoor LED walls.',
   'P2.6 to P4.8 indoor and P4.8 to P6 outdoor LED, priced per square metre per day, with crew, processing and rigging.',
   'daily',35000000,0,'none',NULL,0,1,'published',5,
   '["LED panels and processing","Rigging or ground support","Technician on site","Transport","Content testing"]'),
  (5,'av-sound-lighting','AV, Sound & Lighting Hire','Sound and light that fits the room.',
   'Line array and point source PA, stage lighting, trussing, and the crew who know how to fly it safely.',
   'daily',65000000,0,'none',NULL,0,0,'published',6,
   '["System design for the venue","Delivery and rigging","Operation during event","Strike and return"]'),
  (5,'event-furniture-structures','Event Furniture & Structures','Tents, staging, furniture and barriers.',
   'Marquees, stretch tents, modular staging, furniture, carpeting and crowd barriers.',
   'daily',25000000,0,'none',NULL,0,0,'published',7,
   '["Site assessment","Delivery and setup","On-site standby","Dismantle and collection"]')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------------------------------------------------------------------------
-- PACKAGES — flagship offers (capacity-priced, never "unlimited")
-- ---------------------------------------------------------------------------
INSERT INTO packages (slug, name, tagline, description, division_id, tier, price_cents, setup_fee_cents, billing_interval, capacity_note, is_featured, status, sort_order, features) VALUES
  ('launch-pad','Launch Pad','Everything a new brand needs to open its doors.',
   'For businesses starting from zero: identity, a website that works on a phone, and the first month of social presence.',
   NULL,'starter',1200000000,0,'once','One-off project, 6–8 weeks',1,'published',1,
   '[{"label":"Brand identity and guidelines","included":true},{"label":"5-page mobile-first website","included":true},{"label":"Domain and 12 months hosting","included":true},{"label":"Business cards and letterhead","included":true},{"label":"Social media profile setup","included":true},{"label":"One month social content (12 posts)","included":true},{"label":"AI customer assistant","included":false},{"label":"Event production","included":false}]'),
  ('always-on','Always On','The monthly engine: content, hosting and an assistant that never sleeps.',
   'Our core retainer. Predictable monthly output across social, web care and an AI assistant capturing leads around the clock.',
   NULL,'growth',450000000,150000000,'monthly','16 content deliverables + 2 hours web changes per month',1,'published',2,
   '[{"label":"16 social deliverables per month","included":true},{"label":"Hosting, backups and security","included":true},{"label":"2 hours of website changes monthly","included":true},{"label":"AI customer assistant (1,000 conversations)","included":true},{"label":"Monthly performance report","included":true},{"label":"Quarterly strategy session","included":true},{"label":"Print account with agreed rates","included":true},{"label":"Event production","included":false}]'),
  ('event-engine','Event Engine','One partner from concept to strike.',
   'For organisations running recurring events: concept, registration, production, print and equipment under a single accountable team.',
   4,'enterprise',0,0,'once','Priced per event; annual agreements available',1,'published',3,
   '[{"label":"Event concept and 3D visualisation","included":true},{"label":"Branded registration page and QR check-in","included":true},{"label":"Full production management","included":true},{"label":"Stage, LED, sound and lighting","included":true},{"label":"All event print and signage","included":true},{"label":"Photography and video coverage","included":true},{"label":"Post-event content package","included":true},{"label":"Vetted supplier network","included":true}]'),
  ('enterprise-partnership','Enterprise Partnership','Deep account partnership across all five divisions.',
   'An annual agreement with agreed rates, priority capacity and a dedicated account team across creative, digital, AI, events and production.',
   NULL,'enterprise',0,0,'annual','Scoped annually against your calendar',0,'published',4,
   '[{"label":"Dedicated account director","included":true},{"label":"Agreed annual rate card","included":true},{"label":"Priority production capacity","included":true},{"label":"All five divisions on one contract","included":true},{"label":"Quarterly business review","included":true},{"label":"Consolidated monthly invoicing","included":true}]')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------------------------------------------------------------------------
-- EQUIPMENT
-- ---------------------------------------------------------------------------
INSERT INTO equipment_categories (id, slug, name, description, icon, sort_order) VALUES
  (1,'led-screens','LED Screens','Indoor and outdoor LED video walls','monitor',1),
  (2,'sound','Sound & PA','Line array, point source, mixing and microphones','volume-2',2),
  (3,'lighting','Lighting','Stage, architectural and effect lighting','lightbulb',3),
  (4,'staging','Staging & Trussing','Modular stage decks, trussing and rigging','layers',4),
  (5,'tents','Tents & Structures','Marquees, stretch tents and gazebos','tent',5),
  (6,'furniture','Furniture','Seating, tables, lounge and cocktail furniture','armchair',6),
  (7,'power','Power & Distribution','Generators and power distribution','zap',7),
  (8,'av','AV & Presentation','Projectors, screens, switchers and comms','projector',8)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO equipment (category_id, sku, slug, name, description, total_units, daily_rate_cents, half_day_rate_cents, weekly_rate_cents, unit_of_measure, deposit_cents, replacement_value_cents, requires_operator, operator_day_rate_cents, requires_transport, transport_cents, min_rental_days, ownership, status, is_published, is_featured, specifications) VALUES
  (1,'LED-P39-IN','led-p39-indoor','Indoor LED Wall P3.9','High resolution indoor LED, ideal for conference backdrops and stage screens.',
   96,35000000,22000000,190000000,'sqm',500000000,11520000000,1,15000000,1,25000000,1,'owned','available',1,1,
   '[{"label":"Pixel pitch","value":"3.9mm"},{"label":"Panel size","value":"500 x 500mm"},{"label":"Brightness","value":"1,200 nits"},{"label":"Refresh rate","value":"3,840Hz"},{"label":"Power per sqm","value":"280W average"}]'),
  (1,'LED-P49-OUT','led-p49-outdoor','Outdoor LED Wall P4.8','Weather-rated outdoor LED for activations, stages and roadshows.',
   72,42000000,26000000,230000000,'sqm',600000000,10440000000,1,15000000,1,35000000,1,'owned','available',1,1,
   '[{"label":"Pixel pitch","value":"4.8mm"},{"label":"Panel size","value":"500 x 1000mm"},{"label":"Brightness","value":"5,500 nits"},{"label":"IP rating","value":"IP65 front / IP54 rear"}]'),
  (2,'SND-LA-12','line-array-12','Line Array System (12 Box)','Full line array PA suitable for audiences up to 3,000.',
   2,180000000,110000000,950000000,'set',800000000,4500000000,1,18000000,1,60000000,1,'owned','available',1,1,
   '[{"label":"Configuration","value":"12 x dual 10-inch elements"},{"label":"Subwoofers","value":"4 x 18-inch"},{"label":"Coverage","value":"Up to 3,000 pax"},{"label":"Includes","value":"Amplification, processing, cabling"}]'),
  (2,'SND-PA-500','pa-system-500','PA System (500 Pax)','Point source PA for meetings, launches and mid-size functions.',
   4,65000000,40000000,340000000,'set',250000000,1200000000,0,0,1,30000000,1,'owned','available',1,0,
   '[{"label":"Tops","value":"4 x 15-inch"},{"label":"Subs","value":"2 x 18-inch"},{"label":"Mixer","value":"16-channel digital"},{"label":"Microphones","value":"4 wireless handheld"}]'),
  (3,'LGT-MH-SPOT','moving-head-spot','Moving Head Spot (Per Unit)','LED moving head spot for stage and architectural lighting.',
   24,12000000,8000000,62000000,'unit',80000000,380000000,0,0,1,0,1,'owned','available',1,0,
   '[{"label":"Source","value":"200W LED"},{"label":"Gobos","value":"7 rotating + 9 static"},{"label":"Control","value":"DMX512"}]'),
  (3,'LGT-PAR-RGBW','led-par-rgbw','LED PAR Can RGBW (Per Unit)','Wash lighting for stage, tent and uplighting.',
   60,4500000,3000000,24000000,'unit',25000000,95000000,0,0,1,0,1,'owned','available',1,0,
   '[{"label":"Source","value":"18 x 10W RGBW"},{"label":"Beam angle","value":"25 degrees"},{"label":"Control","value":"DMX / standalone"}]'),
  (4,'STG-DECK-2X1','stage-deck','Stage Deck 2m x 1m','Modular stage deck with adjustable legs.',
   80,3500000,2500000,18000000,'unit',15000000,85000000,0,0,1,0,1,'owned','available',1,0,
   '[{"label":"Size","value":"2000 x 1000mm"},{"label":"Load","value":"750kg per sqm"},{"label":"Heights","value":"400 / 600 / 800 / 1000mm"},{"label":"Surface","value":"Anti-slip"}]'),
  (4,'TRS-BOX-3M','truss-box-3m','Box Truss 3m Section','290mm aluminium box truss for rigging and structures.',
   40,5500000,3500000,28000000,'unit',30000000,180000000,0,0,1,0,1,'owned','available',1,0,
   '[{"label":"Section","value":"290 x 290mm"},{"label":"Length","value":"3000mm"},{"label":"Material","value":"6082-T6 aluminium"}]'),
  (5,'TNT-STR-10X15','stretch-tent-10x15','Stretch Tent 10m x 15m','Waterproof stretch tent, fast to rig and good in wind.',
   3,220000000,0,1150000000,'unit',400000000,3200000000,1,12000000,1,80000000,1,'owned','available',1,1,
   '[{"label":"Coverage","value":"150 sqm"},{"label":"Capacity","value":"150 seated / 250 standing"},{"label":"Material","value":"Waterproof stretch fabric"},{"label":"Setup","value":"3–4 hours"}]'),
  (6,'FRN-TIF-CHR','tiffany-chair','Tiffany Chair (Per Unit)','Standard event chair with cushion.',
   500,350000,0,1800000,'unit',0,4500000,0,0,1,0,1,'owned','available',1,0,
   '[{"label":"Material","value":"Resin frame"},{"label":"Includes","value":"Seat cushion"},{"label":"Colours","value":"White, gold, clear"}]'),
  (6,'FRN-RND-TBL','round-table-10','Round Table (10 Seater)','1.8m round banquet table.',
   60,1200000,0,6000000,'unit',0,28000000,0,0,1,0,1,'owned','available',1,0,
   '[{"label":"Diameter","value":"1800mm"},{"label":"Seats","value":"10"},{"label":"Linen","value":"Available separately"}]'),
  (7,'PWR-GEN-60','generator-60kva','Generator 60 kVA (Silent)','Silent diesel generator with distribution.',
   2,145000000,0,760000000,'unit',300000000,4800000000,1,20000000,1,70000000,1,'owned','available',1,0,
   '[{"label":"Output","value":"60 kVA / 48 kW"},{"label":"Noise","value":"Under 65dB at 7m"},{"label":"Runtime","value":"8 hours per tank"},{"label":"Includes","value":"Distribution board and cabling"}]'),
  (8,'AV-PROJ-10K','projector-10000','Projector 10,000 Lumens','Bright projector for large rooms and daylight venues.',
   3,95000000,60000000,500000000,'unit',200000000,1800000000,1,15000000,1,25000000,1,'owned','available',1,0,
   '[{"label":"Brightness","value":"10,000 ANSI lumens"},{"label":"Resolution","value":"WUXGA 1920 x 1200"},{"label":"Lens","value":"Interchangeable"}]')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------------------------------------------------------------------------
-- PRINT PRODUCTS
-- Large format priced per square metre; merchandise per unit.
-- ---------------------------------------------------------------------------
INSERT INTO print_products (slug, name, category, description, pricing_basis, base_price_cents, min_order_qty, min_charge_cents, turnaround_days, bleed_mm, safe_margin_mm, min_dpi, is_published, is_featured, sort_order, substrates, finishing_options, size_presets) VALUES
  ('outdoor-banner','Outdoor Banner','banner','Weather-resistant PVC banner for outdoor use.',
   'per_sqm',3500000,1,7000000,3,15.00,30.00,100,1,1,1,
   '[{"name":"Frontlit PVC 440gsm","price_modifier_cents":0,"unit":"sqm"},{"name":"Frontlit PVC 510gsm","price_modifier_cents":800000,"unit":"sqm"},{"name":"Mesh PVC (windy sites)","price_modifier_cents":1200000,"unit":"sqm"},{"name":"Blockout PVC (double sided)","price_modifier_cents":2000000,"unit":"sqm"}]',
   '[{"name":"Hemming all round","price_cents":350000,"unit":"metre"},{"name":"Eyelets every 500mm","price_cents":50000,"unit":"each"},{"name":"Pole pockets","price_cents":600000,"unit":"metre"},{"name":"Reinforced corners","price_cents":200000,"unit":"each"},{"name":"Rope threading","price_cents":250000,"unit":"metre"}]',
   '[{"label":"3m x 1m","width_mm":3000,"height_mm":1000},{"label":"4m x 1m","width_mm":4000,"height_mm":1000},{"label":"6m x 3m","width_mm":6000,"height_mm":3000},{"label":"8m x 4m","width_mm":8000,"height_mm":4000}]'),
  ('roll-up-banner','Roll-Up Banner','banner','Portable retractable banner stand with carry bag.',
   'per_unit',18000000,1,18000000,2,5.00,25.00,150,1,1,2,
   '[{"name":"Standard economy base","price_modifier_cents":0,"unit":"unit"},{"name":"Premium wide base","price_modifier_cents":8000000,"unit":"unit"},{"name":"Double sided","price_modifier_cents":12000000,"unit":"unit"}]',
   '[{"name":"Carry bag","price_cents":0,"unit":"each"},{"name":"LED spotlight","price_cents":4500000,"unit":"each"}]',
   '[{"label":"850mm x 2000mm","width_mm":850,"height_mm":2000},{"label":"1000mm x 2000mm","width_mm":1000,"height_mm":2000},{"label":"1200mm x 2000mm","width_mm":1200,"height_mm":2000}]'),
  ('backdrop-wall','Backdrop / Media Wall','banner','Step-and-repeat backdrop for press walls and photo moments.',
   'per_sqm',4200000,1,25000000,3,20.00,40.00,120,1,1,3,
   '[{"name":"Fabric tension (wrinkle-free)","price_modifier_cents":1500000,"unit":"sqm"},{"name":"Frontlit PVC","price_modifier_cents":0,"unit":"sqm"},{"name":"Fabric with aluminium frame","price_modifier_cents":4500000,"unit":"sqm"}]',
   '[{"name":"Silicone edge (SEG)","price_cents":800000,"unit":"metre"},{"name":"Aluminium frame","price_cents":2500000,"unit":"metre"},{"name":"Carry case","price_cents":6000000,"unit":"each"}]',
   '[{"label":"2.4m x 2.4m","width_mm":2400,"height_mm":2400},{"label":"3m x 2.4m","width_mm":3000,"height_mm":2400},{"label":"4m x 2.4m","width_mm":4000,"height_mm":2400},{"label":"6m x 3m","width_mm":6000,"height_mm":3000}]'),
  ('vinyl-signage','Vinyl Signage & Stickers','signage','Cut or printed vinyl for windows, walls and vehicles.',
   'per_sqm',4800000,1,5000000,3,5.00,10.00,150,1,0,4,
   '[{"name":"Monomeric vinyl (short term)","price_modifier_cents":0,"unit":"sqm"},{"name":"Polymeric vinyl (3-5 years)","price_modifier_cents":1500000,"unit":"sqm"},{"name":"Cast vinyl (vehicle)","price_modifier_cents":3500000,"unit":"sqm"},{"name":"One-way vision (windows)","price_modifier_cents":2200000,"unit":"sqm"},{"name":"Frosted etch effect","price_modifier_cents":2000000,"unit":"sqm"}]',
   '[{"name":"Contour cutting","price_cents":600000,"unit":"metre"},{"name":"Lamination (UV protection)","price_cents":900000,"unit":"sqm"},{"name":"Application tape","price_cents":300000,"unit":"sqm"},{"name":"Professional installation","price_cents":2500000,"unit":"sqm"}]',
   '[{"label":"A3 (297 x 420mm)","width_mm":297,"height_mm":420},{"label":"A2 (420 x 594mm)","width_mm":420,"height_mm":594},{"label":"1m x 1m","width_mm":1000,"height_mm":1000},{"label":"Custom","width_mm":0,"height_mm":0}]'),
  ('branded-tshirt','Branded T-Shirt','apparel','Cotton t-shirt branded by screen print, DTF or embroidery.',
   'per_unit',1500000,10,15000000,7,0.00,0.00,300,1,1,5,
   '[{"name":"180gsm cotton round neck","price_modifier_cents":0,"unit":"unit"},{"name":"200gsm premium cotton","price_modifier_cents":400000,"unit":"unit"},{"name":"Polo shirt pique","price_modifier_cents":900000,"unit":"unit"},{"name":"Dri-fit polyester","price_modifier_cents":600000,"unit":"unit"}]',
   '[{"name":"Screen print 1 colour (front)","price_cents":250000,"unit":"each"},{"name":"Screen print full colour","price_cents":600000,"unit":"each"},{"name":"DTF transfer (photographic)","price_cents":700000,"unit":"each"},{"name":"Embroidery (left chest)","price_cents":900000,"unit":"each"},{"name":"Back print","price_cents":400000,"unit":"each"},{"name":"Individual polybagging","price_cents":50000,"unit":"each"}]',
   '[{"label":"Left chest (100 x 100mm)","width_mm":100,"height_mm":100},{"label":"A4 front (210 x 297mm)","width_mm":210,"height_mm":297},{"label":"A3 back (297 x 420mm)","width_mm":297,"height_mm":420}]'),
  ('business-cards','Business Cards','stationery','Standard corporate business cards.',
   'tiered',12000000,100,12000000,3,3.00,5.00,300,1,0,6,
   '[{"name":"350gsm matt art","price_modifier_cents":0,"unit":"pack"},{"name":"400gsm premium","price_modifier_cents":4000000,"unit":"pack"},{"name":"Textured / linen","price_modifier_cents":7000000,"unit":"pack"}]',
   '[{"name":"Matt lamination both sides","price_cents":3000000,"unit":"pack"},{"name":"Gloss lamination","price_cents":2500000,"unit":"pack"},{"name":"Spot UV","price_cents":8000000,"unit":"pack"},{"name":"Rounded corners","price_cents":3500000,"unit":"pack"},{"name":"Gold foiling","price_cents":12000000,"unit":"pack"}]',
   '[{"label":"90 x 50mm (standard)","width_mm":90,"height_mm":50},{"label":"85 x 55mm (EU)","width_mm":85,"height_mm":55}]'),
  ('branded-mug','Branded Mug','merchandise','Ceramic mug with full colour sublimation print.',
   'per_unit',900000,12,10800000,5,0.00,0.00,300,1,0,7,
   '[{"name":"White ceramic 11oz","price_modifier_cents":0,"unit":"unit"},{"name":"Colour inside/handle","price_modifier_cents":300000,"unit":"unit"},{"name":"Magic colour-changing","price_modifier_cents":900000,"unit":"unit"},{"name":"Travel tumbler","price_modifier_cents":1800000,"unit":"unit"}]',
   '[{"name":"Full wrap print","price_cents":200000,"unit":"each"},{"name":"Gift box","price_cents":250000,"unit":"each"}]',
   '[{"label":"Wrap (200 x 85mm)","width_mm":200,"height_mm":85},{"label":"One side (90 x 85mm)","width_mm":90,"height_mm":85}]'),
  ('vehicle-wrap','Vehicle Branding','vehicle','Partial or full vehicle wrap in cast vinyl.',
   'per_sqm',9500000,1,150000000,7,10.00,20.00,150,1,0,8,
   '[{"name":"Cast vinyl with lamination","price_modifier_cents":0,"unit":"sqm"},{"name":"Reflective vinyl","price_modifier_cents":4500000,"unit":"sqm"},{"name":"Colour change wrap","price_modifier_cents":3000000,"unit":"sqm"}]',
   '[{"name":"Professional installation","price_cents":3500000,"unit":"sqm"},{"name":"Old wrap removal","price_cents":2000000,"unit":"sqm"},{"name":"Window perforated vinyl","price_cents":4000000,"unit":"sqm"}]',
   '[{"label":"Door panel pair","width_mm":1800,"height_mm":900},{"label":"Full sedan","width_mm":0,"height_mm":0},{"label":"Full van / bus","width_mm":0,"height_mm":0}]')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------------------------------------------------------------------------
-- CMS CONTENT
-- ---------------------------------------------------------------------------
INSERT INTO post_categories (id, slug, name, description, color_hex, sort_order) VALUES
  (1,'insights','Insights','Thinking on brand, marketing and growth in Tanzania','#E85D2A',1),
  (2,'ai-automation','AI & Automation','Practical AI for Tanzanian businesses','#14B8A6',2),
  (3,'events','Events','Lessons from the production floor','#A855F7',3),
  (4,'case-studies','Case Studies','How we solved it','#2563EB',4),
  (5,'news','Company News','What is happening at Creative Engine','#F59E0B',5)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO faqs (question, answer, category, sort_order, use_in_ai_kb) VALUES
  ('What does Creative Engine actually do?','We are one partner for five things most businesses currently buy from five different suppliers: creative and marketing, websites and digital infrastructure, AI business systems, events and experiences, and print, branding and equipment hire. The point is that you stop coordinating suppliers and start briefing one team.','general',1,1),
  ('Where are you based?','Our studio is in Dar es Salaam, and we deliver across Tanzania — Arusha, Mwanza, Dodoma, Zanzibar and beyond. For work outside Dar we build travel and logistics into the quote transparently.','general',2,1),
  ('Do you work with small businesses or only large corporates?','Both. Our Launch Pad package is built for businesses starting out, while our Enterprise Partnership is designed for organisations running continuous campaigns and events. What matters is that the scope is clear.','general',3,1),
  ('How do you price your work?','Projects are quoted with a fixed scope and a stated number of revisions. Retainers are priced on capacity — a set number of deliverables each month — rather than an "unlimited" promise, because unlimited scope is what quietly destroys quality. Print is per square metre or per unit, and equipment is per day.','pricing',4,1),
  ('Do you charge VAT?','Yes. All prices are quoted exclusive of VAT unless stated, and VAT is applied at the standard Tanzanian rate of 18% on the invoice. If your organisation is VAT-registered, give us your TIN and VRN and they will appear on your tax invoice.','pricing',5,1),
  ('Can I pay by M-Pesa?','Yes. We accept M-Pesa, Mixx by Yas, Airtel Money, bank transfer and cash. For monthly retainers we issue an invoice before each cycle rather than debiting you automatically, so you always approve the payment.','pricing',6,1),
  ('Do you quote in USD?','We can. Our base currency is the Tanzanian shilling, but every quote and invoice can be issued in USD, with the exchange rate recorded on the document so the figures stay accurate later.','pricing',7,1),
  ('How long does a website take?','A standard business website takes about five weeks from approved brief to launch: one week for structure and wireframes, two for design, one for build, and one for content loading, testing and training. E-commerce takes longer.','digital',8,1),
  ('Will I be able to update the website myself?','Yes. Every site we build comes with a content management system and a training session for your team. You should not have to call an agency to change a phone number.','digital',9,1),
  ('Is the AI assistant going to make things up about my business?','That is the risk we design against. The assistant answers only from a knowledge base you approve, and when it is unsure it says so and offers a human instead of guessing. You can read every conversation it has had.','ai',10,1),
  ('Can the AI assistant work on WhatsApp?','Yes, and for most Tanzanian businesses that is where it belongs, since that is where customers already message you. We handle the WhatsApp Business API setup and Meta template approvals.','ai',11,1),
  ('How far in advance should I book equipment?','Two to four weeks for standard equipment, and longer during peak season around Sabasaba, December and the conference calendar. LED walls and line array systems book out earliest.','equipment',12,1),
  ('What happens if equipment is damaged at my event?','Every booking has a stated deposit and, where relevant, a damage waiver. We inspect equipment out and back, record its condition on the booking, and only charge for damage beyond fair wear, with the report shared with you.','equipment',13,1),
  ('What file format should I send for printing?','PDF with fonts outlined, CMYK colour, and the bleed stated on the product page — usually 10–20mm for large format. We run a preflight check on every file and tell you before printing if resolution or colour will cause a problem.','print',14,1),
  ('How many revisions do I get?','It depends on the service, and the number is always written on your quote — typically two or three rounds. Beyond that we quote additional rounds rather than absorbing them silently, which is how scope creep gets priced honestly.','general',15,1)
ON DUPLICATE KEY UPDATE answer = VALUES(answer);

INSERT INTO menu_items (menu_key, label, url, sort_order) VALUES
  ('header','Home','/',1),
  ('header','What We Do','/services',2),
  ('header','Work','/work',3),
  ('header','Packages','/packages',4),
  ('header','Equipment Hire','/equipment',5),
  ('header','Print Shop','/print',6),
  ('header','Insights','/insights',7),
  ('header','About','/about',8),
  ('header','Contact','/contact',9),
  ('footer_1','Creative & Marketing','/services/creative-marketing',1),
  ('footer_1','Web & Digital','/services/web-digital',2),
  ('footer_1','AI Business Systems','/services/ai-business-systems',3),
  ('footer_1','Events & Experiences','/services/events-experiences',4),
  ('footer_1','Print & Equipment','/services/print-production',5),
  ('footer_2','About Us','/about',1),
  ('footer_2','Our Work','/work',2),
  ('footer_2','Insights','/insights',3),
  ('footer_2','Careers','/careers',4),
  ('footer_2','Contact','/contact',5),
  ('legal','Privacy Policy','/privacy',1),
  ('legal','Terms of Service','/terms',2)
ON DUPLICATE KEY UPDATE label = VALUES(label);

INSERT INTO email_templates (template_key, name, subject, body_html, variables) VALUES
  ('welcome','Client Welcome','Welcome to Creative Engine, {{first_name}}',
   '<p>Hi {{first_name}},</p><p>Your Creative Engine client portal is ready. You can track projects, approve work, view invoices and request services in one place.</p><p><a href="{{portal_url}}">Open your portal</a></p><p>— The Creative Engine team</p>',
   '["first_name","portal_url"]'),
  ('quote_sent','Quote Sent','Your quote {{reference}} from Creative Engine',
   '<p>Hi {{contact_name}},</p><p>Your quote <strong>{{reference}}</strong> for {{title}} is ready, totalling {{total}}.</p><p>It is valid until {{valid_until}}.</p><p><a href="{{quote_url}}">View and accept the quote</a></p>',
   '["contact_name","reference","title","total","valid_until","quote_url"]'),
  ('invoice_sent','Invoice Sent','Invoice {{reference}} from Creative Engine',
   '<p>Hi {{contact_name}},</p><p>Invoice <strong>{{reference}}</strong> for {{total}} is now due on {{due_date}}.</p><p><a href="{{invoice_url}}">View invoice</a></p><p>We accept M-Pesa, Mixx by Yas, Airtel Money and bank transfer.</p>',
   '["contact_name","reference","total","due_date","invoice_url"]'),
  ('invoice_reminder','Payment Reminder','Reminder: invoice {{reference}} is due',
   '<p>Hi {{contact_name}},</p><p>A gentle reminder that invoice <strong>{{reference}}</strong> for {{balance}} was due on {{due_date}}.</p><p><a href="{{invoice_url}}">View invoice</a></p>',
   '["contact_name","reference","balance","due_date","invoice_url"]'),
  ('approval_request','Approval Request','{{deliverable_name}} is ready for your review',
   '<p>Hi {{contact_name}},</p><p><strong>{{deliverable_name}}</strong> is ready for review on {{project_name}}.</p><p><a href="{{review_url}}">Review and comment</a></p>',
   '["contact_name","deliverable_name","project_name","review_url"]'),
  ('lead_notification','New Lead Alert','New enquiry from {{contact_name}}',
   '<p>A new enquiry has arrived via {{source}}.</p><ul><li>Name: {{contact_name}}</li><li>Company: {{company_name}}</li><li>Phone: {{phone}}</li><li>Interested in: {{service}}</li></ul><p>{{message}}</p><p><a href="{{lead_url}}">Open in admin</a></p>',
   '["contact_name","company_name","phone","service","message","source","lead_url"]'),
  ('event_registration','Event Registration Confirmed','You are registered for {{event_name}}',
   '<p>Hi {{full_name}},</p><p>Your registration for <strong>{{event_name}}</strong> is confirmed.</p><p>{{venue}} — {{start_datetime}}</p><p>Your check-in code: <strong>{{ticket_code}}</strong>. Please have it ready at the door.</p>',
   '["full_name","event_name","venue","start_datetime","ticket_code"]'),
  ('booking_confirmed','Equipment Booking Confirmed','Booking {{reference}} confirmed',
   '<p>Hi {{contact_name}},</p><p>Your equipment booking <strong>{{reference}}</strong> is confirmed for {{start_date}} to {{end_date}} at {{venue}}.</p><p>Total: {{total}} (deposit {{deposit}}).</p>',
   '["contact_name","reference","start_date","end_date","venue","total","deposit"]')
ON DUPLICATE KEY UPDATE subject = VALUES(subject);

INSERT INTO exchange_rates (base_currency, quote_currency, rate, source, valid_date) VALUES
  ('USD','TZS',2645.000000,'seed',CURDATE())
ON DUPLICATE KEY UPDATE rate = VALUES(rate);

SET FOREIGN_KEY_CHECKS = 1;
