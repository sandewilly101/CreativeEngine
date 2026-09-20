import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, dateTime, date, number, humanise } from '../../utils/format';
import { Badge } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

const TYPES = ['conference', 'launch', 'activation', 'exhibition', 'gala', 'workshop', 'roadshow', 'other'];

export default function Events() {
  const [organisations, setOrganisations] = useState([]);
  const [staff, setStaff] = useState([]);
  const { currency } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
      api.get('/users?limit=100').catch(() => ({ data: [] })),
    ]).then(([o, u]) => {
      setOrganisations(o.data || []);
      setStaff((u.data || []).filter((x) => x.role_slug !== 'client'));
    });
  }, []);

  return (
    <ResourceManager
      title="Events"
      description="Conferences, launches, activations and exhibitions — with registration and check-in built in."
      endpoint="/events"
      searchPlaceholder="Search event, venue or reference…"
      defaultSort="start_datetime:desc"
      modalSize="lg"
      emptyDescription="Create an event to open registration and track production against budget."
      filters={[
        {
          name: 'status',
          label: 'All statuses',
          options: ['planning', 'confirmed', 'live', 'completed', 'cancelled']
            .map((s) => ({ value: s, label: humanise(s) })),
        },
        { name: 'type', label: 'All types', options: TYPES.map((t) => ({ value: t, label: humanise(t) })) },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Event',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="bold truncate">{row.name}</div>
              <div className="tiny muted truncate">
                {row.reference} · {humanise(row.type)}
              </div>
            </div>
          ),
        },
        {
          key: 'organisation_name',
          label: 'Client',
          render: (row) => <span className="small">{row.organisation_name || '—'}</span>,
        },
        {
          key: 'start_datetime',
          label: 'When',
          render: (row) => (
            <div>
              <div className="small">{date(row.start_datetime)}</div>
              <div className="tiny muted truncate">{row.venue || row.city}</div>
            </div>
          ),
        },
        {
          key: 'registered_count',
          label: 'Registered',
          align: 'right',
          render: (row) => (
            <div>
              <span className="bold">{number(row.registered_count)}</span>
              {row.capacity && <span className="tiny muted"> / {number(row.capacity)}</span>}
            </div>
          ),
        },
        {
          key: 'budget_cents',
          label: 'Budget',
          align: 'right',
          render: (row) => money(row.budget_cents, currency, row.currency),
        },
        {
          key: 'margin',
          label: 'Margin',
          align: 'right',
          render: (row) => {
            const budget = Number(row.budget_cents);
            const cost = Number(row.cost_cents);
            if (!budget) return <span className="muted">—</span>;
            const pct = ((budget - cost) / budget) * 100;
            return (
              <span style={{ color: pct < 20 ? 'var(--danger)' : pct < 35 ? 'var(--warning)' : 'var(--success)' }}>
                {pct.toFixed(0)}%
              </span>
            );
          },
        },
        {
          key: 'registration_open',
          label: 'Registration',
          render: (row) => (
            <Badge tone={row.registration_open ? 'success' : 'neutral'}>
              {row.registration_open ? 'Open' : 'Closed'}
            </Badge>
          ),
        },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Event name', required: true },
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          default: 'conference',
          options: TYPES.map((t) => ({ value: t, label: humanise(t) })),
        },
        {
          name: 'organisation_id',
          label: 'Client',
          type: 'select',
          options: organisations.map((o) => ({ value: o.id, label: o.name })),
        },
        { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
        { name: 'cover_media_id', label: 'Cover image', type: 'media' },
        { name: 'venue', label: 'Venue' },
        { name: 'venue_address', label: 'Venue address', type: 'textarea', rows: 2 },
        { name: 'city', label: 'City', default: 'Dar es Salaam' },
        { name: 'start_datetime', label: 'Starts', type: 'datetime-local', required: true },
        { name: 'end_datetime', label: 'Ends', type: 'datetime-local', required: true },
        { name: 'expected_attendees', label: 'Expected attendance', type: 'number' },
        { name: 'actual_attendees', label: 'Actual attendance', type: 'number' },
        { name: 'budget_cents', label: 'Client budget (cents)', type: 'money' },
        { name: 'cost_cents', label: 'Our cost so far (cents)', type: 'money', hint: 'Suppliers, crew, transport — drives the margin figure' },
        {
          name: 'manager_id',
          label: 'Event manager',
          type: 'select',
          options: staff.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
        },
        { name: 'is_public', label: 'Publish a public event page', type: 'checkbox' },
        { name: 'registration_open', label: 'Registration is open', type: 'checkbox' },
        { name: 'registration_closes_at', label: 'Registration closes', type: 'datetime-local', showIf: (f) => f.registration_open },
        { name: 'capacity', label: 'Capacity', type: 'number', hint: 'Registrations beyond this go on a waitlist' },
        { name: 'is_ticketed', label: 'Paid tickets', type: 'checkbox' },
        { name: 'ticket_price_cents', label: 'Ticket price (cents)', type: 'money', showIf: (f) => f.is_ticketed },
        {
          name: 'run_sheet',
          label: 'Run sheet',
          type: 'json',
          hint: 'Array of {"time":"09:00","item":"Doors open","owner":"Ops"}',
          placeholder: '[{"time":"09:00","item":"Doors open","owner":"Ops"}]',
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          default: 'planning',
          options: ['planning', 'confirmed', 'live', 'completed', 'cancelled']
            .map((s) => ({ value: s, label: humanise(s) })),
        },
      ]}
    />
  );
}
