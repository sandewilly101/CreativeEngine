import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, moneyCompact, date, humanise } from '../../utils/format';
import { Card, Spinner, Badge, Empty, DataTable, StatTile, Tabs, Alert } from '../../components/UI';

export default function PortalInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const { currency, siteSettings } = useApp();

  useEffect(() => {
    setLoading(true);
    api.get(`/invoices${api.qs({ status: filter, limit: 50, sort: 'issue_date:desc' })}`)
      .then((res) => setInvoices(res.data || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const outstanding = invoices
    .filter((i) => Number(i.balance_cents) > 0)
    .reduce((sum, i) => sum + Number(i.balance_cents), 0);

  const overdue = invoices
    .filter((i) => Number(i.balance_cents) > 0 && new Date(i.due_date) < new Date())
    .reduce((sum, i) => sum + Number(i.balance_cents), 0);

  const paid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_cents), 0);

  const finance = siteSettings.finance || {};
  const contact = siteSettings.contact || {};

  return (
    <div className="stack-lg">
      <div>
        <h2>Invoices</h2>
        <p className="muted small">Everything we have billed, and what is still outstanding.</p>
      </div>

      <div className="grid grid-3">
        <StatTile label="Outstanding" value={moneyCompact(outstanding, currency)} />
        <StatTile
          label="Overdue"
          value={moneyCompact(overdue, currency)}
          tone={overdue > 0 ? 'danger' : undefined}
        />
        <StatTile label="Paid to date" value={moneyCompact(paid, currency)} tone="success" />
      </div>

      {overdue > 0 && (
        <Alert tone="danger" title="Some invoices are past their due date">
          {money(overdue, currency)} is currently overdue. If a payment has already been made,
          let us know the reference and we will reconcile it.
        </Alert>
      )}

      <Tabs
        tabs={[
          { key: '', label: 'All' },
          { key: 'sent,viewed,partial,overdue', label: 'Unpaid' },
          { key: 'paid', label: 'Paid' },
        ]}
        active={filter}
        onChange={setFilter}
      />

      <Card>
        <DataTable
          loading={loading}
          rows={invoices}
          empty={<Empty title="No invoices yet" />}
          columns={[
            {
              key: 'reference',
              label: 'Invoice',
              render: (row) => (
                <div style={{ minWidth: 0 }}>
                  <div className="bold mono">{row.reference}</div>
                  <div className="tiny muted truncate">{row.title || humanise(row.type)}</div>
                </div>
              ),
            },
            { key: 'issue_date', label: 'Issued', render: (row) => <span className="small">{date(row.issue_date)}</span> },
            {
              key: 'due_date',
              label: 'Due',
              render: (row) => {
                const late = Number(row.days_overdue) > 0 && Number(row.balance_cents) > 0;
                return (
                  <span className="small" style={{ color: late ? 'var(--danger)' : undefined }}>
                    {date(row.due_date)}
                  </span>
                );
              },
            },
            {
              key: 'total_cents',
              label: 'Total',
              align: 'right',
              render: (row) => money(row.total_cents, currency, row.currency),
            },
            {
              key: 'balance_cents',
              label: 'Balance',
              align: 'right',
              render: (row) => (
                <span className="bold" style={{
                  color: Number(row.balance_cents) > 0 ? 'var(--danger)' : 'var(--success)',
                }}>
                  {money(row.balance_cents, currency, row.currency)}
                </span>
              ),
            },
            { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
            {
              key: '_actions',
              label: '',
              render: (row) => (row.public_token ? (
                <a
                  href={`/i/${row.public_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  View / print
                </a>
              ) : null),
            },
          ]}
        />
      </Card>

      <Card pad style={{ background: 'var(--ink-100)', border: 'none' }}>
        <h4>How to pay</h4>
        <div className="grid grid-2" style={{ marginTop: 'var(--s4)' }}>
          <div>
            <div className="small bold">Mobile money</div>
            <p className="small muted" style={{ marginTop: 4 }}>
              We accept M-Pesa, Mixx by Yas and Airtel Money.
              {contact.phone && ` Call ${contact.phone} for the payment number.`}
            </p>
          </div>
          <div>
            <div className="small bold">Bank transfer</div>
            <p className="small muted" style={{ marginTop: 4 }}>
              {finance.bank_name || 'Details are printed on each invoice'}
              {finance.bank_account && ` · Account ${finance.bank_account}`}
            </p>
          </div>
        </div>
        <p className="tiny muted" style={{ marginTop: 'var(--s4)' }}>
          Always quote the invoice reference so we can match your payment quickly.
        </p>
      </Card>
    </div>
  );
}
