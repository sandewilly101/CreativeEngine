import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { date, timeAgo, humanise } from '../../utils/format';
import {
  Card, Spinner, Badge, Empty, DataTable, Button, Modal,
  Field, Input, Textarea, Select, Progress, Alert,
} from '../../components/UI';

export default function PortalRequests() {
  const [requests, setRequests] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const { toast } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [req, subs, svc] = await Promise.all([
        api.get('/service-requests?limit=50&sort=created_at:desc'),
        api.get('/subscriptions?status=active&limit=20').catch(() => ({ data: [] })),
        api.get('/public/services').catch(() => ({ data: [] })),
      ]);
      setRequests(req.data || []);
      setSubscriptions(subs.data || []);
      setServices(svc.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await api.post('/service-requests', form);
      toast('Request submitted. We will pick it up shortly.', 'success');
      setCreating(false);
      setForm({ priority: 'normal' });
      load();
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
          <h2>Service requests</h2>
          <p className="muted small">
            Need something done? Raise it here and it goes straight into our queue.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>+ New request</Button>
      </div>

      {subscriptions.length > 0 && (
        <div className="grid grid-2">
          {subscriptions.filter((s) => s.capacity_units).map((sub) => {
            const pct = (Number(sub.capacity_used) / Number(sub.capacity_units)) * 100;
            return (
              <Card key={sub.id} pad>
                <div className="row-between">
                  <div>
                    <div className="bold small">{sub.name}</div>
                    <div className="tiny muted">
                      {sub.capacity_used} of {sub.capacity_units} used this cycle
                    </div>
                  </div>
                  <Badge status={sub.status} />
                </div>
                <div style={{ marginTop: 'var(--s3)' }}>
                  <Progress value={pct} tone={pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : undefined} />
                </div>
                {pct >= 80 && pct < 100 && (
                  <div className="tiny" style={{ color: 'var(--warning)', marginTop: 'var(--s2)' }}>
                    Approaching your included allowance for this cycle.
                  </div>
                )}
                {pct >= 100 && (
                  <div className="tiny" style={{ color: 'var(--danger)', marginTop: 'var(--s2)' }}>
                    Allowance used. Further requests this cycle are charged at the agreed overage rate.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <DataTable
          loading={loading}
          rows={requests}
          empty={
            <Empty
              title="No requests yet"
              description="Anything from a small design change to a new campaign — raise it here."
              action={<Button variant="primary" onClick={() => setCreating(true)}>Make a request</Button>}
            />
          }
          columns={[
            {
              key: 'title',
              label: 'Request',
              render: (row) => (
                <div style={{ minWidth: 0 }}>
                  <div className="bold truncate">{row.title}</div>
                  <div className="tiny muted">{row.reference}</div>
                </div>
              ),
            },
            {
              key: 'service_name',
              label: 'Service',
              render: (row) => <span className="small">{row.service_name || '—'}</span>,
            },
            {
              key: 'priority',
              label: 'Priority',
              render: (row) => (
                <Badge tone={row.priority === 'urgent' ? 'danger' : row.priority === 'high' ? 'warning' : 'neutral'}>
                  {humanise(row.priority)}
                </Badge>
              ),
            },
            {
              key: 'created_at',
              label: 'Raised',
              render: (row) => <span className="tiny muted">{timeAgo(row.created_at)}</span>,
            },
            {
              key: 'assignee_name',
              label: 'With',
              render: (row) => <span className="small">{row.assignee_name || 'Being assigned'}</span>,
            },
            { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New service request"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} loading={saving} disabled={!form.title?.trim()}>
              Submit request
            </Button>
          </>
        }
      >
        <Alert tone="info" title="What happens next">
          We acknowledge every request within one working day and tell you whether it falls
          inside your current agreement or needs a separate quote.
        </Alert>

        <Field label="What do you need?" required>
          <Input
            value={form.title || ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Update the banner on the homepage"
          />
        </Field>

        <Field label="Tell us more" hint="The more detail you give, the less back-and-forth there is">
          <Textarea
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={5}
            placeholder="What needs to change, why, and by when?"
          />
        </Field>

        <div className="field-row">
          <Field label="Related service">
            <Select
              value={form.service_id || ''}
              onChange={(e) => setForm({ ...form, service_id: e.target.value })}
              placeholder="Not sure"
              options={services.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>
          <Field label="Under which agreement?">
            <Select
              value={form.subscription_id || ''}
              onChange={(e) => setForm({ ...form, subscription_id: e.target.value })}
              placeholder="One-off request"
              options={subscriptions.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low — whenever you can' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High — needed soon' },
                { value: 'urgent', label: 'Urgent — blocking us' },
              ]}
            />
          </Field>
          <Field label="Needed by">
            <Input
              type="date"
              value={form.due_date || ''}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
