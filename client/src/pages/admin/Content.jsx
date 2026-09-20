import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, humanise, truncate, number } from '../../utils/format';
import { Badge } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Website content hub. Everything the public site renders is editable here:
 * divisions, services, packages, portfolio, blog, pages, team, testimonials,
 * client logos, FAQs, navigation and print products.
 */
export default function Content() {
  const [tab, setTab] = useState('services');
  const [lookups, setLookups] = useState({ divisions: [], categories: [], organisations: [] });
  const { currency } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/divisions?limit=20').catch(() => ({ data: [] })),
      api.get('/post-categories?limit=30').catch(() => ({ data: [] })),
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
    ]).then(([d, c, o]) => setLookups({
      divisions: d.data || [],
      categories: c.data || [],
      organisations: o.data || [],
    }));
  }, []);

  const divisionOptions = lookups.divisions.map((d) => ({ value: d.id, label: d.name }));

  /**
   * Grouped so related sections sit together instead of arriving in the order
   * the tables happened to be built: what you sell, what proves it, then the
   * structural bits you touch once a quarter.
   */
  const TAB_GROUPS = [
    {
      label: 'What we sell',
      tabs: [
        { key: 'services', label: 'Services' },
        { key: 'packages', label: 'Packages' },
        { key: 'print-products', label: 'Print products' },
        { key: 'divisions', label: 'Divisions' },
      ],
    },
    {
      label: 'Proof',
      tabs: [
        { key: 'portfolio', label: 'Portfolio' },
        { key: 'testimonials', label: 'Testimonials' },
        { key: 'client-logos', label: 'Client logos' },
        { key: 'team', label: 'Team' },
      ],
    },
    {
      label: 'Words & structure',
      tabs: [
        { key: 'posts', label: 'Blog' },
        { key: 'pages', label: 'Pages' },
        { key: 'faqs', label: 'FAQs' },
        { key: 'menu-items', label: 'Navigation' },
      ],
    },
  ];

  const configs = {
    services: {
      title: 'Services',
      description: 'The sellable catalogue. What appears here is what clients can read and request.',
      endpoint: '/services',
      defaultSort: 'sort_order:asc',
      modalSize: 'lg',
      layout: 'cards',
      reorderable: true,
      viewUrl: (row) => `/service/${row.slug}`,
      card: (row) => ({
        image: row.hero_thumb || row.hero_url,
        title: row.name,
        subtitle: row.short_description,
        dimmed: row.status !== 'published',
        meta: [
          row.division_name,
          Number(row.base_price_cents) > 0
            ? money(row.base_price_cents, currency)
            : 'On application',
          row.status !== 'published' ? humanise(row.status) : null,
        ],
      }),
      filters: [
        { name: 'division_id', label: 'All divisions', options: divisionOptions },
        { name: 'status', label: 'All statuses', options: STATUS_OPTIONS },
      ],
      columns: [
        {
          key: 'name',
          label: 'Service',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.name}</div>
              <div className="tiny muted truncate">{row.short_description}</div>
            </div>
          ),
        },
        {
          key: 'division_name',
          label: 'Division',
          render: (row) => (
            <span className="badge" style={{
              background: `${row.division_color || '#f74932'}18`,
              color: row.division_color || 'var(--orange-500)',
            }}>
              {row.division_name}
            </span>
          ),
        },
        {
          key: 'base_price_cents',
          label: 'Price',
          align: 'right',
          render: (row) => (Number(row.base_price_cents) > 0
            ? <div>
                <div className="bold">{money(row.base_price_cents, currency)}</div>
                <div className="tiny muted">
                  {row.recurring_interval !== 'none'
                    ? `per ${row.recurring_interval.replace('ly', '')}`
                    : humanise(row.pricing_model)}
                </div>
              </div>
            : <span className="muted">On application</span>),
        },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ],
      fields: [
        { name: 'name', label: 'Service name', required: true },
        { name: 'division_id', label: 'Division', type: 'select', required: true, options: divisionOptions },
        { name: 'short_description', label: 'One-line summary', hint: 'Shown on cards and in search results' },
        { name: 'description', label: 'Full description', type: 'textarea', rows: 6 },
        { name: 'hero_media_id', label: 'Hero image', type: 'media' },
        {
          name: 'deliverables',
          label: 'What the client receives',
          type: 'list',
          addLabel: 'Add a deliverable',
          placeholder: 'e.g. Brand guidelines PDF',
          hint: 'One line per item — these appear on the service page',
        },
        {
          name: 'exclusions',
          label: 'Explicitly not included',
          type: 'list',
          addLabel: 'Add an exclusion',
          placeholder: 'e.g. Printing costs',
          hint: 'Saying this plainly up front is what prevents the awkward conversation later',
        },
        {
          name: 'pricing_model',
          label: 'How it is priced',
          type: 'select',
          default: 'quote_only',
          options: [
            { value: 'fixed', label: 'Fixed price' },
            { value: 'from', label: 'Starting from' },
            { value: 'hourly', label: 'Per hour' },
            { value: 'daily', label: 'Per day' },
            { value: 'monthly', label: 'Per month' },
            { value: 'per_sqm', label: 'Per square metre' },
            { value: 'per_unit', label: 'Per unit' },
            { value: 'quote_only', label: 'Quote only' },
          ],
        },
        { name: 'base_price_cents', label: 'Price (cents)', type: 'money', hint: '1,000,000 = TZS 10,000' },
        { name: 'setup_fee_cents', label: 'One-off setup fee (cents)', type: 'money' },
        {
          name: 'recurring_interval',
          label: 'Recurring',
          type: 'select',
          default: 'none',
          options: [
            { value: 'none', label: 'Not recurring' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'annual', label: 'Annual' },
          ],
        },
        { name: 'min_term_months', label: 'Minimum term (months)', type: 'number', default: 0 },
        {
          name: 'revision_limit',
          label: 'Revision rounds included',
          type: 'number',
          hint: 'Stating this on the quote is what stops scope creep',
        },
        { name: 'turnaround_days', label: 'Typical turnaround (days)', type: 'number' },
        { name: 'is_featured', label: 'Feature on the homepage', type: 'checkbox' },
        { name: 'is_bookable', label: 'Clients can request it online', type: 'checkbox', default: 1 },
        { name: 'status', label: 'Status', type: 'select', default: 'draft', options: STATUS_OPTIONS },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
        { name: 'meta_title', label: 'SEO title' },
        { name: 'meta_description', label: 'SEO description', type: 'textarea', rows: 2 },
      ],
    },

    divisions: {
      title: 'Divisions',
      description: 'The five pillars of the business. These structure the whole site.',
      endpoint: '/divisions',
      defaultSort: 'sort_order:asc',
      columns: [
        {
          key: 'name',
          label: 'Division',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              <span style={{
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                background: `${row.color_hex}20`, color: row.color_hex,
                display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12,
              }}>{row.code}</span>
              <div style={{ minWidth: 0 }}>
                <div className="bold truncate">{row.name}</div>
                <div className="tiny muted truncate">{row.tagline}</div>
              </div>
            </div>
          ),
        },
        { key: 'revenue_model', label: 'Revenue model', render: (row) => <span className="small">{row.revenue_model}</span> },
        { key: 'service_count', label: 'Services', align: 'right', render: (row) => number(row.service_count) },
        {
          key: 'is_active',
          label: 'Active',
          render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Live' : 'Hidden'}</Badge>,
        },
      ],
      fields: [
        { name: 'name', label: 'Division name', required: true },
        { name: 'code', label: 'Code', required: true, hint: '01 to 05' },
        { name: 'tagline', label: 'Tagline' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
        { name: 'color_hex', label: 'Accent colour', placeholder: '#f74932' },
        { name: 'icon', label: 'Icon name' },
        { name: 'hero_media_id', label: 'Hero image', type: 'media' },
        { name: 'revenue_model', label: 'Revenue model', placeholder: 'Project + monthly retainer' },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
        { name: 'is_active', label: 'Active', type: 'checkbox', default: 1 },
      ],
    },

    packages: {
      title: 'Packages',
      description: 'Flagship offers with a clear price and a stated capacity.',
      endpoint: '/packages',
      defaultSort: 'sort_order:asc',
      modalSize: 'lg',
      layout: 'cards',
      reorderable: true,
      viewUrl: () => '/packages',
      card: (row) => ({
        image: row.hero_thumb || row.hero_url,
        title: row.name,
        subtitle: row.tagline || row.capacity_note,
        badge: row.is_featured ? 'Most popular' : null,
        dimmed: row.status !== 'published',
        meta: [
          humanise(row.tier),
          Number(row.price_cents) > 0
            ? `${money(row.price_cents, currency)} / ${row.billing_interval}`
            : 'On application',
          row.status !== 'published' ? humanise(row.status) : null,
        ],
      }),
      filters: [{ name: 'status', label: 'All statuses', options: STATUS_OPTIONS }],
      columns: [
        {
          key: 'name',
          label: 'Package',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.name}</div>
              <div className="tiny muted truncate">{row.tagline}</div>
            </div>
          ),
        },
        { key: 'tier', label: 'Tier', render: (row) => <Badge tone="neutral">{humanise(row.tier)}</Badge> },
        {
          key: 'price_cents',
          label: 'Price',
          align: 'right',
          render: (row) => (Number(row.price_cents) > 0
            ? <div>
                <div className="bold">{money(row.price_cents, currency)}</div>
                <div className="tiny muted">{row.billing_interval}</div>
              </div>
            : <span className="muted">On application</span>),
        },
        { key: 'capacity_note', label: 'Capacity', render: (row) => <span className="tiny">{truncate(row.capacity_note, 40)}</span> },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ],
      fields: [
        { name: 'name', label: 'Package name', required: true },
        { name: 'tagline', label: 'Tagline' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
        { name: 'division_id', label: 'Division', type: 'select', options: divisionOptions },
        {
          name: 'tier',
          label: 'Tier',
          type: 'select',
          default: 'starter',
          options: [
            { value: 'starter', label: 'Starter' },
            { value: 'growth', label: 'Growth' },
            { value: 'enterprise', label: 'Enterprise' },
            { value: 'custom', label: 'Custom' },
          ],
        },
        { name: 'price_cents', label: 'Price (cents)', type: 'money' },
        { name: 'setup_fee_cents', label: 'Setup fee (cents)', type: 'money' },
        {
          name: 'billing_interval',
          label: 'Billing',
          type: 'select',
          default: 'monthly',
          options: [
            { value: 'once', label: 'One-off' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'annual', label: 'Annual' },
          ],
        },
        {
          name: 'capacity_note',
          label: 'Capacity statement',
          hint: 'e.g. "16 deliverables per month" — say this plainly rather than implying unlimited',
        },
        {
          name: 'features',
          label: 'Feature list',
          type: 'list',
          addLabel: 'Add a feature',
          hint: 'Untick a feature to show it struck through — useful for saying what a cheaper tier leaves out',
          itemFields: [
            { name: 'label', label: 'Feature', flex: 3 },
            { name: 'included', label: 'Included', type: 'checkbox', default: true },
          ],
        },
        { name: 'hero_media_id', label: 'Image', type: 'media' },
        { name: 'is_featured', label: 'Mark as most popular', type: 'checkbox' },
        { name: 'status', label: 'Status', type: 'select', default: 'draft', options: STATUS_OPTIONS },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    portfolio: {
      title: 'Portfolio',
      description: 'Case studies. The single most persuasive thing on the site.',
      endpoint: '/portfolio',
      defaultSort: 'sort_order:asc',
      modalSize: 'lg',
      layout: 'cards',
      reorderable: true,
      viewUrl: (row) => `/work/${row.slug}`,
      card: (row) => ({
        image: row.cover_thumb || row.cover_url,
        title: row.title,
        subtitle: row.client_name || row.summary,
        badge: row.is_featured ? 'Featured' : null,
        dimmed: row.status !== 'published',
        meta: [
          row.division_name,
          row.project_date ? date(row.project_date) : null,
          row.status !== 'published' ? humanise(row.status) : null,
        ],
      }),
      filters: [
        { name: 'division_id', label: 'All divisions', options: divisionOptions },
        { name: 'status', label: 'All statuses', options: STATUS_OPTIONS },
      ],
      columns: [
        {
          key: 'title',
          label: 'Case study',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              {row.cover_thumb && (
                <img src={row.cover_thumb} alt="" style={{
                  width: 48, height: 36, objectFit: 'cover', borderRadius: 'var(--radius-sm)',
                }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div className="bold truncate">{row.title}</div>
                <div className="tiny muted truncate">{row.client_name || '—'}</div>
              </div>
            </div>
          ),
        },
        { key: 'division_name', label: 'Division', render: (row) => <span className="small">{row.division_name || '—'}</span> },
        { key: 'project_date', label: 'Date', render: (row) => <span className="small">{date(row.project_date)}</span> },
        { key: 'view_count', label: 'Views', align: 'right', render: (row) => number(row.view_count) },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ],
      fields: [
        { name: 'title', label: 'Project title', required: true },
        { name: 'client_name', label: 'Client name shown publicly' },
        {
          name: 'organisation_id',
          label: 'Link to client record',
          type: 'select',
          options: lookups.organisations.map((o) => ({ value: o.id, label: o.name })),
        },
        { name: 'division_id', label: 'Division', type: 'select', options: divisionOptions },
        { name: 'summary', label: 'Summary', type: 'textarea', rows: 2 },
        { name: 'challenge', label: 'The challenge', type: 'textarea', rows: 4 },
        { name: 'approach', label: 'Our approach', type: 'textarea', rows: 4 },
        { name: 'result', label: 'The result', type: 'textarea', rows: 4 },
        {
          name: 'metrics',
          label: 'Outcome metrics',
          type: 'list',
          addLabel: 'Add a metric',
          hint: 'Numbers persuade far more than adjectives do',
          itemFields: [
            { name: 'label', label: 'What it measures', flex: 2 },
            { name: 'value', label: 'Value', flex: 1 },
          ],
        },
        { name: 'cover_media_id', label: 'Cover image', type: 'media' },
        { name: 'gallery', label: 'Gallery media ids', type: 'json', placeholder: '[12, 13, 14]' },
        { name: 'video_url', label: 'Video URL' },
        { name: 'project_date', label: 'Project date', type: 'date' },
        { name: 'location', label: 'Location' },
        { name: 'is_featured', label: 'Feature on the homepage', type: 'checkbox' },
        { name: 'status', label: 'Status', type: 'select', default: 'draft', options: STATUS_OPTIONS },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    posts: {
      title: 'Blog',
      description: 'Insights and news. Publishing regularly is one of the cheapest ways to stay visible.',
      endpoint: '/posts',
      defaultSort: 'created_at:desc',
      modalSize: 'lg',
      filters: [
        { name: 'status', label: 'All statuses', options: STATUS_OPTIONS },
        {
          name: 'category_id',
          label: 'All categories',
          options: lookups.categories.map((c) => ({ value: c.id, label: c.name })),
        },
      ],
      columns: [
        {
          key: 'title',
          label: 'Article',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.title}</div>
              <div className="tiny muted truncate">{row.category_name || 'Uncategorised'} · {row.author_name || '—'}</div>
            </div>
          ),
        },
        { key: 'published_at', label: 'Published', render: (row) => <span className="small">{date(row.published_at)}</span> },
        { key: 'view_count', label: 'Views', align: 'right', render: (row) => number(row.view_count) },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ],
      fields: [
        { name: 'title', label: 'Title', required: true },
        {
          name: 'category_id',
          label: 'Category',
          type: 'select',
          options: lookups.categories.map((c) => ({ value: c.id, label: c.name })),
        },
        { name: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2, hint: 'Shown on cards and in search results' },
        { name: 'body', label: 'Article', type: 'textarea', rows: 14 },
        { name: 'cover_media_id', label: 'Cover image', type: 'media' },
        { name: 'tags', label: 'Tags', type: 'tags' },
        { name: 'is_featured', label: 'Feature it', type: 'checkbox' },
        { name: 'status', label: 'Status', type: 'select', default: 'draft', options: STATUS_OPTIONS },
        { name: 'published_at', label: 'Publish date', type: 'datetime-local' },
        { name: 'meta_title', label: 'SEO title' },
        { name: 'meta_description', label: 'SEO description', type: 'textarea', rows: 2 },
      ],
    },

    'print-products': {
      title: 'Print products',
      description: 'What the public print shop offers, and the options that drive its pricing.',
      endpoint: '/print-products',
      defaultSort: 'sort_order:asc',
      modalSize: 'lg',
      layout: 'cards',
      reorderable: true,
      // The print shop is one page rather than a page per product.
      viewUrl: () => '/print',
      card: (row) => ({
        image: row.cover_thumb || row.cover_url,
        title: row.name,
        subtitle: row.description,
        badge: row.is_featured ? 'Featured' : null,
        dimmed: !row.is_published,
        meta: [
          humanise(row.category),
          `${money(row.base_price_cents, currency)}${row.pricing_basis === 'per_sqm' ? '/sqm' : ''}`,
          `${row.turnaround_days}d`,
          !row.is_published ? 'Hidden' : null,
        ],
      }),
      columns: [
        {
          key: 'name',
          label: 'Product',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              {row.cover_thumb && (
                <img src={row.cover_thumb} alt="" style={{
                  width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-sm)',
                }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div className="bold truncate">{row.name}</div>
                <div className="tiny muted" style={{ textTransform: 'capitalize' }}>{row.category}</div>
              </div>
            </div>
          ),
        },
        {
          key: 'base_price_cents',
          label: 'Base price',
          align: 'right',
          render: (row) => (
            <div>
              <div className="bold">{money(row.base_price_cents, currency)}</div>
              <div className="tiny muted">{row.pricing_basis === 'per_sqm' ? 'per sqm' : 'per unit'}</div>
            </div>
          ),
        },
        { key: 'turnaround_days', label: 'Turnaround', align: 'right', render: (row) => `${row.turnaround_days}d` },
        {
          key: 'is_published',
          label: 'Published',
          render: (row) => <Badge tone={row.is_published ? 'success' : 'neutral'}>{row.is_published ? 'Live' : 'Hidden'}</Badge>,
        },
      ],
      fields: [
        { name: 'name', label: 'Product name', required: true },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          options: ['banner', 'signage', 'apparel', 'merchandise', 'stationery', 'vehicle']
            .map((c) => ({ value: c, label: humanise(c) })),
        },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'cover_media_id', label: 'Product image', type: 'media' },
        {
          name: 'pricing_basis',
          label: 'Priced by',
          type: 'select',
          default: 'per_sqm',
          options: [
            { value: 'per_sqm', label: 'Per square metre' },
            { value: 'per_unit', label: 'Per unit' },
            { value: 'tiered', label: 'Tiered' },
          ],
        },
        { name: 'base_price_cents', label: 'Base price (cents)', type: 'money', required: true },
        { name: 'min_order_qty', label: 'Minimum quantity', type: 'number', default: 1 },
        { name: 'min_charge_cents', label: 'Minimum charge (cents)', type: 'money', hint: 'Protects margin on small jobs' },
        {
          name: 'substrates',
          label: 'Material options',
          type: 'list',
          addLabel: 'Add a material',
          hint: 'The modifier is added to the base price, in cents. Leave it at 0 for the standard material.',
          itemFields: [
            { name: 'name', label: 'Material', flex: 3 },
            { name: 'price_modifier_cents', label: 'Extra (cents)', type: 'number', default: 0, flex: 1 },
            {
              name: 'unit',
              label: 'Per',
              type: 'select',
              default: 'sqm',
              flex: 1,
              options: [
                { value: 'sqm', label: 'per sqm' },
                { value: 'each', label: 'each' },
              ],
            },
          ],
        },
        {
          name: 'finishing_options',
          label: 'Finishing options',
          type: 'list',
          addLabel: 'Add a finishing option',
          hint: 'Charged on top of the material — eyelets each, hemming per metre',
          itemFields: [
            { name: 'name', label: 'Finishing', flex: 3 },
            { name: 'price_cents', label: 'Price (cents)', type: 'number', default: 0, flex: 1 },
            {
              name: 'unit',
              label: 'Per',
              type: 'select',
              default: 'each',
              flex: 1,
              options: [
                { value: 'each', label: 'each' },
                { value: 'metre', label: 'per metre' },
                { value: 'sqm', label: 'per sqm' },
              ],
            },
          ],
        },
        {
          name: 'size_presets',
          label: 'Standard sizes',
          type: 'list',
          addLabel: 'Add a size',
          hint: 'Offering the common sizes saves the client working out their own millimetres',
          itemFields: [
            { name: 'label', label: 'Name, e.g. 3m x 1m', flex: 2 },
            { name: 'width_mm', label: 'Width (mm)', type: 'number', flex: 1 },
            { name: 'height_mm', label: 'Height (mm)', type: 'number', flex: 1 },
          ],
        },
        { name: 'turnaround_days', label: 'Turnaround (days)', type: 'number', default: 3 },
        { name: 'rush_available', label: 'Rush service available', type: 'checkbox', default: 1 },
        { name: 'rush_surcharge_percent', label: 'Rush surcharge (%)', type: 'number', default: 50 },
        { name: 'bleed_mm', label: 'Bleed required (mm)', type: 'number', default: 10 },
        { name: 'safe_margin_mm', label: 'Safe margin (mm)', type: 'number', default: 20 },
        { name: 'min_dpi', label: 'Minimum DPI at final size', type: 'number', default: 100 },
        { name: 'artwork_notes', label: 'Artwork guidance', type: 'textarea' },
        { name: 'is_published', label: 'Show in the print shop', type: 'checkbox', default: 1 },
        { name: 'is_featured', label: 'Feature it', type: 'checkbox' },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    pages: {
      title: 'Pages',
      description: 'Standalone pages such as privacy, terms and careers.',
      endpoint: '/pages',
      defaultSort: 'sort_order:asc',
      modalSize: 'lg',
      columns: [
        {
          key: 'title',
          label: 'Page',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.title}</div>
              <div className="tiny muted mono">/{row.slug}</div>
            </div>
          ),
        },
        { key: 'template', label: 'Template', render: (row) => <span className="small">{humanise(row.template)}</span> },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ],
      fields: [
        { name: 'title', label: 'Page title', required: true },
        { name: 'slug', label: 'URL slug', hint: 'Leave blank to generate from the title' },
        { name: 'subtitle', label: 'Subtitle' },
        {
          name: 'template',
          label: 'Template',
          type: 'select',
          default: 'default',
          options: [
            { value: 'default', label: 'Default' },
            { value: 'landing', label: 'Landing page' },
            { value: 'contact', label: 'Contact' },
            { value: 'about', label: 'About' },
          ],
        },
        { name: 'body', label: 'Content', type: 'textarea', rows: 14 },
        { name: 'hero_media_id', label: 'Hero image', type: 'media' },
        { name: 'status', label: 'Status', type: 'select', default: 'draft', options: STATUS_OPTIONS },
        { name: 'noindex', label: 'Hide from search engines', type: 'checkbox' },
        { name: 'meta_title', label: 'SEO title' },
        { name: 'meta_description', label: 'SEO description', type: 'textarea', rows: 2 },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    team: {
      title: 'Team members',
      endpoint: '/team',
      defaultSort: 'sort_order:asc',
      layout: 'cards',
      reorderable: true,
      viewUrl: () => '/about',
      card: (row) => ({
        image: row.photo_thumb || row.photo_url,
        title: row.name,
        subtitle: row.role_title,
        dimmed: !row.is_published,
        meta: [row.division_name, !row.is_published ? 'Hidden' : null],
      }),
      columns: [
        {
          key: 'name',
          label: 'Person',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              {row.photo_url
                ? <img src={row.photo_url} alt="" className="avatar" />
                : <span className="avatar">{row.name?.charAt(0)}</span>}
              <div style={{ minWidth: 0 }}>
                <div className="bold truncate">{row.name}</div>
                <div className="tiny muted truncate">{row.role_title}</div>
              </div>
            </div>
          ),
        },
        { key: 'division_name', label: 'Division', render: (row) => <span className="small">{row.division_name || '—'}</span> },
        {
          key: 'is_published',
          label: 'Published',
          render: (row) => <Badge tone={row.is_published ? 'success' : 'neutral'}>{row.is_published ? 'Live' : 'Hidden'}</Badge>,
        },
      ],
      fields: [
        { name: 'name', label: 'Full name', required: true },
        { name: 'role_title', label: 'Job title', required: true },
        { name: 'bio', label: 'Short bio', type: 'textarea', rows: 3 },
        { name: 'photo_media_id', label: 'Photo', type: 'media' },
        { name: 'division_id', label: 'Division', type: 'select', options: divisionOptions },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'linkedin_url', label: 'LinkedIn' },
        { name: 'is_published', label: 'Show on the website', type: 'checkbox', default: 1 },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    testimonials: {
      title: 'Testimonials',
      endpoint: '/testimonials',
      defaultSort: 'sort_order:asc',
      layout: 'cards',
      reorderable: true,
      card: (row) => ({
        image: row.photo_thumb || row.photo_url || row.logo_url,
        title: row.author_name,
        subtitle: `“${truncate(row.quote, 90)}”`,
        badge: row.is_featured ? 'Featured' : null,
        dimmed: row.status !== 'published',
        meta: [
          [row.author_title, row.company].filter(Boolean).join(', ') || null,
          row.rating ? `${row.rating}/5` : null,
          row.status !== 'published' ? humanise(row.status) : null,
        ],
      }),
      columns: [
        {
          key: 'author_name',
          label: 'Author',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.author_name}</div>
              <div className="tiny muted truncate">{[row.author_title, row.company].filter(Boolean).join(', ')}</div>
            </div>
          ),
        },
        { key: 'quote', label: 'Quote', render: (row) => <span className="small">{truncate(row.quote, 80)}</span> },
        { key: 'rating', label: 'Rating', align: 'right', render: (row) => (row.rating ? `${row.rating}/5` : '—') },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ],
      fields: [
        { name: 'author_name', label: 'Author name', required: true },
        { name: 'author_title', label: 'Their job title' },
        { name: 'company', label: 'Company' },
        { name: 'quote', label: 'What they said', type: 'textarea', rows: 4, required: true },
        { name: 'rating', label: 'Rating out of 5', type: 'number' },
        { name: 'photo_media_id', label: 'Photo', type: 'media' },
        { name: 'logo_media_id', label: 'Company logo', type: 'media' },
        { name: 'is_featured', label: 'Feature on the homepage', type: 'checkbox' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          default: 'published',
          options: STATUS_OPTIONS,
        },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    'client-logos': {
      title: 'Client logos',
      description: 'The logo wall. Only add logos you have permission to display.',
      endpoint: '/client-logos',
      defaultSort: 'sort_order:asc',
      columns: [
        {
          key: 'name',
          label: 'Client',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              {row.logo_url && <img src={row.logo_url} alt="" style={{ height: 28, objectFit: 'contain' }} />}
              <span className="bold">{row.name}</span>
            </div>
          ),
        },
        { key: 'website_url', label: 'Website', render: (row) => <span className="small truncate">{row.website_url || '—'}</span> },
        {
          key: 'is_published',
          label: 'Published',
          render: (row) => <Badge tone={row.is_published ? 'success' : 'neutral'}>{row.is_published ? 'Live' : 'Hidden'}</Badge>,
        },
      ],
      fields: [
        { name: 'name', label: 'Client name', required: true },
        { name: 'logo_media_id', label: 'Logo', type: 'media' },
        { name: 'website_url', label: 'Website' },
        { name: 'is_published', label: 'Show on the website', type: 'checkbox', default: 1 },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    faqs: {
      title: 'FAQs',
      description: 'Answers shown on the site — and, when enabled, fed to the AI assistant.',
      endpoint: '/faqs',
      defaultSort: 'sort_order:asc',
      columns: [
        { key: 'question', label: 'Question', render: (row) => <span className="bold">{truncate(row.question, 70)}</span> },
        { key: 'category', label: 'Category', render: (row) => <span className="small">{row.category || '—'}</span> },
        {
          key: 'use_in_ai_kb',
          label: 'In AI knowledge',
          render: (row) => <Badge tone={row.use_in_ai_kb ? 'teal' : 'neutral'}>{row.use_in_ai_kb ? 'Yes' : 'No'}</Badge>,
        },
        {
          key: 'is_published',
          label: 'Published',
          render: (row) => <Badge tone={row.is_published ? 'success' : 'neutral'}>{row.is_published ? 'Live' : 'Hidden'}</Badge>,
        },
      ],
      fields: [
        { name: 'question', label: 'Question', required: true },
        { name: 'answer', label: 'Answer', type: 'textarea', rows: 5, required: true },
        { name: 'category', label: 'Category', placeholder: 'general, pricing, print…' },
        { name: 'division_id', label: 'Division', type: 'select', options: divisionOptions },
        {
          name: 'use_in_ai_kb',
          label: 'Let the AI assistant use this answer',
          type: 'checkbox',
          default: 1,
          hint: 'The assistant answers only from approved content like this',
        },
        { name: 'is_published', label: 'Show on the website', type: 'checkbox', default: 1 },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
      ],
    },

    'menu-items': {
      title: 'Navigation',
      description: 'The links in the header and footer.',
      endpoint: '/menu-items',
      defaultSort: 'sort_order:asc',
      filters: [
        {
          name: 'menu_key',
          label: 'All menus',
          options: [
            { value: 'header', label: 'Header' },
            { value: 'footer_1', label: 'Footer column 1' },
            { value: 'footer_2', label: 'Footer column 2' },
            { value: 'legal', label: 'Legal' },
          ],
        },
      ],
      columns: [
        { key: 'label', label: 'Label', render: (row) => <span className="bold">{row.label}</span> },
        { key: 'url', label: 'URL', render: (row) => <span className="small mono">{row.url}</span> },
        { key: 'menu_key', label: 'Menu', render: (row) => <span className="small">{humanise(row.menu_key)}</span> },
        { key: 'sort_order', label: 'Order', align: 'right' },
        {
          key: 'is_active',
          label: 'Active',
          render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Yes' : 'No'}</Badge>,
        },
      ],
      fields: [
        { name: 'label', label: 'Link text', required: true },
        { name: 'url', label: 'URL', required: true, placeholder: '/services' },
        {
          name: 'menu_key',
          label: 'Menu',
          type: 'select',
          default: 'header',
          options: [
            { value: 'header', label: 'Header' },
            { value: 'footer_1', label: 'Footer column 1' },
            { value: 'footer_2', label: 'Footer column 2' },
            { value: 'legal', label: 'Legal' },
          ],
        },
        {
          name: 'target',
          label: 'Opens in',
          type: 'select',
          default: '_self',
          options: [
            { value: '_self', label: 'Same tab' },
            { value: '_blank', label: 'New tab' },
          ],
        },
        { name: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
        { name: 'is_active', label: 'Active', type: 'checkbox', default: 1 },
      ],
    },
  };

  const config = configs[tab];

  return (
    <div className="content-hub">
      <div className="content-hub__head">
        <h2>Website content</h2>
        <p className="muted small">
          Everything the public site shows is edited here. Changes appear immediately once published.
        </p>
      </div>

      <nav className="content-tabs" aria-label="Content sections">
        {TAB_GROUPS.map((group) => (
          <div key={group.label} className="content-tabs__group">
            <span className="content-tabs__label">{group.label}</span>
            <div className="content-tabs__row">
              {group.tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`content-tab ${tab === t.key ? 'is-on' : ''}`}
                  aria-current={tab === t.key ? 'page' : undefined}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {config && <ResourceManager key={tab} hideHeading {...config} />}

      <style>{`
        .content-hub { display: flex; flex-direction: column; gap: var(--s6); }
        .content-hub__head { margin-bottom: calc(var(--s2) * -1); }

        /* Groups wrap onto their own rows, so nothing hides off-screen and
           no horizontal scrolling is needed to reach a section. */
        .content-tabs {
          display: flex; flex-wrap: wrap; gap: var(--s5) var(--s6);
          padding: var(--s4) var(--s5);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .content-tabs__group { display: flex; flex-direction: column; gap: 7px; }
        .content-tabs__label {
          font-size: 10.5px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: var(--ink-400);
        }
        .content-tabs__row { display: flex; flex-wrap: wrap; gap: 5px; }
        .content-tab {
          font-family: var(--ui); font-size: 13px; font-weight: 500;
          padding: 6px 13px;
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          background: var(--white); color: var(--ink-2);
          cursor: pointer; white-space: nowrap;
          transition: background 120ms var(--ease), color 120ms var(--ease),
                      border-color 120ms var(--ease);
        }
        .content-tab:hover { border-color: var(--ink-400); color: var(--ink); }
        .content-tab.is-on {
          background: var(--primary); color: var(--on-primary);
          border-color: var(--primary); font-weight: 600;
        }

        @media (max-width: 600px) {
          .content-tabs { gap: var(--s4); }
          .content-tabs__group { width: 100%; }
        }
      `}</style>
    </div>
  );
}
