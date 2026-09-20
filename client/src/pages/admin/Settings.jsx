import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { date, dateTime, number, humanise } from '../../utils/format';
import {
  Card, Button, Tabs, Field, Input, Textarea, Select, Spinner,
  Empty, Badge, DataTable, Alert, Modal,
} from '../../components/UI';

const GROUP_LABELS = {
  brand: 'Brand',
  contact: 'Contact details',
  social: 'Social links',
  seo: 'SEO defaults',
  finance: 'Finance and tax',
  ai: 'AI configuration',
  email: 'Email',
};

export default function Settings() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({});
  const [dirty, setDirty] = useState({});
  const [rates, setRates] = useState(null);
  const [roles, setRoles] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [system, setSystem] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualRate, setManualRate] = useState({ currency: 'USD', rate: '' });
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { toast, can } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'general') {
        const res = await api.get('/settings');
        setSettings(res.data || {});
        setDirty({});
      } else if (tab === 'currency') {
        const res = await api.get('/settings/rates');
        setRates(res.data);
      } else if (tab === 'roles') {
        const res = await api.get('/settings/roles');
        setRoles(res.data);
      } else if (tab === 'email') {
        const res = await api.get('/settings/email-templates');
        setTemplates(res.data || []);
      } else if (tab === 'system') {
        const [sys, act] = await Promise.all([
          api.get('/settings/system'),
          api.get('/dashboard/activity?limit=50').catch(() => ({ data: [] })),
        ]);
        setSystem(sys.data);
        setActivity(act.data || []);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => { load(); }, [load]);

  const setValue = (group, key, value) => {
    setDirty((d) => ({ ...d, [`${group}.${key}`]: value }));
  };

  const valueOf = (group, setting) => {
    const key = `${group}.${setting.setting_key}`;
    return dirty[key] !== undefined ? dirty[key] : (setting.setting_value ?? '');
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(dirty).map(([composite, value]) => {
        const [group_key, setting_key] = composite.split('.');
        const original = settings[group_key]?.find((s) => s.setting_key === setting_key);
        return {
          group_key,
          setting_key,
          setting_value: value,
          value_type: original?.value_type || 'string',
          is_public: original?.is_public ?? 1,
        };
      });
      if (payload.length === 0) {
        toast('Nothing to save', 'default');
        return;
      }
      const res = await api.patch('/settings', { settings: payload });
      toast(res.message, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const refreshRates = async () => {
    try {
      const res = await api.post('/settings/rates/refresh');
      toast(res.message, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const saveManualRate = async () => {
    try {
      const res = await api.post('/settings/rates/manual', manualRate);
      toast(res.message, 'success');
      setManualRate({ currency: 'USD', rate: '' });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const clearManual = async (currency) => {
    try {
      await api.delete(`/settings/rates/manual/${currency}`);
      toast('Live rates resumed', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const savePermissions = async (roleId, permissionIds) => {
    try {
      const res = await api.put(`/settings/roles/${roleId}/permissions`, { permission_ids: permissionIds });
      toast(res.message, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const saveTemplate = async () => {
    try {
      await api.patch(`/settings/email-templates/${editingTemplate.id}`, {
        subject: editingTemplate.subject,
        body_html: editingTemplate.body_html,
        is_active: editingTemplate.is_active ? 1 : 0,
      });
      toast('Template saved', 'success');
      setEditingTemplate(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const TABS = [
    { key: 'general', label: 'General' },
    { key: 'currency', label: 'Currency' },
    { key: 'roles', label: 'Roles' },
    { key: 'email', label: 'Email templates' },
    { key: 'system', label: 'System' },
  ];

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Settings</h2>
          <p className="muted small">Brand, tax details, currency, permissions and system health.</p>
        </div>
        {tab === 'general' && Object.keys(dirty).length > 0 && (
          <Button variant="primary" onClick={saveSettings} loading={saving}>
            Save {Object.keys(dirty).length} change{Object.keys(dirty).length === 1 ? '' : 's'}
          </Button>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {loading ? <Spinner center /> : (
        <>
          {tab === 'general' && (
            <div className="stack-lg">
              {Object.entries(settings).map(([group, list]) => (
                <Card key={group}>
                  <div className="card-header"><h4>{GROUP_LABELS[group] || humanise(group)}</h4></div>
                  <div className="card-body">
                    <div className="field-row">
                      {list.map((setting) => (
                        <Field
                          key={setting.setting_key}
                          label={setting.label || humanise(setting.setting_key)}
                          hint={setting.description}
                        >
                          {setting.value_type === 'boolean' ? (
                            <Select
                              value={String(valueOf(group, setting))}
                              onChange={(e) => setValue(group, setting.setting_key, e.target.value)}
                              options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
                            />
                          ) : setting.value_type === 'json' || String(setting.setting_value || '').length > 90 ? (
                            <Textarea
                              value={valueOf(group, setting)}
                              onChange={(e) => setValue(group, setting.setting_key, e.target.value)}
                              rows={2}
                            />
                          ) : (
                            <Input
                              type={setting.value_type === 'number' ? 'number' : 'text'}
                              value={valueOf(group, setting)}
                              onChange={(e) => setValue(group, setting.setting_key, e.target.value)}
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}

              <Alert tone="warning" title="Before you issue your first tax invoice">
                Put your company TIN and VRN into the Finance section above. They are printed
                on every tax invoice, and the TRA requires them.
              </Alert>
            </div>
          )}

          {tab === 'currency' && rates && (
            <div className="stack-lg">
              <Alert tone="info" title="Where these rates come from">
                Rates refresh automatically from a free public exchange-rate feed, with a
                second provider as backup. A manual rate always overrides the live one —
                use that when you have agreed a fixed rate with a client.
              </Alert>

              <Card>
                <div className="card-header">
                  <h4>Current rates against the shilling</h4>
                  <Button variant="outline" size="sm" onClick={refreshRates}>Refresh now</Button>
                </div>
                <DataTable
                  rows={rates.detail || []}
                  columns={[
                    {
                      key: 'base_currency',
                      label: 'Currency',
                      render: (row) => <span className="bold mono">{row.base_currency}</span>,
                    },
                    {
                      key: 'rate',
                      label: '1 unit equals',
                      align: 'right',
                      render: (row) => (
                        <span className="bold">TZS {Number(row.rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      ),
                    },
                    {
                      key: 'source',
                      label: 'Source',
                      render: (row) => (
                        <div className="row" style={{ gap: 'var(--s2)' }}>
                          <span className="tiny">{row.source}</span>
                          {row.is_manual === 1 && <span className="badge badge-warning">Manual</span>}
                        </div>
                      ),
                    },
                    { key: 'valid_date', label: 'For date', render: (row) => <span className="small">{date(row.valid_date)}</span> },
                    {
                      key: '_actions',
                      label: '',
                      render: (row) => (row.is_manual === 1 ? (
                        <Button size="sm" variant="ghost" onClick={() => clearManual(row.base_currency)}>
                          Use live rate
                        </Button>
                      ) : null),
                    },
                  ]}
                />
              </Card>

              <Card>
                <div className="card-header"><h4>Set a manual rate</h4></div>
                <div className="card-body">
                  <div className="field-row">
                    <Field label="Currency">
                      <Select
                        value={manualRate.currency}
                        onChange={(e) => setManualRate({ ...manualRate, currency: e.target.value })}
                        options={['USD', 'EUR', 'GBP', 'KES', 'UGX', 'ZAR'].map((c) => ({ value: c, label: c }))}
                      />
                    </Field>
                    <Field label="Shillings per unit" hint="e.g. 2650 means USD 1 = TZS 2,650">
                      <Input
                        type="number"
                        step="0.01"
                        value={manualRate.rate}
                        onChange={(e) => setManualRate({ ...manualRate, rate: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Button variant="primary" onClick={saveManualRate} disabled={!manualRate.rate}>
                    Set manual rate
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {tab === 'roles' && roles && (
            <div className="stack-lg">
              {roles.roles.map((role) => (
                <Card key={role.id}>
                  <div className="card-header">
                    <div>
                      <h4>{role.name}</h4>
                      <span className="tiny muted">
                        {role.description} · {number(role.user_count)} user{role.user_count === 1 ? '' : 's'}
                      </span>
                    </div>
                    {role.slug === 'admin' && <Badge tone="brand">Always has everything</Badge>}
                  </div>

                  {role.slug !== 'admin' && (
                    <div className="card-body">
                      <RolePermissions
                        role={role}
                        groups={roles.permissions_by_module}
                        onSave={savePermissions}
                        disabled={!can('roles.manage')}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {tab === 'email' && (
            <Card>
              <div className="card-header"><h4>Email templates</h4></div>
              <DataTable
                rows={templates}
                onRowClick={(row) => setEditingTemplate(row)}
                empty={<Empty title="No templates" />}
                columns={[
                  { key: 'name', label: 'Template', render: (row) => <span className="bold">{row.name}</span> },
                  { key: 'subject', label: 'Subject', render: (row) => <span className="small truncate">{row.subject}</span> },
                  {
                    key: 'is_active',
                    label: 'Active',
                    render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'On' : 'Off'}</Badge>,
                  },
                ]}
              />
            </Card>
          )}

          {tab === 'system' && system && (
            <div className="stack-lg">
              <div className="grid grid-4">
                <Card pad>
                  <div className="tiny muted">Users</div>
                  <div className="bold" style={{ fontSize: 'var(--text-xl)' }}>{number(system.counts.users)}</div>
                </Card>
                <Card pad>
                  <div className="tiny muted">Clients</div>
                  <div className="bold" style={{ fontSize: 'var(--text-xl)' }}>{number(system.counts.organisations)}</div>
                </Card>
                <Card pad>
                  <div className="tiny muted">Media files</div>
                  <div className="bold" style={{ fontSize: 'var(--text-xl)' }}>{number(system.counts.media_files)}</div>
                </Card>
                <Card pad>
                  <div className="tiny muted">Uptime</div>
                  <div className="bold" style={{ fontSize: 'var(--text-xl)' }}>
                    {Math.floor(system.uptime_seconds / 3600)}h
                  </div>
                  <div className="tiny muted">Node {system.node_version}</div>
                </Card>
              </div>

              <Card>
                <div className="card-header">
                  <div>
                    <h4>Audit log</h4>
                    <span className="tiny muted">Who changed what, and when</span>
                  </div>
                </div>
                <DataTable
                  rows={activity}
                  empty={<Empty title="No activity recorded yet" />}
                  columns={[
                    { key: 'user_name', label: 'Who', render: (row) => <span className="small">{row.user_name || 'System'}</span> },
                    { key: 'action', label: 'Action', render: (row) => <Badge tone="neutral">{humanise(row.action)}</Badge> },
                    {
                      key: 'entity',
                      label: 'What',
                      render: (row) => (
                        <div style={{ minWidth: 0 }}>
                          <div className="small truncate">{row.entity_label || `#${row.entity_id}`}</div>
                          <div className="tiny muted">{humanise(row.entity_type)}</div>
                        </div>
                      ),
                    },
                    { key: 'created_at', label: 'When', render: (row) => <span className="tiny muted">{dateTime(row.created_at)}</span> },
                  ]}
                />
              </Card>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title={editingTemplate?.name}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveTemplate}>Save template</Button>
          </>
        }
      >
        {editingTemplate && (
          <>
            {editingTemplate.variables?.length > 0 && (
              <Alert tone="info" title="Available merge tags">
                {editingTemplate.variables.map((v) => `{{${v}}}`).join('  ·  ')}
              </Alert>
            )}
            <Field label="Subject" required>
              <Input
                value={editingTemplate.subject}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
              />
            </Field>
            <Field label="Body (HTML)">
              <Textarea
                value={editingTemplate.body_html}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, body_html: e.target.value })}
                rows={12}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
              />
            </Field>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={!!editingTemplate.is_active}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })}
              />
              <span className="small">Template is active</span>
            </label>
          </>
        )}
      </Modal>
    </div>
  );
}

/** Permission checkboxes for one role, grouped by module. */
function RolePermissions({ role, groups, onSave, disabled }) {
  const [selected, setSelected] = useState(role.permission_ids || []);
  const [changed, setChanged] = useState(false);

  const toggle = (id) => {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    setChanged(true);
  };

  const toggleModule = (permissions, on) => {
    const ids = permissions.map((p) => p.id);
    setSelected((list) => (on
      ? [...new Set([...list, ...ids])]
      : list.filter((x) => !ids.includes(x))));
    setChanged(true);
  };

  return (
    <>
      <div className="grid grid-3">
        {Object.entries(groups).map(([module, permissions]) => {
          const allOn = permissions.every((p) => selected.includes(p.id));
          return (
            <div key={module}>
              <div className="row-between" style={{ marginBottom: 'var(--s2)' }}>
                <span className="bold small">{humanise(module)}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleModule(permissions, !allOn)}
                  disabled={disabled}
                  style={{ fontSize: 11 }}
                >
                  {allOn ? 'None' : 'All'}
                </button>
              </div>
              <div className="stack" style={{ gap: 4 }}>
                {permissions.map((permission) => (
                  <label key={permission.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selected.includes(permission.id)}
                      onChange={() => toggle(permission.id)}
                      disabled={disabled}
                    />
                    <span className="tiny">{permission.slug.split('.')[1]}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {changed && !disabled && (
        <Button
          variant="primary"
          style={{ marginTop: 'var(--s5)' }}
          onClick={() => { onSave(role.id, selected); setChanged(false); }}
        >
          Save {role.name} permissions
        </Button>
      )}
    </>
  );
}
