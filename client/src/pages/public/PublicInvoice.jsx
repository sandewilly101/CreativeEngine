import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, humanise } from '../../utils/format';
import { Spinner, Empty, Button, Badge, Alert } from '../../components/UI';

const METHOD_LABELS = {
  mpesa: 'M-Pesa',
  tigopesa_mixx: 'Mixx by Yas',
  airtel_money: 'Airtel Money',
  halopesa: 'HaloPesa',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
};

export default function PublicInvoice() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const { siteSettings } = useApp();

  useEffect(() => {
    api.get(`/public/invoices/${token}`)
      .then((res) => setInvoice(res.data))
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Spinner center />;
  if (!invoice) {
    return (
      <div className="container section">
        <Empty title="Invoice not found" description="This link may have expired." />
      </div>
    );
  }

  const currency = invoice.currency || 'TZS';
  const finance = siteSettings.finance || {};
  const contact = siteSettings.contact || {};
  const brand = siteSettings.brand || {};
  const overdue = new Date(invoice.due_date) < new Date() && Number(invoice.balance_cents) > 0;

  return (
    <div className="container section" style={{ maxWidth: 900 }}>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="tiny muted">
              {invoice.type === 'proforma' ? 'Proforma invoice'
                : invoice.type === 'credit_note' ? 'Credit note'
                : 'Tax invoice'}
            </div>
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>{invoice.reference}</h2>
          </div>
          <Badge status={overdue ? 'overdue' : invoice.status} />
        </div>

        <div className="card-body">
          <div className="row-between row-wrap" style={{ gap: 'var(--s8)', marginBottom: 'var(--s8)' }}>
            <div>
              <div className="tiny muted">From</div>
              <div className="bold">{brand.company_name || 'Creative Engine'}</div>
              <div className="small muted">
                {contact.address_line1 && <>{contact.address_line1}<br /></>}
                {contact.city || 'Dar es Salaam'}, {contact.country || 'Tanzania'}
              </div>
              {invoice.seller_tin && <div className="tiny muted">TIN: {invoice.seller_tin}</div>}
              {invoice.seller_vrn && <div className="tiny muted">VRN: {invoice.seller_vrn}</div>}
            </div>

            <div>
              <div className="tiny muted">Bill to</div>
              <div className="bold">{invoice.organisation_name}</div>
              <div className="small muted">
                {invoice.address_line1 && <>{invoice.address_line1}<br /></>}
                {invoice.city}
              </div>
              {invoice.buyer_tin && <div className="tiny muted">TIN: {invoice.buyer_tin}</div>}
              {invoice.buyer_vrn && <div className="tiny muted">VRN: {invoice.buyer_vrn}</div>}
            </div>

            <div className="text-right">
              <div className="tiny muted">Issued</div>
              <div className="bold">{date(invoice.issue_date)}</div>
              <div className="tiny muted" style={{ marginTop: 'var(--s3)' }}>Due</div>
              <div className="bold" style={{ color: overdue ? 'var(--danger)' : undefined }}>
                {date(invoice.due_date)}
              </div>
            </div>
          </div>

          {overdue && (
            <Alert tone="danger" title="This invoice is overdue">
              A balance of {money(invoice.balance_cents, currency, currency)} remains outstanding.
            </Alert>
          )}

          <div className="table-wrap" style={{ marginTop: 'var(--s6)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="bold">{item.description}</div>
                      {item.detail && <div className="tiny muted">{item.detail}</div>}
                    </td>
                    <td className="num">{Number(item.quantity)} {item.unit}</td>
                    <td className="num">{money(item.unit_price_cents, currency, currency)}</td>
                    <td className="num bold">{money(item.line_total_cents, currency, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'var(--s6)', marginLeft: 'auto', maxWidth: 340 }}>
            <div className="row-between small" style={{ padding: '6px 0' }}>
              <span className="muted">Subtotal</span>
              <span>{money(invoice.subtotal_cents, currency, currency)}</span>
            </div>
            {Number(invoice.discount_cents) > 0 && (
              <div className="row-between small" style={{ padding: '6px 0' }}>
                <span className="muted">Discount</span>
                <span style={{ color: 'var(--success)' }}>−{money(invoice.discount_cents, currency, currency)}</span>
              </div>
            )}
            <div className="row-between small" style={{ padding: '6px 0' }}>
              <span className="muted">VAT ({Number(invoice.vat_rate)}%)</span>
              <span>{money(invoice.vat_cents, currency, currency)}</span>
            </div>
            {Number(invoice.withholding_cents) > 0 && (
              <div className="row-between small" style={{ padding: '6px 0' }}>
                <span className="muted">Withholding tax</span>
                <span>−{money(invoice.withholding_cents, currency, currency)}</span>
              </div>
            )}
            <div
              className="row-between"
              style={{ padding: 'var(--s3) 0', borderTop: '2px solid var(--ink-800)', marginTop: 'var(--s2)' }}
            >
              <strong>Total</strong>
              <strong style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)' }}>
                {money(invoice.total_cents, currency, currency)}
              </strong>
            </div>
            {Number(invoice.paid_cents) > 0 && (
              <>
                <div className="row-between small" style={{ padding: '6px 0' }}>
                  <span className="muted">Paid</span>
                  <span style={{ color: 'var(--success)' }}>
                    −{money(invoice.paid_cents, currency, currency)}
                  </span>
                </div>
                <div className="row-between" style={{ padding: '6px 0' }}>
                  <strong>Balance due</strong>
                  <strong style={{ color: Number(invoice.balance_cents) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {money(invoice.balance_cents, currency, currency)}
                  </strong>
                </div>
              </>
            )}
          </div>

          {invoice.payments?.length > 0 && (
            <div style={{ marginTop: 'var(--s8)' }}>
              <h5>Payments received</h5>
              <table className="table" style={{ marginTop: 'var(--s3)' }}>
                <tbody>
                  {invoice.payments.map((payment, i) => (
                    <tr key={i}>
                      <td className="small">{date(payment.paid_at)}</td>
                      <td className="small">{METHOD_LABELS[payment.method] || humanise(payment.method)}</td>
                      <td className="small mono">{payment.provider_ref || '—'}</td>
                      <td className="num bold">{money(payment.amount_cents, currency, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Number(invoice.balance_cents) > 0 && (
            <div className="card card-pad" style={{ marginTop: 'var(--s8)', background: 'var(--ink-50)' }}>
              <h5>How to pay</h5>
              <div className="small" style={{ marginTop: 'var(--s3)', lineHeight: 1.8 }}>
                {invoice.payment_instructions ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{invoice.payment_instructions}</div>
                ) : (
                  <>
                    <div>We accept M-Pesa, Mixx by Yas, Airtel Money and bank transfer.</div>
                    {finance.bank_name && (
                      <div style={{ marginTop: 'var(--s2)' }}>
                        <strong>{finance.bank_name}</strong>
                        {finance.bank_account && <> · Account {finance.bank_account}</>}
                      </div>
                    )}
                    {contact.phone && (
                      <div style={{ marginTop: 'var(--s2)' }}>
                        For mobile money, call {contact.phone} and quote {invoice.reference}.
                      </div>
                    )}
                  </>
                )}
                <div className="tiny muted" style={{ marginTop: 'var(--s3)' }}>
                  Please quote <strong>{invoice.reference}</strong> as the payment reference.
                </div>
              </div>
            </div>
          )}

          {invoice.fiscal_receipt_no && (
            <div className="tiny muted" style={{ marginTop: 'var(--s6)' }}>
              Fiscal receipt: {invoice.fiscal_receipt_no}
              {invoice.fiscal_verification_code && <> · Verification: {invoice.fiscal_verification_code}</>}
            </div>
          )}

          {invoice.notes && (
            <p className="small muted" style={{ marginTop: 'var(--s6)', whiteSpace: 'pre-wrap' }}>{invoice.notes}</p>
          )}
        </div>
      </div>

      <div className="text-center no-print" style={{ marginTop: 'var(--s6)' }}>
        <Button variant="ghost" onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
    </div>
  );
}
