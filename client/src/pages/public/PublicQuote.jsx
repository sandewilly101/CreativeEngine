import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../utils/api';
import { money, date, humanise } from '../../utils/format';
import { Spinner, Empty, Button, Field, Input, Textarea, Modal, Badge, Alert } from '../../components/UI';

/**
 * A client opens this from an emailed link, without an account.
 * Accepting records a typed signature, the time and the IP address.
 */
export default function PublicQuote() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'accept' | 'reject'
  const [signature, setSignature] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get(`/public/quotes/${token}`)
      .then((res) => setQuote(res.data))
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  }, [token]);

  const respond = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/public/quotes/${token}/respond`, {
        action,
        signature_name: signature,
        rejection_reason: reason,
      });
      setDone(res.message);
      setAction(null);
      const fresh = await api.get(`/public/quotes/${token}`);
      setQuote(fresh.data);
    } catch (err) {
      setDone(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner center />;
  if (!quote) {
    return (
      <div className="container section">
        <Empty title="Quote not found" description="This link may have expired or been withdrawn." />
      </div>
    );
  }

  const currency = quote.currency || 'TZS';
  const settled = ['accepted', 'rejected'].includes(quote.status);
  const expired = quote.valid_until && new Date(quote.valid_until) < new Date() && !settled;

  return (
    <div className="container section" style={{ maxWidth: 900 }}>
      {done && <Alert tone="success" title="Thank you">{done}</Alert>}

      <div className="card" style={{ marginTop: done ? 'var(--s6)' : 0 }}>
        <div className="card-header">
          <div>
            <div className="tiny muted">Quotation</div>
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>{quote.reference}</h2>
          </div>
          <Badge status={quote.status} />
        </div>

        <div className="card-body">
          <div className="row-between row-wrap" style={{ marginBottom: 'var(--s8)', gap: 'var(--s6)' }}>
            <div>
              <div className="tiny muted">Prepared for</div>
              <div className="bold">{quote.organisation_name}</div>
              {quote.buyer_tin && <div className="tiny muted">TIN: {quote.buyer_tin}</div>}
              {quote.buyer_vrn && <div className="tiny muted">VRN: {quote.buyer_vrn}</div>}
            </div>
            <div className="text-right">
              <div className="tiny muted">Valid until</div>
              <div className="bold">{date(quote.valid_until)}</div>
              {quote.version > 1 && <div className="tiny muted">Revision {quote.version}</div>}
            </div>
          </div>

          <h3 style={{ fontSize: 'var(--text-xl)' }}>{quote.title}</h3>
          {quote.intro && (
            <p style={{ marginTop: 'var(--s4)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{quote.intro}</p>
          )}

          {expired && (
            <Alert tone="warning" title="This quote has expired">
              Prices may have changed. Contact us and we will reissue it.
            </Alert>
          )}

          <div className="table-wrap" style={{ marginTop: 'var(--s8)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((item) => (
                  <tr key={item.id} style={item.is_optional ? { opacity: 0.65 } : undefined}>
                    <td>
                      <div className="bold">{item.description}</div>
                      {item.detail && <div className="tiny muted" style={{ whiteSpace: 'pre-wrap' }}>{item.detail}</div>}
                      {item.is_optional === 1 && <span className="badge badge-neutral">Optional</span>}
                    </td>
                    <td className="num">{Number(item.quantity)} {item.unit}</td>
                    <td className="num">{money(item.unit_price_cents, currency, currency)}</td>
                    <td className="num bold">{money(item.line_total_cents, currency, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'var(--s6)', marginLeft: 'auto', maxWidth: 320 }}>
            <div className="row-between small" style={{ padding: '6px 0' }}>
              <span className="muted">Subtotal</span>
              <span>{money(quote.subtotal_cents, currency, currency)}</span>
            </div>
            {Number(quote.discount_cents) > 0 && (
              <div className="row-between small" style={{ padding: '6px 0' }}>
                <span className="muted">Discount</span>
                <span style={{ color: 'var(--success)' }}>
                  −{money(quote.discount_cents, currency, currency)}
                </span>
              </div>
            )}
            <div className="row-between small" style={{ padding: '6px 0' }}>
              <span className="muted">VAT ({Number(quote.vat_rate)}%)</span>
              <span>{money(quote.vat_cents, currency, currency)}</span>
            </div>
            <div
              className="row-between"
              style={{ padding: 'var(--s3) 0', borderTop: '2px solid var(--ink-800)', marginTop: 'var(--s2)' }}
            >
              <strong>Total</strong>
              <strong style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)' }}>
                {money(quote.total_cents, currency, currency)}
              </strong>
            </div>
          </div>

          {quote.terms && (
            <div style={{ marginTop: 'var(--s10)', paddingTop: 'var(--s6)', borderTop: '1px solid var(--border)' }}>
              <h5>Terms</h5>
              <p className="small muted" style={{ marginTop: 'var(--s3)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {quote.terms}
              </p>
            </div>
          )}

          {quote.status === 'accepted' && quote.signature_name && (
            <Alert tone="success" title="Accepted">
              Signed by {quote.signature_name} on {date(quote.signed_at)}.
            </Alert>
          )}
          {quote.status === 'rejected' && (
            <Alert tone="neutral" title="Declined">
              {quote.rejection_reason || 'This quote was declined.'}
            </Alert>
          )}
        </div>

        {!settled && !expired && (
          <div className="card-footer no-print">
            <Button variant="outline" onClick={() => setAction('reject')}>Decline</Button>
            <Button variant="primary" onClick={() => setAction('accept')}>Accept this quote</Button>
          </div>
        )}
      </div>

      <div className="text-center no-print" style={{ marginTop: 'var(--s6)' }}>
        <Button variant="ghost" onClick={() => window.print()}>Print or save as PDF</Button>
      </div>

      <Modal
        open={action === 'accept'}
        onClose={() => setAction(null)}
        title="Accept this quote"
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant="primary" onClick={respond} loading={submitting} disabled={!signature.trim()}>
              Accept and sign
            </Button>
          </>
        }
      >
        <p className="small muted">
          Typing your full name below acts as your signature and confirms acceptance of
          this quote and its terms. We record the date, time and IP address.
        </p>
        <Field label="Your full name" required>
          <Input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Type your full name"
          />
        </Field>
      </Modal>

      <Modal
        open={action === 'reject'}
        onClose={() => setAction(null)}
        title="Decline this quote"
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant="danger" onClick={respond} loading={submitting}>Decline</Button>
          </>
        }
      >
        <Field label="Reason (optional)" hint="Honest feedback helps us quote better next time.">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Budget, timing, scope…"
          />
        </Field>
      </Modal>
    </div>
  );
}
