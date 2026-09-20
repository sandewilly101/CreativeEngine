import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, humanise } from '../../utils/format';
import {
  Card, Button, Field, Input, Textarea, Select, Badge,
  Spinner, Alert, Modal,
} from '../../components/UI';

const BLANK_ITEM = {
  item_type: 'custom', description: '', detail: '',
  quantity: 1, unit: 'item', unit_price_cents: 0,
  is_taxable: true, is_optional: false,
};

export default function QuoteEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { currency, toast } = useApp();

  const [quote, setQuote] = useState({
    organisation_id: '', title: '', intro: '', terms: '', notes: '',
    currency: 'TZS', discount_type: 'none', discount_value: 0,
    vat_rate: 18, validity_days: 30,
  });
  const [items, setItems] = useState([{ ...BLANK_ITEM }]);
  const [organisations, setOrganisations] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConvert, setShowConvert] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
      api.get('/services?status=published&limit=100').catch(() => ({ data: [] })),
    ]).then(([o, s]) => {
      setOrganisations(o.data || []);
      setServices(s.data || []);
    });
  }, []);

  useEffect(() => {
    if (isNew) return;
    api.get(`/quotes/${id}`)
      .then((res) => {
        setQuote(res.data);
        setItems(res.data.items?.length ? res.data.items : [{ ...BLANK_ITEM }]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Totals mirror the server calculation so the figures update as you type.
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unit_price_cents || 0)),
      0
    );
    const taxable = items.reduce((sum, item) => {
      if (!item.is_taxable) return sum;
      return sum + Math.round(Number(item.quantity || 0) * Number(item.unit_price_cents || 0));
    }, 0);

    let discount = 0;
    if (quote.discount_type === 'percent') {
      discount = Math.round((subtotal * Number(quote.discount_value || 0)) / 100);
    } else if (quote.discount_type === 'fixed') {
      discount = Number(quote.discount_value || 0);
    }
    discount = Math.min(discount, subtotal);

    const discountOnTaxable = subtotal > 0 ? Math.round((discount * taxable) / subtotal) : 0;
    const vat = Math.round(((taxable - discountOnTaxable) * Number(quote.vat_rate || 0)) / 100);

    return { subtotal, discount, vat, total: subtotal - discount + vat };
  }, [items, quote.discount_type, quote.discount_value, quote.vat_rate]);

  const updateItem = (index, patch) => {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((list) => [...list, { ...BLANK_ITEM }]);

  const removeItem = (index) => {
    setItems((list) => (list.length === 1 ? [{ ...BLANK_ITEM }] : list.filter((_, i) => i !== index)));
  };

  /** Selecting a service fills in its description and price. */
  const applyService = (index, serviceId) => {
    const service = services.find((s) => String(s.id) === String(serviceId));
    if (!service) {
      updateItem(index, { service_id: null });
      return;
    }
    updateItem(index, {
      service_id: service.id,
      item_type: 'service',
      description: service.name,
      detail: service.short_description || '',
      unit_price_cents: Number(service.base_price_cents) || 0,
      unit: service.recurring_interval !== 'none' ? 'month' : 'item',
    });
  };

  const save = async (thenSend = false) => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...quote,
        items: items
          .filter((item) => item.description?.trim())
          .map((item, i) => ({ ...item, sort_order: i })),
      };
      if (payload.items.length === 0) throw new Error('Add at least one line item');

      let quoteId = id;
      if (isNew) {
        const res = await api.post('/quotes', payload);
        quoteId = res.data.id;
        toast(res.message, 'success');
      } else {
        await api.patch(`/quotes/${id}`, payload);
        toast('Quote saved', 'success');
      }

      if (thenSend) {
        const res = await api.post(`/quotes/${quoteId}/send`);
        toast(`Sent. Client link: ${res.data.public_url}`, 'success');
      }
      navigate(`/admin/quotes/${quoteId}`, { replace: true });
      if (isNew) window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const convert = async (target) => {
    try {
      const res = await api.post(`/quotes/${id}/convert-to-${target}`);
      toast(res.message, 'success');
      setShowConvert(false);
      navigate(target === 'project' ? `/admin/projects/${res.data.project_id}` : `/admin/invoices/${res.data.invoice_id}`);
    } catch (err) {
      toast(err.message, 'error');
      setShowConvert(false);
    }
  };

  const revise = async () => {
    try {
      const res = await api.post(`/quotes/${id}/revise`);
      toast(res.message, 'success');
      navigate(`/admin/quotes/${res.data.id}`);
      window.location.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) return <Spinner center />;

  const locked = ['accepted', 'rejected'].includes(quote.status);

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <Link to="/admin/quotes" className="small muted">← Quotes</Link>
          <div className="row" style={{ gap: 'var(--s3)', marginTop: 4 }}>
            <h2>{isNew ? 'New quote' : quote.reference}</h2>
            {quote.status && <Badge status={quote.status} />}
            {quote.version > 1 && <span className="badge badge-neutral">Revision {quote.version}</span>}
          </div>
        </div>

        <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
          {!isNew && quote.public_token && quote.status !== 'draft' && (
            <a href={`/q/${quote.public_token}`} target="_blank" rel="noreferrer" className="btn btn-outline">
              View as client ↗
            </a>
          )}
          {locked && (
            <Button variant="outline" onClick={revise}>Create revision</Button>
          )}
          {!isNew && quote.status === 'accepted' && (
            <Button variant="dark" onClick={() => setShowConvert(true)}>Convert →</Button>
          )}
          {!locked && (
            <>
              <Button variant="outline" onClick={() => save(false)} loading={saving}>Save</Button>
              <Button variant="primary" onClick={() => save(true)} loading={saving}>Save and send</Button>
            </>
          )}
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {locked && (
        <Alert tone="info" title="This quote is locked">
          It has been {quote.status}. Create a revision to change anything.
        </Alert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--s6)' }} className="quote-grid">
        <div className="stack-lg">
          <Card>
            <div className="card-header"><h4>Details</h4></div>
            <div className="card-body">
              <div className="field-row">
                <Field label="Client" required>
                  <Select
                    value={quote.organisation_id || ''}
                    onChange={(e) => setQuote({ ...quote, organisation_id: e.target.value })}
                    placeholder="Choose a client"
                    options={organisations.map((o) => ({ value: o.id, label: o.name }))}
                    disabled={locked}
                  />
                </Field>
                <Field label="Currency">
                  <Select
                    value={quote.currency}
                    onChange={(e) => setQuote({ ...quote, currency: e.target.value })}
                    options={[{ value: 'TZS', label: 'TZS' }, { value: 'USD', label: 'USD' }]}
                    disabled={locked}
                  />
                </Field>
              </div>

              <Field label="Quote title" required>
                <Input
                  value={quote.title || ''}
                  onChange={(e) => setQuote({ ...quote, title: e.target.value })}
                  placeholder="Brand identity and website launch"
                  disabled={locked}
                />
              </Field>

              <Field label="Introduction" hint="Sets the context. The client reads this first.">
                <Textarea
                  value={quote.intro || ''}
                  onChange={(e) => setQuote({ ...quote, intro: e.target.value })}
                  rows={3}
                  disabled={locked}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="card-header">
              <h4>Line items</h4>
              {!locked && <Button size="sm" variant="outline" onClick={addItem}>+ Add line</Button>}
            </div>
            <div className="card-body">
              {items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: 'var(--s4)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    marginBottom: 'var(--s3)',
                    background: item.is_optional ? 'var(--ink-50)' : 'transparent',
                  }}
                >
                  <div className="row-between" style={{ marginBottom: 'var(--s3)' }}>
                    <span className="tiny bold muted">Line {index + 1}</span>
                    {!locked && items.length > 0 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <Field label="Pick a service (optional)">
                    <Select
                      value={item.service_id || ''}
                      onChange={(e) => applyService(index, e.target.value)}
                      placeholder="Custom line"
                      options={services.map((s) => ({
                        value: s.id,
                        label: `${s.name} — ${money(s.base_price_cents, 'TZS')}`,
                      }))}
                      disabled={locked}
                    />
                  </Field>

                  <Field label="Description" required>
                    <Input
                      value={item.description || ''}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="What are you charging for?"
                      disabled={locked}
                    />
                  </Field>

                  <Field label="Detail" hint="Scope, inclusions, exclusions — the detail that prevents arguments later">
                    <Textarea
                      value={item.detail || ''}
                      onChange={(e) => updateItem(index, { detail: e.target.value })}
                      rows={2}
                      disabled={locked}
                    />
                  </Field>

                  <div className="field-row">
                    <Field label="Quantity">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: e.target.value })}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="Unit">
                      <Select
                        value={item.unit}
                        onChange={(e) => updateItem(index, { unit: e.target.value })}
                        options={['item', 'day', 'hour', 'month', 'sqm', 'unit'].map((u) => ({ value: u, label: u }))}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="Unit price (cents)" hint="1,000,000 = TZS 10,000">
                      <Input
                        type="number"
                        value={item.unit_price_cents}
                        onChange={(e) => updateItem(index, { unit_price_cents: e.target.value })}
                        disabled={locked}
                      />
                    </Field>
                  </div>

                  <div className="row-between row-wrap" style={{ gap: 'var(--s4)' }}>
                    <div className="row" style={{ gap: 'var(--s5)' }}>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={!!item.is_taxable}
                          onChange={(e) => updateItem(index, { is_taxable: e.target.checked })}
                          disabled={locked}
                        />
                        <span className="small">VAT applies</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={!!item.is_optional}
                          onChange={(e) => updateItem(index, { is_optional: e.target.checked })}
                          disabled={locked}
                        />
                        <span className="small">Optional extra</span>
                      </label>
                    </div>
                    <strong>
                      {money(
                        Math.round(Number(item.quantity || 0) * Number(item.unit_price_cents || 0)),
                        quote.currency, quote.currency
                      )}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="card-header"><h4>Terms</h4></div>
            <div className="card-body">
              <Field
                label="Terms and conditions"
                hint="Payment terms, revision limits, what happens if the brief changes"
              >
                <Textarea
                  value={quote.terms || ''}
                  onChange={(e) => setQuote({ ...quote, terms: e.target.value })}
                  rows={6}
                  disabled={locked}
                  placeholder={'50% deposit before work begins, balance on delivery.\nIncludes two rounds of revision; further rounds quoted separately.\nPrices valid for 30 days and exclusive of VAT.'}
                />
              </Field>
              <Field label="Internal notes" hint="Never shown to the client">
                <Textarea
                  value={quote.notes || ''}
                  onChange={(e) => setQuote({ ...quote, notes: e.target.value })}
                  rows={2}
                  disabled={locked}
                />
              </Field>
            </div>
          </Card>
        </div>

        <aside>
          <Card style={{ position: 'sticky', top: 'calc(var(--header-h) + var(--s4))' }}>
            <div className="card-header"><h4>Summary</h4></div>
            <div className="card-body">
              <div className="row-between small" style={{ padding: '6px 0' }}>
                <span className="muted">Subtotal</span>
                <span>{money(totals.subtotal, quote.currency, quote.currency)}</span>
              </div>

              <Field label="Discount">
                <div className="row" style={{ gap: 'var(--s2)' }}>
                  <Select
                    value={quote.discount_type}
                    onChange={(e) => setQuote({ ...quote, discount_type: e.target.value })}
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'percent', label: '%' },
                      { value: 'fixed', label: 'Fixed' },
                    ]}
                    disabled={locked}
                    style={{ width: 100 }}
                  />
                  {quote.discount_type !== 'none' && (
                    <Input
                      type="number"
                      value={quote.discount_value}
                      onChange={(e) => setQuote({ ...quote, discount_value: e.target.value })}
                      disabled={locked}
                    />
                  )}
                </div>
              </Field>

              {totals.discount > 0 && (
                <div className="row-between small" style={{ padding: '6px 0' }}>
                  <span className="muted">Discount</span>
                  <span style={{ color: 'var(--success)' }}>
                    −{money(totals.discount, quote.currency, quote.currency)}
                  </span>
                </div>
              )}

              <Field label="VAT rate (%)">
                <Input
                  type="number"
                  value={quote.vat_rate}
                  onChange={(e) => setQuote({ ...quote, vat_rate: e.target.value })}
                  disabled={locked}
                />
              </Field>

              <div className="row-between small" style={{ padding: '6px 0' }}>
                <span className="muted">VAT</span>
                <span>{money(totals.vat, quote.currency, quote.currency)}</span>
              </div>

              <div
                className="row-between"
                style={{ padding: 'var(--s3) 0', borderTop: '2px solid var(--ink-800)', marginTop: 'var(--s2)' }}
              >
                <strong>Total</strong>
                <strong style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)' }}>
                  {money(totals.total, quote.currency, quote.currency)}
                </strong>
              </div>

              {quote.currency !== currency && (
                <div className="tiny muted text-right" style={{ marginTop: 4 }}>
                  ≈ {money(totals.total, currency, quote.currency)}
                </div>
              )}

              {isNew && (
                <Field label="Valid for (days)" hint="The quote expires after this">
                  <Input
                    type="number"
                    value={quote.validity_days}
                    onChange={(e) => setQuote({ ...quote, validity_days: e.target.value })}
                  />
                </Field>
              )}

              {!isNew && quote.valid_until && (
                <div className="tiny muted" style={{ marginTop: 'var(--s4)' }}>
                  Valid until {date(quote.valid_until)}
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <Modal
        open={showConvert}
        onClose={() => setShowConvert(false)}
        title="Convert this quote"
        footer={<Button variant="outline" onClick={() => setShowConvert(false)}>Cancel</Button>}
      >
        <p className="small muted" style={{ marginBottom: 'var(--s5)' }}>
          The accepted quote can become a project to deliver, an invoice to bill, or both.
        </p>
        <div className="stack">
          <Button variant="primary" className="btn-block" onClick={() => convert('project')}>
            Create a project
          </Button>
          <Button variant="dark" className="btn-block" onClick={() => convert('invoice')}>
            Raise an invoice
          </Button>
        </div>
      </Modal>

      <style>{`
        @media (max-width: 1100px) {
          .quote-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
