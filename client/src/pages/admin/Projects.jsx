import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, humanise, daysUntil } from '../../utils/format';
import {
  Card, Button, DataTable, Pagination, SearchInput, Badge,
  Progress, Empty, Modal, Field, Input, Textarea, Select,
} from '../../components/UI';

const STAGES = ['discover', 'strategy', 'create', 'build', 'activate', 'measure', 'optimize'];
const STATUSES = ['planning', 'active', 'on_hold', 'review', 'completed', 'cancelled'];

export default function Projects() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({});
  const [organisations, setOrganisations] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const { currency, toast } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
      api.get('/divisions?limit=20').catch(() => ({ data: [] })),
      api.get('/users?limit=100').catch(() => ({ data: [] })),
    ]).then(([o, d, u]) => {
      setOrganisations(o.data || []);
      setDivisions(d.data || []);
      setStaff((u.data || []).filter((x) => x.role_slug !== 'client'));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects${api.qs({
        page, search, status, sort: 'created_at:desc',
      })}`);
      setRows(res.data || []);
      setPagination(res.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  const create = async () => {
    setSaving(true);
    try {
      const res = await api.post('/projects', form);
      toast(res.message, 'success');
      setCreating(false);
      setForm({});
      navigate(`/admin/projects/${res.data.id}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Projects</h2>
          <p className="muted small">
            Work in delivery, tracked through the seven stages from discover to optimize.
          </p>
        </div>
        <Button variant="primary" onClick={() => { setForm({ status: 'planning', stage: 'discover' }); setCreating(true); }}>
          + New project
        </Button>
      </div>

      <Card>
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search project, reference or client…" />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
          </select>
        </div>

        <DataTable
          loading={loading}
          rows={rows}
          onRowClick={(row) => navigate(`/admin/projects/${row.id}`)}
          empty={
            <Empty
              title="No projects"
              description="Create one directly, or convert an accepted quote into a project."
            />
          }
          columns={[
            {
              key: 'name',
              label: 'Project',
              render: (row) => (
                <div style={{ minWidth: 0 }}>
                  <div className="bold truncate">{row.name}</div>
                  <div className="tiny muted truncate">{row.reference} · {row.organisation_name}</div>
                </div>
              ),
            },
            {
              key: 'division_name',
              label: 'Division',
              render: (row) => (row.division_name ? (
                <span className="badge" style={{
                  background: `${row.division_color || '#f74932'}18`,
                  color: row.division_color || 'var(--orange-500)',
                }}>
                  {row.division_name}
                </span>
              ) : <span className="muted">—</span>),
            },
            {
              key: 'stage',
              label: 'Stage',
              render: (row) => <span className="small">{humanise(row.stage)}</span>,
            },
            {
              key: 'progress_percent',
              label: 'Progress',
              render: (row) => (
                <div style={{ minWidth: 110 }}>
                  <div className="tiny" style={{ marginBottom: 3 }}>
                    {row.progress_percent}% · {row.tasks_done}/{row.task_count} tasks
                  </div>
                  <Progress
                    value={row.progress_percent}
                    tone={row.health === 'off_track' ? 'danger' : row.health === 'at_risk' ? 'warning' : undefined}
                  />
                </div>
              ),
            },
            {
              key: 'due_date',
              label: 'Due',
              render: (row) => {
                const days = daysUntil(row.due_date);
                const late = days !== null && days < 0 && !['completed', 'cancelled'].includes(row.status);
                return (
                  <div>
                    <div className="small" style={{ color: late ? 'var(--danger)' : undefined }}>
                      {date(row.due_date)}
                    </div>
                    {late && <div className="tiny" style={{ color: 'var(--danger)' }}>{Math.abs(days)} days late</div>}
                  </div>
                );
              },
            },
            {
              key: 'budget_cents',
              label: 'Budget',
              align: 'right',
              render: (row) => money(row.budget_cents, currency, row.currency),
            },
            {
              key: 'awaiting_approval',
              label: 'To approve',
              align: 'right',
              render: (row) => (Number(row.awaiting_approval) > 0
                ? <span className="badge badge-warning">{row.awaiting_approval}</span>
                : <span className="muted">—</span>),
            },
            {
              key: 'manager_name',
              label: 'Manager',
              render: (row) => <span className="small">{row.manager_name || '—'}</span>,
            },
            { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
          ]}
        />

        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          onChange={setPage}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New project"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create project</Button>
          </>
        }
      >
        <Field label="Project name" required>
          <Input
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Annual conference 2026"
          />
        </Field>

        <div className="field-row">
          <Field label="Client" required>
            <Select
              value={form.organisation_id || ''}
              onChange={(e) => setForm({ ...form, organisation_id: e.target.value })}
              placeholder="Choose a client"
              options={organisations.map((o) => ({ value: o.id, label: o.name }))}
            />
          </Field>
          <Field label="Division">
            <Select
              value={form.division_id || ''}
              onChange={(e) => setForm({ ...form, division_id: e.target.value })}
              placeholder="Select"
              options={divisions.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Field>
        </div>

        <Field label="Brief" hint="The agreed scope. This is what the team works from.">
          <Textarea
            value={form.brief || ''}
            onChange={(e) => setForm({ ...form, brief: e.target.value })}
            rows={5}
          />
        </Field>

        <div className="field-row">
          <Field label="Start date">
            <Input type="date" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <Field label="Budget (cents)">
            <Input type="number" value={form.budget_cents || ''} onChange={(e) => setForm({ ...form, budget_cents: e.target.value })} />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Project manager">
            <Select
              value={form.project_manager_id || ''}
              onChange={(e) => setForm({ ...form, project_manager_id: e.target.value })}
              placeholder="Assign"
              options={staff.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
            />
          </Field>
          <Field label="Stage">
            <Select
              value={form.stage || 'discover'}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              options={STAGES.map((s) => ({ value: s, label: humanise(s) }))}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority || 'normal'}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={['low', 'normal', 'high', 'urgent'].map((p) => ({ value: p, label: humanise(p) }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
