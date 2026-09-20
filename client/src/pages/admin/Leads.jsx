import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, timeAgo, date, humanise } from '../../utils/format';
import { Badge } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

const SOURCES = [
  'website', 'ai_assistant', 'whatsapp', 'referral', 'event',
  'social', 'phone', 'walk_in', 'qr_code', 'other',
];

const STATUSES = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'spam'];

export default function Leads() {
  const [divisions, setDivisions] = useState([]);
  const [staff, setStaff] = useState([]);
  const { currency } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/divisions?limit=20').catch(() => ({ data: [] })),
      api.get('/users?limit=100').catch(() => ({ data: [] })),
    ]).then(([d, u]) => {
      setDivisions(d.data || []);
      setStaff((u.data || []).filter((x) => x.role_slug !== 'client'));
    });
  }, []);

  return (
    <ResourceManager
      title="Leads"
      description="Every enquiry, wherever it came from — website, WhatsApp, the AI assistant or a phone call."
      endpoint="/leads"
      searchPlaceholder="Search name, company, phone…"
      defaultSort="created_at:desc"
      modalSize="lg"
      emptyDescription="Enquiries from the website and the AI assistant land here automatically."
      filters={[
        { name: 'status', label: 'All statuses', options: STATUSES.map((s) => ({ value: s, label: humanise(s) })) },
        { name: 'source', label: 'All sources', options: SOURCES.map((s) => ({ value: s, label: humanise(s) })) },
        {
          name: 'assigned_to',
          label: 'Anyone',
          options: staff.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
        },
      ]}
      columns={[
        {
          key: 'contact_name',
          label: 'Contact',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.contact_name}</div>
              <div className="tiny muted truncate">{row.company_name || 'No company given'}</div>
            </div>
          ),
        },
        {
          key: 'reach',
          label: 'Reach them',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="small truncate">{row.phone || row.email || '—'}</div>
              {row.phone && row.email && <div className="tiny muted truncate">{row.email}</div>}
            </div>
          ),
        },
        {
          key: 'service_name',
          label: 'Interested in',
          render: (row) => <span className="small">{row.service_name || row.division_name || '—'}</span>,
        },
        {
          key: 'source',
          label: 'Source',
          render: (row) => <span className="tiny">{humanise(row.source)}</span>,
        },
        {
          key: 'estimated_value_cents',
          label: 'Value',
          align: 'right',
          render: (row) => (Number(row.estimated_value_cents) > 0
            ? money(row.estimated_value_cents, currency, row.currency)
            : <span className="muted">—</span>),
        },
        {
          key: 'assigned_name',
          label: 'Owner',
          render: (row) => <span className="small">{row.assigned_name || <span className="muted">Unassigned</span>}</span>,
        },
        {
          key: 'created_at',
          label: 'Age',
          render: (row) => <span className="tiny muted">{timeAgo(row.created_at)}</span>,
        },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ]}
      fields={[
        { name: 'contact_name', label: 'Contact name', required: true },
        { name: 'company_name', label: 'Company' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', placeholder: '+255 7XX XXX XXX' },
        { name: 'whatsapp', label: 'WhatsApp', hint: 'If different from the phone number' },
        {
          name: 'division_id',
          label: 'Division of interest',
          type: 'select',
          options: divisions.map((d) => ({ value: d.id, label: d.name })),
        },
        { name: 'subject', label: 'Subject' },
        { name: 'message', label: 'What they said', type: 'textarea', rows: 5 },
        {
          name: 'source',
          label: 'Source',
          type: 'select',
          default: 'website',
          options: SOURCES.map((s) => ({ value: s, label: humanise(s) })),
        },
        { name: 'budget_range', label: 'Budget range' },
        {
          name: 'estimated_value_cents',
          label: 'Estimated value (cents)',
          type: 'money',
          hint: 'In TZS minor units — 1,000,000 = TZS 10,000',
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          default: 'new',
          options: STATUSES.map((s) => ({ value: s, label: humanise(s) })),
        },
        {
          name: 'assigned_to',
          label: 'Assign to',
          type: 'select',
          options: staff.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
        },
        { name: 'score', label: 'Lead score (0–100)', type: 'number', default: 0 },
        { name: 'next_followup_at', label: 'Next follow-up', type: 'datetime-local' },
        {
          name: 'lost_reason',
          label: 'Reason lost',
          showIf: (form) => form.status === 'lost',
          hint: 'Worth recording honestly — it improves how you quote next time',
        },
      ]}
    />
  );
}
