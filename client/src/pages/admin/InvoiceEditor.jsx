import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, dateTime, humanise } from '../../utils/format';
import {
  Card, Button, Field, Input, Textarea, Select, Badge,
  Spinner, Alert, Modal, DataTable,
} from '../../components/UI';

const BLANK_ITEM = { description: '', detail: '', quantity: 1, unit: 'item', unit_price_cents: 0, is_taxable: true };

const PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'tigopesa_mixx', label: 'Mixx by Yas (Tigo Pesa)' },
  { value: 'airtel_money', label: 'Airtel Money' },
  { value: 'halopesa', label: 'HaloPesa' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
];

export default function InvoiceEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { currency, toast } = useApp();

  const [invoice, setInvoice] = useState({
    organisation_id: '', title: '', currency: 'TZS', vat_rate: 18,
    discount_cents: 0, withholding_percent: 0, notes: '', terms: '',
    payment_instructions: '', type: 'standard',
  });
  const [items, setItems] = useState([{ ...BLANK_ITEM }]);
  const [payments, setPayments] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState({
    amount_cents: 0, method: 'mpesa', provider_ref: '', payer_name: '', notes: '',
  });

  useEffect(() => {
    api.get('/organisations?limit=200')
      .then((res) => setOrganisations(res.data || []))
      .catch(() => setOrganisations([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    api.get(`/invoices/${id}`)
      .then((res) => {
        setInvoice(res.data);
        setItems(res.data.items?.length ? res.data.items : [{ ...BLANK_ITEM }]);
        setPayments(res.data.payments || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unit_price_cents || 0)),
      0
    );
    const taxable = items.reduce((sum, item) => {
      if (!item.is_taxable) return sum;
      return sum + Math.round(Number(item.quantity || 0) * Number(item.unit_price_cents || 0));
    }, 0);
    const discount = Math.min(Number(invoice.discount_cents || 0), subtotal);
    const discountOnTaxable = subtotal > 0 ? Math.round((discount * taxable) / subtotal) : 0;
    const vat = Math.round(((taxable - discountOnTaxable) * Number(invoice.vat_rate || 0)) / 100);
    const total = subtotal - discount + vat;
    const withholding = Math.round((total * Number(invoice.withholding_percent || 0)) / 100);
    return { subtotal, discount, vat, total, withholding };
  }, [items, invoice.discount_cents, invoice.vat_rate, invoice.withholding_percent]);

  const paidTotal = payments
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + Number(p.amount_cents), 0);
  const balance = Math.max(0, totals.total - paidTotal);

  const updateItem = (index, patch) => {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const addItem = () => setItems((list) => [...list, { ...BLANK_ITEM }]);
  const removeItem = (index) => {
    setItems((list) => (list.length === 1 ? [{ ...BLANK_ITEM }] : list.filter((_, i) => i !== index)));
  };

  const save = async (thenSend = false) => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...invoice,
        items: items.filter((i) => i.description?.trim()).map((item, i) => ({ ...item, sort_order: i })),
      };
      if (payload.items.length === 0) throw new Error('Add at least one line item');

      let invoiceId = id;
      if (isNew) {
        const res = await api.post('/invoices', payload);
        invoiceId = res.data.id;
        toast(res.message, 'success');
      } else {
        await api.patch(`/invoices/${id}`, payload);
        toast('Invoice saved', 'success');
      }

      if (thenSend) {
        const res = await api.post(`/invoices/${invoiceId}/send`);
        toast(`Sent. Client link: ${res.data.public_url}`, 'success');
      }
      navigate(`/admin/invoices/${invoiceId}`, { replace: true });
      if (isNew) window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const recordPayment = async () => {
    try {
      const res = await api.post(`/invoices/${id}/payments`, {
        ...payment,
        amount_cents: Number(payment.amount_cents),
      });
      toast(res.message, 'success');
      setShowPayment(false);
      setPayment({ amount_cents: 0, method: 'mpesa', provider_ref: '', payer_name: '', notes: '' });
      const fresh = await api.get(`/invoices/${id}`);
      setInvoice(fresh.data);
      setPayments(fresh.data.payments || []);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const removePayment = async (paymentId) => {
    try {
      await api.delete(`/invoices/${id}/payments/${paymentId}`);
      toast('Payment removed', 'success');
      const fresh = await api.get(`/invoices/${id}`);
      setInvoice(fresh.data);
      setPayments(fresh.data.payments || []);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) return <Spinner center />;

  const locked = invoice.status === 'paid';

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <Link to="/admin/invoices" className="small muted">← Invoices</Link>
          <div className="row" style={{ gap: 'var(--s3)', marginTop: 4 }}>
            <h2>{isNew ? 'New invoice' : invoice.reference}</h2>
            {invoice.status && <Badge status={invoice.status} />}
          </div>
        </div>

        <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
          {!isNew && invoice.public_token && (
            <a href={`/i/${invoice.public_token}`} target="_blank" rel="noreferrer" className="btn btn-outline">
              View as client ↗
            </a>
          )}
          {!isNew && balance > 0 && (
            <Button
              variant="dark"
              onClick={() => {
                setPayment((p) => ({ ...p, amount_cents: balance }));
                setShowPayment(true);
              }}
            >
              Record payment
            </Button>
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
        <Alert tone="success" title="This invoice is paid in full">
          Paid invoices cannot be edited. Raise a credit note if something needs correcting.
        </Alert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--s6)' }} className="inv-grid">
        <div className="stack-lg">
          <Card>
            <div className="card-header"><h4>Details</h4></div>
            <div className="card-body">
              <div className="field-row">
                <Field label="Client" required>
                  <Select
                    value={invoice.organisation_id || ''}
                    onChange={(e) => setInvoice({ ...invoice, organisation_id: e.target.value })}
                    placeholder="Choose a client"
                    options={organisations.map((o) => ({ value: o.id, label: o.name }))}
                    disabled={locked || !isNew}
                  />
                </Field>
                <Field label="Type">
                  <Select
                    value={invoice.type}
                    onChange={(e) => setInvoice({ ...invoice, type: e.target.value })}
                    options={[
                      { value: 'standard', label: 'Tax invoice' },
                      { value: 'proforma', label: 'Proforma' },
                      { value: 'deposit', label: 'Deposit' },
                      { value: 'credit_note', label: 'Credit note' },
                    ]}
                    disabled={locked}
                  />
                </Field>
              </div>

              <Field label="Title / reference for the client">
                <Input
                  value={invoice.title || ''}
                  onChange={(e) => setInvoice({ ...invoice, title: e.target.value })}
                  disabled={locked}
                />
              </Field>

              <div className="field-row">
                <Field label="Issue date">
                  <Input
                    type="date"
                    value={invoice.issue_date ? String(invoice.issue_date).slice(0, 10) : ''}
                    onChange={(e) => setInvoice({ ...invoice, issue_date: e.target.value })}
                    disabled={locked}
                  />
                </Field>
                <Field label="Due date">
                  <Input
                    type="date"
                    value={invoice.due_date ? String(invoice.due_date).slice(0, 10) : ''}
                    onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })}
                    disabled={locked}
                  />
                </Field>
                <Field label="Currency">
                  <Select
                    value={invoice.currency}
                    onChange={(e) => setInvoice({ ...invoice, currency: e.target.value })}
                    options={[{ value: 'TZS', label: 'TZS' }, { value: 'USD', label: 'USD' }]}
                    disabled={locked || !isNew}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-header">
              <h4>Line items</h4>
              {!locked && <Button size="sm" variant="outline" onClick={addItem}>+ Add line</Button>}
            </div>
            <div className="card-body">
              {items.map((item, index) => (
                <div key={index} style={{
                  padding: 'var(--s4)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', marginBottom: 'var(--s3)',
                }}>
                  <div className="row-between" style={{ marginBottom: 'var(--s3)' }}>
                    <span className="tiny bold muted">Line {index + 1}</span>
                    {!locked && (
                      <button
                        onClick={() => removeItem(index)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <Field label="Description" required>
                    <Input
                      value={item.description || ''}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      disabled={locked}
                    />
                  </Field>

                  <div className="field-row">
                    <Field label="Quantity">
                      <Input
                        type="number" step="0.01" value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: e.target.value })}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="Unit">
                      <Select
                        value={item.unit}
                        onChange={(e) => updateItem(index, { unit: e.target.value })}
                        options={['item', 'day', 'hour', 'month', 'sqm'].map((u) => ({ value: u, label: u }))}
                        disabled={locked}
                      />
                    </Field>
                    <Field label="Unit price (cents)">
                      <Input
                        type="number" value={item.unit_price_cents}
                        onChange={(e) => updateItem(index, { unit_price_cents: e.target.value })}
                        disabled={locked}
                      />
                    </Field>
                  </div>

                  <div className="row-between">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={!!item.is_taxable}
                        onChange={(e) => updateItem(index, { is_taxable: e.target.checked })}
                        disabled={locked}
                      />
                      <span className="small">VAT applies</span>
                    </label>
                    <strong>
                      {money(
                        Math.round(Number(item.quantity || 0) * Number(item.unit_price_cents || 0)),
                        invoice.currency, invoice.currency
                      )}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {!isNew && payments.length > 0 && (
            <Card>
              <div className="card-header"><h4>Payments received</h4></div>
              <DataTable
                rows={payments}
                columns={[
                  { key: 'paid_at', label: 'Date', render: (row) => <span className="small">{date(row.paid_at)}</span> },
                  {
                    key: 'method',
                    label: 'Method',
                    render: (row) => (
                      <span className="small">
                        {PAYMENT_METHODS.find((m) => m.value === row.method)?.label || humanise(row.method)}
                      </span>
                    ),
                  },
                  { key: 'provider_ref', label: 'Reference', render: (row) => <span className="tiny mono">{row.provider_ref || '—'}</span> },
                  { key: 'payer_name', label: 'Paid by', render: (row) => <span className="small">{row.payer_name || '—'}</span> },
                  {
                    key: 'amount_cents',
                    label: 'Amount',
                    align: 'right',
                    render: (row) => (
                      <strong style={{ color: 'var(--success)' }}>
                        {money(row.amount_cents, invoice.currency, row.currency)}
                      </strong>
                    ),
                  },
                  {
                    key: '_actions',
                    label: '',
                    render: (row) => (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => removePayment(row.id)}
                        style={{ color: 'var(--danger)' }}
                      >
                        Remove
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>
          )}

          <Card>
            <div className="card-header"><h4>Notes and terms</h4></div>
            <div className="card-body">
              <Field label="How to pay" hint="Shown on the invoice the client sees">
                <Textarea
                  value={invoice.payment_instructions || ''}
                  onChange={(e) => setInvoice({ ...invoice, payment_instructions: e.target.value })}
                  rows={3}
                  disabled={locked}
                  placeholder={'M-Pesa: Lipa Namba 000000\nBank: CRDB, Account 0000000000\nPlease quote the invoice reference.'}
                />
              </Field>
              <Field label="Terms">
                <Textarea
                  value={invoice.terms || ''}
                  onChange={(e) => setInvoice({ ...invoice, terms: e.target.value })}
                  rows={3}
                  disabled={locked}
                />
              </Field>
              <Field label="Notes to the client">
                <Textarea
                  value={invoice.notes || ''}
                  onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                  rows={2}
                  disabled={locked}
                />
              </Field>
            </div>
          </Card>

          {!isNew && (
            <Card>
              <div className="card-header">
                <div>
                  <h4>Fiscalisation</h4>
                  <span className="tiny muted">
                    Record the TRA fiscal receipt here once the EFD or VFD has issued it.
                  </span>
                </div>
              </div>
              <div className="card-body">
                <div className="field-row">
                  <Field label="Fiscal receipt number">
                    <Input
                      value={invoice.fiscal_receipt_no || ''}
                      onChange={(e) => setInvoice({ ...invoice, fiscal_receipt_no: e.target.value })}
                    />
                  </Field>
                  <Field label="Verification code">
                    <Input
                      value={invoice.fiscal_verification_code || ''}
                      onChange={(e) => setInvoice({ ...invoice, fiscal_verification_code: e.target.value })}
                    />
                  </Field>
                  <Field label="Device number">
                    <Input
                      value={invoice.fiscal_device_no || ''}
                      onChange={(e) => setInvoice({ ...invoice, fiscal_device_no: e.target.value })}
                    />
                  </Field>
                </div>
                {invoice.fiscalised_at && (
                  <div className="tiny muted">Fiscalised {dateTime(invoice.fiscalised_at)}</div>
                )}
              </div>
            </Card>
          )}
        </div>

        <aside>
          <Card style={{ position: 'sticky', top: 'calc(var(--header-h) + var(--s4))' }}>
            <div className="card-header"><h4>Summary</h4></div>
            <div className="card-body">
              <div className="row-between small" style={{ padding: '6px 0' }}>
                <span className="muted">Subtotal</span>
                <span>{money(totals.subtotal, invoice.currency, invoice.currency)}</span>
              </div>

              <Field label="Discount (cents)">
                <Input
                  type="number"
                  value={invoice.discount_cents || 0}
                  onChange={(e) => setInvoice({ ...invoice, discount_cents: e.target.value })}
                  disabled={locked}
                />
              </Field>

              <Field label="VAT rate (%)">
                <Input
                  type="number"
                  value={invoice.vat_rate}
                  onChange={(e) => setInvoice({ ...invoice, vat_rate: e.target.value })}
                  disabled={locked}
                />
              </Field>

              <div className="row-between small" style={{ padding: '6px 0' }}>
                <span className="muted">VAT</span>
                <span>{money(totals.vat, invoice.currency, invoice.currency)}</span>
              </div>

              <Field label="Withholding tax (%)" hint="Where the client withholds on your behalf">
                <Input
                  type="number"
                  value={invoice.withholding_percent || 0}
                  onChange={(e) => setInvoice({ ...invoice, withholding_percent: e.target.value })}
                  disabled={locked}
                />
              </Field>

              <div
                className="row-between"
                style={{ padding: 'var(--s3) 0', borderTop: '2px solid var(--ink-800)', marginTop: 'var(--s2)' }}
              >
                <strong>Total</strong>
                <strong style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)' }}>
                  {money(totals.total, invoice.currency, invoice.currency)}
                </strong>
              </div>

              {paidTotal > 0 && (
                <>
                  <div className="row-between small" style={{ padding: '6px 0' }}>
                    <span className="muted">Paid</span>
                    <span style={{ color: 'var(--success)' }}>
                      −{money(paidTotal, invoice.currency, invoice.currency)}
                    </span>
                  </div>
                  <div className="row-between" style={{ padding: '6px 0' }}>
                    <strong>Balance</strong>
                    <strong style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {money(balance, invoice.currency, invoice.currency)}
                    </strong>
                  </div>
                </>
              )}

              {invoice.currency !== currency && (
                <div className="tiny muted text-right" style={{ marginTop: 4 }}>
                  ≈ {money(totals.total, currency, invoice.currency)}
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <Modal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        title="Record a payment"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button variant="primary" onClick={recordPayment}>Record payment</Button>
          </>
        }
      >
        <Field label="Amount (cents)" required hint={`Balance outstanding: ${money(balance, invoice.currency, invoice.currency)}`}>
          <Input
            type="number"
            value={payment.amount_cents}
            onChange={(e) => setPayment({ ...payment, amount_cents: e.target.value })}
          />
        </Field>
        <Field label="Method" required>
          <Select
            value={payment.method}
            onChange={(e) => setPayment({ ...payment, method: e.target.value })}
            options={PAYMENT_METHODS}
          />
        </Field>
        <Field label="Transaction reference" hint="The M-Pesa or bank reference — keep this for reconciliation">
          <Input
            value={payment.provider_ref}
            onChange={(e) => setPayment({ ...payment, provider_ref: e.target.value })}
            placeholder="e.g. QGH7X8Y9Z0"
          />
        </Field>
        <Field label="Paid by">
          <Input
            value={payment.payer_name}
            onChange={(e) => setPayment({ ...payment, payer_name: e.target.value })}
          />
        </Field>
        <Field label="Notes">
          <Textarea
            value={payment.notes}
            onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
            rows={2}
          />
        </Field>
      </Modal>

      <style>{`
        @media (max-width: 1100px) {
          .inv-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
