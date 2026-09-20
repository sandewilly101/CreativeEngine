import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, humanise, number } from '../../utils/format';
import {
  Card, Button, DataTable, Pagination, SearchInput, Badge, Empty,
  Modal, Field, Input, Textarea, Select, Tabs, Alert,
} from '../../components/UI';
import MediaPicker from '../../components/MediaPicker';

const STATUSES = [
  'draft', 'quoted', 'artwork_pending', 'preflight', 'proof_sent',
  'approved', 'in_production', 'ready', 'delivered', 'completed', 'cancelled',
];

export default function PrintOrders() {
  const [tab, setTab] = useState('orders');
  const [rows, setRows] = useState([]);
  const [queue, setQueue] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ items: [] });
  const [quote, setQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [artworkFor, setArtworkFor] = useState(null);
  const [artworkMedia, setArtworkMedia] = useState(null);

  const { currency, toast } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/print-products?limit=100').catch(() => ({ data: [] })),
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
      api.get('/suppliers?category=printer&limit=50').catch(() => ({ data: [] })),
    ]).then(([p, o, s]) => {
      setProducts(p.data || []);
      setOrganisations(o.data || []);
      setSuppliers(s.data || []);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'queue') {
        const res = await api.get('/print-orders/production-queue');
        setQueue(res.data || []);
      } else {
        const res = await api.get(`/print-orders${api.qs({ page, search, status, sort: 'created_at:desc' })}`);
        setRows(res.data || []);
        setPagination(res.pagination || { page: 1, pages: 1, total: 0 });
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, status, toast]);

  useEffect(() => { load(); }, [load]);

  // Live pricing as the order is configured.
  useEffect(() => {
    if (!creating || !form.items?.length) { setQuote(null); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/print-orders/calculate', {
          items: form.items.filter((i) => i.product_id),
          is_rush: form.is_rush,
          delivery_cents: form.delivery_cents,
          installation_cents: form.installation_cents,
        });
        setQuote(res.data);
      } catch { /* preview only */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [creating, form]);

  const addLine = () => {
    setForm((f) => ({
      ...f,
      items: [...(f.items || []), { product_id: '', quantity: 1, width_mm: '', height_mm: '', sides: 'single', finishing: [] }],
    }));
  };

  const updateLine = (index, patch) => {
    setForm((f) => ({ ...f, items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  };

  const removeLine = (index) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  };

  const create = async () => {
    setSaving(true);
    try {
      const res = await api.post('/print-orders', form);
      toast(res.message, 'success');
      setCreating(false);
      setForm({ items: [] });
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row) => {
    try {
      const res = await api.get(`/print-orders/${row.id}`);
      setDetail(res.data);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const setOrderStatus = async (order, next) => {
    try {
      await api.patch(`/print-orders/${order.id}`, { status: next });
      toast('Status updated', 'success');
      load();
      if (detail) {
        const fresh = await api.get(`/print-orders/${order.id}`);
        setDetail(fresh.data);
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const uploadArtwork = async () => {
    if (!artworkMedia) return;
    try {
      const res = await api.post(
        `/print-orders/${artworkFor.orderId}/items/${artworkFor.itemId}/artwork`,
        { media_id: artworkMedia }
      );
      toast(res.message, res.data.preflight_status === 'failed' ? 'error' : 'success');
      if (res.data.warnings?.length) {
        res.data.warnings.forEach((w) => toast(w, 'error'));
      }
      setArtworkFor(null);
      setArtworkMedia(null);
      const fresh = await api.get(`/print-orders/${artworkFor.orderId}`);
      setDetail(fresh.data);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const selectedProduct = (productId) => products.find((p) => String(p.id) === String(productId));

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Print orders</h2>
          <p className="muted small">
            Large format is priced per square metre. Every file is preflighted before it reaches the press.
          </p>
        </div>
        <Button variant="primary" onClick={() => { setForm({ items: [], status: 'draft' }); setCreating(true); }}>
          + New print order
        </Button>
      </div>

      <Tabs
        tabs={[{ key: 'orders', label: 'All orders' }, { key: 'queue', label: 'Production queue', count: queue.length }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'orders' && (
        <Card>
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search reference or client…" />
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
            </select>
          </div>

          <DataTable
            loading={loading}
            rows={rows}
            onRowClick={openDetail}
            empty={<Empty title="No print orders yet" />}
            columns={[
              {
                key: 'reference',
                label: 'Order',
                render: (row) => (
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 'var(--s2)' }}>
                      <span className="bold mono">{row.reference}</span>
                      {row.is_rush === 1 && <span className="badge badge-danger">Rush</span>}
                    </div>
                    <div className="tiny muted truncate">{row.contact_name}</div>
                  </div>
                ),
              },
              {
                key: 'organisation_name',
                label: 'Client',
                render: (row) => <span className="small">{row.organisation_name || '—'}</span>,
              },
              { key: 'item_count', label: 'Items', align: 'right' },
              {
                key: 'required_by',
                label: 'Required by',
                render: (row) => <span className="small">{date(row.required_by)}</span>,
              },
              {
                key: 'total_cents',
                label: 'Total',
                align: 'right',
                render: (row) => money(row.total_cents, currency, row.currency),
              },
              {
                key: 'supplier_name',
                label: 'Supplier',
                render: (row) => <span className="tiny">{row.supplier_name || 'In-house'}</span>,
              },
              { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
            ]}
          />

          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
        </Card>
      )}

      {tab === 'queue' && (
        <Card>
          <div className="card-header">
            <div>
              <h4>Production queue</h4>
              <span className="tiny muted">Approved work, rush jobs first, then by deadline</span>
            </div>
          </div>
          <DataTable
            loading={loading}
            rows={queue}
            empty={<Empty title="Nothing in production" description="Approved orders appear here for the workshop." />}
            columns={[
              {
                key: 'description',
                label: 'Job',
                render: (row) => (
                  <div className="row" style={{ gap: 'var(--s3)' }}>
                    {row.artwork_thumb && (
                      <img src={row.artwork_thumb} alt="" style={{
                        width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)',
                      }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="bold truncate">{row.description}</div>
                      <div className="tiny muted">{row.reference} · {row.organisation_name || '—'}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'size',
                label: 'Size',
                render: (row) => (
                  <span className="small">
                    {row.width_mm ? `${row.width_mm} × ${row.height_mm}mm` : '—'}
                    {row.area_sqm && <div className="tiny muted">{row.area_sqm} sqm</div>}
                  </span>
                ),
              },
              { key: 'substrate', label: 'Material', render: (row) => <span className="small">{row.substrate || '—'}</span> },
              { key: 'quantity', label: 'Qty', align: 'right' },
              {
                key: 'preflight_status',
                label: 'Artwork',
                render: (row) => (
                  <Badge tone={
                    row.preflight_status === 'passed' ? 'success'
                      : row.preflight_status === 'warnings' ? 'warning'
                      : row.preflight_status === 'failed' ? 'danger' : 'neutral'
                  }>
                    {humanise(row.preflight_status)}
                  </Badge>
                ),
              },
              {
                key: 'required_by',
                label: 'Due',
                render: (row) => (
                  <div>
                    <div className="small">{date(row.required_by)}</div>
                    {row.is_rush === 1 && <div className="tiny" style={{ color: 'var(--danger)' }}>Rush</div>}
                  </div>
                ),
              },
              {
                key: 'production_status',
                label: 'Stage',
                render: (row) => <Badge tone="info">{humanise(row.production_status)}</Badge>,
              },
            ]}
          />
        </Card>
      )}

      {/* --------------------------------------------------------- NEW ORDER */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New print order"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create order</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 'var(--s6)' }} className="print-grid">
          <div>
            <div className="field-row">
              <Field label="Contact name" required>
                <Input value={form.contact_name || ''} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </Field>
              <Field label="Client">
                <Select
                  value={form.organisation_id || ''}
                  onChange={(e) => setForm({ ...form, organisation_id: e.target.value })}
                  placeholder="Walk-in"
                  options={organisations.map((o) => ({ value: o.id, label: o.name }))}
                />
              </Field>
            </div>

            <div className="field-row">
              <Field label="Phone">
                <Input value={form.contact_phone || ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </Field>
              <Field label="Required by">
                <Input type="date" value={form.required_by || ''} onChange={(e) => setForm({ ...form, required_by: e.target.value })} />
              </Field>
            </div>

            <div className="row-between" style={{ marginBlock: 'var(--s4)' }}>
              <h5 style={{ fontSize: 'var(--text-sm)' }}>Items</h5>
              <Button size="sm" variant="outline" onClick={addLine}>+ Add item</Button>
            </div>

            {(form.items || []).map((item, index) => {
              const product = selectedProduct(item.product_id);
              return (
                <div key={index} style={{
                  padding: 'var(--s4)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', marginBottom: 'var(--s3)',
                }}>
                  <div className="row-between" style={{ marginBottom: 'var(--s3)' }}>
                    <span className="tiny bold muted">Item {index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeLine(index)} style={{ color: 'var(--danger)' }}>
                      Remove
                    </Button>
                  </div>

                  <Field label="Product" required>
                    <Select
                      value={item.product_id || ''}
                      onChange={(e) => {
                        const next = selectedProduct(e.target.value);
                        updateLine(index, {
                          product_id: e.target.value,
                          description: next?.name || '',
                          substrate: next?.substrates?.[0]?.name || '',
                        });
                      }}
                      placeholder="Choose a product"
                      options={products.map((p) => ({
                        value: p.id,
                        label: `${p.name} — ${money(p.base_price_cents, 'TZS')}/${p.pricing_basis === 'per_sqm' ? 'sqm' : 'unit'}`,
                      }))}
                    />
                  </Field>

                  <Field label="Description">
                    <Input
                      value={item.description || ''}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="What this item is for"
                    />
                  </Field>

                  <div className="field-row">
                    <Field label="Quantity">
                      <Input
                        type="number" min={1} value={item.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                      />
                    </Field>
                    {product?.pricing_basis === 'per_sqm' && (
                      <>
                        <Field label="Width (mm)">
                          <Input
                            type="number" value={item.width_mm}
                            onChange={(e) => updateLine(index, { width_mm: e.target.value })}
                          />
                        </Field>
                        <Field label="Height (mm)">
                          <Input
                            type="number" value={item.height_mm}
                            onChange={(e) => updateLine(index, { height_mm: e.target.value })}
                          />
                        </Field>
                      </>
                    )}
                  </div>

                  {product?.substrates?.length > 0 && (
                    <Field label="Material">
                      <Select
                        value={item.substrate || ''}
                        onChange={(e) => updateLine(index, { substrate: e.target.value })}
                        options={product.substrates.map((s) => ({ value: s.name, label: s.name }))}
                      />
                    </Field>
                  )}

                  {product?.finishing_options?.length > 0 && (
                    <Field label="Finishing">
                      <div className="stack" style={{ gap: 'var(--s2)' }}>
                        {product.finishing_options.map((option) => {
                          const chosen = (item.finishing || []).find((f) => f.name === option.name);
                          return (
                            <div key={option.name} className="row" style={{ gap: 'var(--s2)' }}>
                              <label className="checkbox-row" style={{ flex: 1 }}>
                                <input
                                  type="checkbox"
                                  checked={!!chosen}
                                  onChange={(e) => {
                                    const current = item.finishing || [];
                                    updateLine(index, {
                                      finishing: e.target.checked
                                        ? [...current, { name: option.name, quantity: 1 }]
                                        : current.filter((f) => f.name !== option.name),
                                    });
                                  }}
                                />
                                <span className="small">
                                  {option.name}
                                  <span className="muted"> {money(option.price_cents, 'TZS')}/{option.unit}</span>
                                </span>
                              </label>
                              {chosen && (
                                <input
                                  className="input" type="number" min={1} value={chosen.quantity}
                                  onChange={(e) => updateLine(index, {
                                    finishing: item.finishing.map((f) => (
                                      f.name === option.name ? { ...f, quantity: Number(e.target.value) } : f
                                    )),
                                  })}
                                  style={{ width: 70 }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Field>
                  )}
                </div>
              );
            })}

            <label className="checkbox-row" style={{ marginTop: 'var(--s4)' }}>
              <input
                type="checkbox"
                checked={!!form.is_rush}
                onChange={(e) => setForm({ ...form, is_rush: e.target.checked })}
              />
              <span className="small">Rush job — surcharge applies</span>
            </label>

            <div className="field-row" style={{ marginTop: 'var(--s4)' }}>
              <Field label="Delivery charge (cents)">
                <Input
                  type="number" value={form.delivery_cents || ''}
                  onChange={(e) => setForm({ ...form, delivery_cents: Number(e.target.value) })}
                />
              </Field>
              <Field label="Installation (cents)">
                <Input
                  type="number" value={form.installation_cents || ''}
                  onChange={(e) => setForm({ ...form, installation_cents: Number(e.target.value) })}
                />
              </Field>
              <Field label="Supplier">
                <Select
                  value={form.supplier_id || ''}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  placeholder="In-house"
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
            </div>
          </div>

          <aside>
            <div className="card card-pad" style={{ background: 'var(--ink-50)' }}>
              <h5 style={{ fontSize: 'var(--text-sm)' }}>Estimate</h5>
              {quote ? (
                <>
                  <div className="stack tiny" style={{ gap: 6, marginTop: 'var(--s3)' }}>
                    <div className="row-between">
                      <span className="muted">Subtotal</span>
                      <span>{money(quote.subtotal_cents, currency)}</span>
                    </div>
                    {quote.rush_cents > 0 && (
                      <div className="row-between">
                        <span className="muted">Rush surcharge</span>
                        <span>{money(quote.rush_cents, currency)}</span>
                      </div>
                    )}
                    <div className="row-between">
                      <span className="muted">VAT</span>
                      <span>{money(quote.vat_cents, currency)}</span>
                    </div>
                  </div>
                  <div className="row-between" style={{
                    marginTop: 'var(--s3)', paddingTop: 'var(--s3)', borderTop: '2px solid var(--ink-800)',
                  }}>
                    <strong>Total</strong>
                    <strong>{money(quote.total_cents, currency)}</strong>
                  </div>

                  {quote.items?.map((line, i) => (
                    line.area_sqm ? (
                      <div key={i} className="tiny muted" style={{ marginTop: 'var(--s2)' }}>
                        Item {i + 1}: {line.area_sqm} sqm · bleed {line.bleed_mm}mm · min {line.min_dpi} DPI
                      </div>
                    ) : null
                  ))}
                </>
              ) : (
                <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
                  Add an item to see a price.
                </p>
              )}
            </div>
          </aside>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .print-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </Modal>

      {/* ------------------------------------------------------ ORDER DETAIL */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Print order ${detail.reference}` : ''}
        size="lg"
        footer={
          detail && (
            <div className="row-between" style={{ width: '100%' }}>
              <Badge status={detail.status} />
              <div className="row" style={{ gap: 'var(--s2)' }}>
                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                <select
                  className="select"
                  value={detail.status}
                  onChange={(e) => setOrderStatus(detail, e.target.value)}
                  style={{ width: 'auto' }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
                </select>
              </div>
            </div>
          )
        }
      >
        {detail && (
          <>
            <div className="grid grid-2" style={{ marginBottom: 'var(--s6)' }}>
              <div>
                <div className="tiny muted">Client</div>
                <div className="bold">{detail.organisation_name || detail.contact_name}</div>
                <div className="small muted">{detail.contact_phone}</div>
              </div>
              <div>
                <div className="tiny muted">Required by</div>
                <div className="bold">{date(detail.required_by)}</div>
                {detail.is_rush === 1 && <span className="badge badge-danger">Rush job</span>}
              </div>
              <div>
                <div className="tiny muted">Total</div>
                <div className="bold">{money(detail.total_cents, currency, detail.currency)}</div>
              </div>
              <div>
                <div className="tiny muted">Delivery</div>
                <div className="bold">{humanise(detail.delivery_method)}</div>
              </div>
            </div>

            <h5 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--s3)' }}>Items</h5>
            <div className="stack">
              {detail.items?.map((item) => (
                <div key={item.id} className="card card-pad">
                  <div className="row-between row-wrap" style={{ gap: 'var(--s4)' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="bold">{item.description}</div>
                      <div className="tiny muted">
                        {item.quantity} ×
                        {item.width_mm ? ` ${item.width_mm}×${item.height_mm}mm` : ''}
                        {item.area_sqm ? ` · ${item.area_sqm} sqm` : ''}
                        {item.substrate ? ` · ${item.substrate}` : ''}
                      </div>
                      {item.finishing?.length > 0 && (
                        <div className="tiny muted">
                          Finishing: {item.finishing.map((f) => `${f.name} (${f.quantity})`).join(', ')}
                        </div>
                      )}
                      <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s2)' }}>
                        <Badge tone={
                          item.preflight_status === 'passed' ? 'success'
                            : item.preflight_status === 'warnings' ? 'warning'
                            : item.preflight_status === 'failed' ? 'danger' : 'neutral'
                        }>
                          Artwork: {humanise(item.preflight_status)}
                        </Badge>
                        {item.artwork_dpi && (
                          <span className="tiny muted">{item.artwork_dpi} DPI at final size</span>
                        )}
                      </div>
                      {item.preflight_notes && (
                        <div className="tiny" style={{ color: 'var(--warning)', marginTop: 4 }}>
                          {item.preflight_notes}
                        </div>
                      )}
                    </div>

                    <div className="row" style={{ gap: 'var(--s3)' }}>
                      {item.artwork_thumb && (
                        <img src={item.artwork_thumb} alt="" style={{
                          width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)',
                        }} />
                      )}
                      <div className="text-right">
                        <div className="bold">{money(item.line_total_cents, currency, detail.currency)}</div>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setArtworkFor({ orderId: detail.id, itemId: item.id }); setArtworkMedia(null); }}
                          style={{ marginTop: 4 }}
                        >
                          {item.artwork_media_id ? 'Replace artwork' : 'Upload artwork'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!artworkFor}
        onClose={() => setArtworkFor(null)}
        title="Upload artwork"
        footer={
          <>
            <Button variant="outline" onClick={() => setArtworkFor(null)}>Cancel</Button>
            <Button variant="primary" onClick={uploadArtwork} disabled={!artworkMedia}>Upload and preflight</Button>
          </>
        }
      >
        <Alert tone="info" title="What we check">
          Effective resolution at the final printed size, colour mode, and whether the
          artwork proportions match the ordered dimensions.
        </Alert>
        <Field label="Artwork file" hint="PDF with outlined fonts is best; high-resolution images are acceptable">
          <MediaPicker value={artworkMedia} onChange={setArtworkMedia} kind="all" />
        </Field>
      </Modal>
    </div>
  );
}
