import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { timeAgo, humanise } from '../../utils/format';
import { Badge, Avatar } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

const DIVISIONS = ['creative', 'digital', 'ai', 'events', 'production', 'finance', 'management'];

export default function Users() {
  const [roles, setRoles] = useState([]);
  const [organisations, setOrganisations] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/settings/roles').catch(() => ({ data: { roles: [] } })),
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
    ]).then(([r, o]) => {
      setRoles(r.data?.roles || []);
      setOrganisations(o.data || []);
    });
  }, []);

  return (
    <ResourceManager
      title="Users"
      description="Staff and client accounts. Roles decide what each person can see and change."
      endpoint="/users"
      searchPlaceholder="Search name or email…"
      defaultSort="created_at:desc"
      modalSize="lg"
      emptyDescription="Invite your team, then create portal logins for your clients."
      filters={[
        { name: 'role_id', label: 'All roles', options: roles.map((r) => ({ value: r.id, label: r.name })) },
        { name: 'is_active', label: 'All accounts', options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Deactivated' }] },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Person',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              <Avatar src={row.avatar_url} first={row.first_name} last={row.last_name} />
              <div style={{ minWidth: 0 }}>
                <div className="bold truncate">{row.first_name} {row.last_name}</div>
                <div className="tiny muted truncate">{row.email}</div>
              </div>
            </div>
          ),
        },
        {
          key: 'role_name',
          label: 'Role',
          render: (row) => (
            <Badge tone={row.role_slug === 'admin' ? 'brand' : row.role_slug === 'staff' ? 'info' : 'neutral'}>
              {row.role_name}
            </Badge>
          ),
        },
        {
          key: 'organisation_name',
          label: 'Organisation',
          render: (row) => <span className="small">{row.organisation_name || '—'}</span>,
        },
        {
          key: 'division',
          label: 'Pod',
          render: (row) => <span className="small">{row.division ? humanise(row.division) : '—'}</span>,
        },
        {
          key: 'last_login_at',
          label: 'Last seen',
          render: (row) => (
            <span className="tiny muted">
              {row.last_login_at ? timeAgo(row.last_login_at) : 'Never signed in'}
            </span>
          ),
        },
        {
          key: 'is_active',
          label: 'Status',
          render: (row) => (
            <Badge tone={row.is_active ? 'success' : 'neutral'}>
              {row.is_active ? 'Active' : 'Deactivated'}
            </Badge>
          ),
        },
      ]}
      fields={[
        { name: 'first_name', label: 'First name', required: true },
        { name: 'last_name', label: 'Last name', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          hint: 'Required when creating. Leave blank when editing to keep the existing password.',
        },
        {
          name: 'role_id',
          label: 'Role',
          type: 'select',
          required: true,
          options: roles.map((r) => ({ value: r.id, label: `${r.name} — ${r.description || ''}` })),
        },
        {
          name: 'organisation_id',
          label: 'Organisation',
          type: 'select',
          hint: 'Required for client accounts; leave blank for your own staff',
          options: organisations.map((o) => ({ value: o.id, label: o.name })),
        },
        { name: 'job_title', label: 'Job title' },
        {
          name: 'division',
          label: 'Pod',
          type: 'select',
          hint: 'Which part of the business they work in',
          options: DIVISIONS.map((d) => ({ value: d, label: humanise(d) })),
        },
        { name: 'phone', label: 'Phone' },
        { name: 'avatar_media_id', label: 'Photo', type: 'media' },
        {
          name: 'display_currency',
          label: 'Preferred currency',
          type: 'select',
          default: 'TZS',
          options: [{ value: 'TZS', label: 'TZS' }, { value: 'USD', label: 'USD' }],
        },
        { name: 'is_active', label: 'Account is active', type: 'checkbox', default: 1 },
        {
          name: 'must_change_password',
          label: 'Force a password change at next sign-in',
          type: 'checkbox',
          hint: 'Use this when you have set a temporary password for someone',
        },
      ]}
    />
  );
}
