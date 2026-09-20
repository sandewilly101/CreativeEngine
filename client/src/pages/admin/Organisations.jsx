import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, humanise } from '../../utils/format';
import { Badge, Avatar } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

export default function Organisations() {
  const [managers, setManagers] = useState([]);
  const { currency } = useApp();

  useEffect(() => {
    api.get('/users?role_id=1,2&limit=100')
      .then((res) => setManagers(res.data || []))
      .catch(() => setManagers([]));
  }, []);

  return (
    <ResourceManager
      title="Clients"
      description="Every organisation you work with, their tax details and their account position."
      endpoint="/organisations"
      searchPlaceholder="Search by name, email, TIN…"
      defaultSort="name:asc"
      modalSize="lg"
      emptyDescription="Add your first client organisation to start raising quotes and invoices."
      filters={[
        {
          name: 'status',
          label: 'All statuses',
          options: [
            { value: 'lead', label: 'Lead' },
            { value: 'active', label: 'Active' },
            { value: 'dormant', label: 'Dormant' },
            { value: 'archived', label: 'Archived' },
          ],
        },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Organisation',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              <Avatar src={row.logo_url} name={row.name} />
              <div style={{ minWidth: 0 }}>
                <div className="bold truncate">{row.name}</div>
                <div className="tiny muted truncate">{row.industry || row.city || '—'}</div>
              </div>
            </div>
          ),
        },
        {
          key: 'contact',
          label: 'Contact',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="small truncate">{row.email || '—'}</div>
              <div className="tiny muted">{row.phone || ''}</div>
            </div>
          ),
        },
        {
          key: 'tin',
          label: 'TIN / VRN',
          render: (row) => (
            <div className="tiny mono">
              {row.tin || '—'}
              {row.vrn && <div className="muted">{row.vrn}</div>}
            </div>
          ),
        },
        {
          key: 'project_count',
          label: 'Projects',
          align: 'right',
          render: (row) => row.project_count || 0,
        },
        {
          key: 'outstanding_cents',
          label: 'Outstanding',
          align: 'right',
          render: (row) => (
            <span style={{ color: Number(row.outstanding_cents) > 0 ? 'var(--danger)' : 'var(--ink-400)' }}>
              {money(row.outstanding_cents || 0, currency)}
            </span>
          ),
        },
        {
          key: 'account_manager_name',
          label: 'Manager',
          render: (row) => <span className="small">{row.account_manager_name || '—'}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <Badge status={row.status} />,
        },
      ]}
      fields={[
        { name: 'name', label: 'Organisation name', required: true },
        { name: 'legal_name', label: 'Registered legal name', hint: 'As it appears on tax documents, if different' },
        { name: 'industry', label: 'Industry', placeholder: 'Banking, FMCG, NGO…' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          default: 'active',
          options: [
            { value: 'lead', label: 'Lead' },
            { value: 'active', label: 'Active' },
            { value: 'dormant', label: 'Dormant' },
            { value: 'archived', label: 'Archived' },
          ],
        },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', placeholder: '+255 7XX XXX XXX' },
        { name: 'website', label: 'Website' },
        { name: 'tin', label: 'TIN', hint: 'Taxpayer Identification Number — appears on tax invoices' },
        { name: 'vrn', label: 'VRN', hint: 'VAT Registration Number, if VAT registered' },
        { name: 'is_vat_exempt', label: 'VAT exempt', type: 'checkbox', hint: 'Tick only for organisations with a valid exemption' },
        { name: 'address_line1', label: 'Address' },
        { name: 'city', label: 'City', default: 'Dar es Salaam' },
        { name: 'region', label: 'Region' },
        {
          name: 'preferred_currency',
          label: 'Preferred currency',
          type: 'select',
          default: 'TZS',
          options: [{ value: 'TZS', label: 'TZS' }, { value: 'USD', label: 'USD' }],
        },
        { name: 'payment_terms_days', label: 'Payment terms (days)', type: 'number', default: 30 },
        {
          name: 'account_manager_id',
          label: 'Account manager',
          type: 'select',
          options: managers.map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` })),
        },
        { name: 'logo_media_id', label: 'Logo', type: 'media' },
        { name: 'notes', label: 'Internal notes', type: 'textarea', hint: 'Never shown to the client' },
      ]}
    />
  );
}
