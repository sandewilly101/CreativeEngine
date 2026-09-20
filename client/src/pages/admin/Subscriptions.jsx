import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, daysUntil, humanise } from '../../utils/format';
import { Badge, Progress } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

const TYPES = ['retainer', 'hosting', 'ai_assistant', 'maintenance', 'print_account', 'other'];

export default function Subscriptions() {
  const [organisations, setOrganisations] = useState([]);
  const [packages, setPackages] = useState([]);
  const { currency } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
      api.get('/packages?limit=50').catch(() => ({ data: [] })),
    ]).then(([o, p]) => {
      setOrganisations(o.data || []);
      setPackages(p.data || []);
    });
  }, []);

  return (
    <ResourceManager
      title="Subscriptions"
      description="Your recurring revenue. Capacity-based retainers protect margin in a way unlimited ones never do."
      endpoint="/subscriptions"
      searchPlaceholder="Search reference or name…"
      defaultSort="next_billing_date:asc"
      modalSize="lg"
      emptyDescription="Retainers, hosting, AI assistants and print accounts live here."
      filters={[
        {
          name: 'status',
          label: 'All statuses',
          options: ['trial', 'active', 'past_due', 'paused', 'cancelled', 'expired']
            .map((s) => ({ value: s, label: humanise(s) })),
        },
        { name: 'type', label: 'All types', options: TYPES.map((t) => ({ value: t, label: humanise(t) })) },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Subscription',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.name}</div>
              <div className="tiny muted truncate">{row.organisation_name} · {row.reference}</div>
            </div>
          ),
        },
        { key: 'type', label: 'Type', render: (row) => <span className="small">{humanise(row.type)}</span> },
        {
          key: 'amount_cents',
          label: 'Amount',
          align: 'right',
          render: (row) => (
            <div>
              <div className="bold">{money(row.amount_cents, currency, row.currency)}</div>
              <div className="tiny muted">per {row.billing_interval.replace('ly', '')}</div>
            </div>
          ),
        },
        {
          key: 'capacity',
          label: 'Capacity used',
          render: (row) => {
            if (!row.capacity_units) return <span className="tiny muted">Not capped</span>;
            const pct = (Number(row.capacity_used) / Number(row.capacity_units)) * 100;
            return (
              <div style={{ minWidth: 100 }}>
                <div className="tiny" style={{ marginBottom: 3 }}>
                  {row.capacity_used} / {row.capacity_units}
                </div>
                <Progress value={pct} tone={pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : undefined} />
              </div>
            );
          },
        },
        {
          key: 'next_billing_date',
          label: 'Next bill',
          render: (row) => {
            const days = daysUntil(row.next_billing_date);
            return (
              <div>
                <div className="small">{date(row.next_billing_date)}</div>
                {days !== null && days <= 7 && days >= 0 && (
                  <div className="tiny" style={{ color: 'var(--warning)' }}>in {days} days</div>
                )}
              </div>
            );
          },
        },
        {
          key: 'collection_method',
          label: 'Collection',
          render: (row) => (
            <span className="tiny" title="Tigo Pesa / Mixx does not support recurring debit, so most clients are invoiced">
              {humanise(row.collection_method)}
            </span>
          ),
        },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Subscription name', required: true, placeholder: 'Monthly social retainer' },
        {
          name: 'organisation_id',
          label: 'Client',
          type: 'select',
          required: true,
          options: organisations.map((o) => ({ value: o.id, label: o.name })),
        },
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          default: 'retainer',
          options: TYPES.map((t) => ({ value: t, label: humanise(t) })),
        },
        {
          name: 'package_id',
          label: 'Based on package',
          type: 'select',
          options: packages.map((p) => ({ value: p.id, label: p.name })),
        },
        { name: 'description', label: 'What it covers', type: 'textarea' },
        { name: 'amount_cents', label: 'Amount per cycle (cents)', type: 'money', required: true },
        {
          name: 'billing_interval',
          label: 'Billing cycle',
          type: 'select',
          default: 'monthly',
          options: [
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'annual', label: 'Annual' },
          ],
        },
        {
          name: 'capacity_units',
          label: 'Included deliverables per cycle',
          type: 'number',
          hint: 'Leave blank for uncapped. Capping is what keeps a retainer profitable.',
        },
        { name: 'overage_rate_cents', label: 'Rate beyond capacity (cents)', type: 'money' },
        { name: 'start_date', label: 'Start date', type: 'date', required: true },
        { name: 'end_date', label: 'End date', type: 'date', hint: 'Leave blank for open-ended' },
        { name: 'next_billing_date', label: 'Next billing date', type: 'date' },
        { name: 'min_term_months', label: 'Minimum term (months)', type: 'number', default: 0 },
        {
          name: 'collection_method',
          label: 'How it is collected',
          type: 'select',
          default: 'invoice_push',
          hint: 'Mixx by Yas does not support recurring debit, so invoicing is usually the realistic option',
          options: [
            { value: 'invoice_push', label: 'Invoice, client pays' },
            { value: 'auto_debit', label: 'Automatic debit' },
            { value: 'standing_order', label: 'Bank standing order' },
          ],
        },
        { name: 'auto_invoice', label: 'Raise the invoice automatically each cycle', type: 'checkbox', default: 1 },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          default: 'active',
          options: ['trial', 'active', 'past_due', 'paused', 'cancelled', 'expired']
            .map((s) => ({ value: s, label: humanise(s) })),
        },
        { name: 'cancellation_reason', label: 'Reason for cancelling', showIf: (f) => f.status === 'cancelled' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
    />
  );
}
