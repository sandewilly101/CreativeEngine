import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { moneyCompact, money, number, percent, date, daysUntil } from '../../utils/format';
import { Spinner, Card, StatTile, Badge, Empty } from '../../components/UI';

/**
 * Recharts cannot read CSS custom properties, so the brand colours are
 * repeated here as literals. Keep them in step with global.css.
 */
const CHART = {
  lime: '#ccff01',
  limeDeep: '#b4e300',
  flame: '#f74932',
  ink: '#191919',
  grid: '#e5e5e5',
  axis: '#818181',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [attention, setAttention] = useState(null);
  const [trend, setTrend] = useState(null);
  const [divisionPerf, setDivisionPerf] = useState([]);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const { currency, user, can } = useApp();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/dashboard?period=${period}`).catch(() => null),
      api.get('/dashboard/attention').catch(() => null),
      can('reports.view') ? api.get('/dashboard/revenue-trend?months=12').catch(() => null) : null,
      can('reports.view') ? api.get('/dashboard/division-performance?days=90').catch(() => null) : null,
    ])
      .then(([s, a, t, d]) => {
        setStats(s?.data || null);
        setAttention(a?.data || null);
        setTrend(t?.data || null);
        setDivisionPerf(d?.data || []);
      })
      .finally(() => setLoading(false));
  }, [period, can]);

  if (loading) return <Spinner center />;

  if (!stats) {
    return (
      <Empty
        title="Dashboard unavailable"
        description="The database may not be reachable. Check that MySQL is running and that setup has been completed."
      />
    );
  }

  const { sales, recurring, receivables, projects, equipment, print, events, ai, finance } = stats;

  const chartData = (trend?.revenue || []).map((row) => {
    const expense = (trend.expenses || []).find((e) => e.month === row.month);
    return {
      month: row.month.slice(5),
      revenue: Number(row.collected_cents) / 100,
      expenses: Number(expense?.expense_cents || 0) / 100,
    };
  });

  const attentionGroups = [
    { key: 'overdue_invoices', label: 'Overdue invoices', tone: 'danger', link: '/admin/invoices?overdue=true' },
    { key: 'awaiting_approval', label: 'Awaiting client approval', tone: 'warning', link: '/admin/projects' },
    { key: 'expiring_hosting', label: 'Hosting expiring soon', tone: 'warning', link: '/admin/subscriptions' },
    { key: 'upcoming_bookings', label: 'Bookings in 14 days', tone: 'info', link: '/admin/bookings' },
    { key: 'lead_followups', label: 'Leads to follow up', tone: 'info', link: '/admin/leads' },
    { key: 'subscriptions_near_capacity', label: 'Retainers near capacity', tone: 'warning', link: '/admin/subscriptions' },
  ];

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Good to see you, {user?.first_name}</h2>
          <p className="muted small">Here is how the business is running.</p>
        </div>
        <select
          className="select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 12 months</option>
        </select>
      </div>

      {/* --------------------------------------------------------- HEADLINE */}
      <div className="grid grid-4">
        <StatTile
          label="Monthly recurring revenue"
          value={moneyCompact(recurring?.mrr_cents || 0, currency)}
          sub={`${number(recurring?.active_subscriptions || 0)} active subscriptions`}
          tone="success"
        />
        <StatTile
          label="Outstanding"
          value={moneyCompact(receivables?.outstanding_cents || 0, currency)}
          sub={`${moneyCompact(receivables?.overdue_cents || 0, currency)} overdue`}
          tone={Number(receivables?.overdue_cents) > 0 ? 'danger' : undefined}
        />
        <StatTile
          label="Open pipeline"
          value={moneyCompact(sales?.pipeline_cents || 0, currency)}
          sub={`${percent(sales?.win_rate_percent || 0)} win rate`}
        />
        <StatTile
          label="Collected this period"
          value={moneyCompact(finance?.collected_cents || 0, currency)}
          sub={`${percent(finance?.gross_margin_percent || 0)} gross margin`}
        />
      </div>

      {/* ------------------------------------------------------ TREND CHART */}
      {chartData.length > 0 && (
        <Card>
          <div className="card-header">
            <div>
              <h4>Revenue and cost</h4>
              <span className="tiny muted">Collected payments against recorded expenses, by month</span>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.flame} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART.flame} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)}
                />
                <Tooltip
                  formatter={(value) => money(value * 100, currency)}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${CHART.grid}`, fontSize: 13 }}
                />
                <Area type="monotone" dataKey="revenue" stroke={CHART.flame} strokeWidth={2} fill="url(#rev)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke={CHART.axis} strokeWidth={1.5} fill="none"
                  strokeDasharray="4 4" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------- DIVISION PERFORMANCE */}
      {divisionPerf.length > 0 && (
        <Card>
          <div className="card-header">
            <div>
              <h4>Division activity</h4>
              <span className="tiny muted">Project value by division, last 90 days</span>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={divisionPerf.map((d) => ({
                name: d.name.split(' ')[0],
                value: Number(d.budget_cents) / 100,
                color: d.color_hex,
                projects: d.project_count,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)}
                />
                <Tooltip
                  formatter={(value) => money(value * 100, currency)}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${CHART.grid}`, fontSize: 13 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {divisionPerf.map((d, i) => <Cell key={i} fill={d.color_hex || CHART.flame} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------- OPERATIONAL TILES */}
      <div className="grid grid-4">
        <Card pad>
          <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
            <h5 style={{ fontSize: 'var(--text-sm)' }}>Projects</h5>
            <Link to="/admin/projects" className="tiny" style={{ color: 'var(--orange-500)' }}>View →</Link>
          </div>
          <div className="stack small" style={{ gap: 'var(--s2)' }}>
            <div className="row-between"><span className="muted">Active</span><strong>{number(projects?.active || 0)}</strong></div>
            <div className="row-between"><span className="muted">At risk</span>
              <strong style={{ color: Number(projects?.at_risk) > 0 ? 'var(--warning)' : undefined }}>
                {number(projects?.at_risk || 0)}
              </strong>
            </div>
            <div className="row-between"><span className="muted">Overdue</span>
              <strong style={{ color: Number(projects?.overdue) > 0 ? 'var(--danger)' : undefined }}>
                {number(projects?.overdue || 0)}
              </strong>
            </div>
            <div className="row-between"><span className="muted">Completed</span><strong>{number(projects?.completed_period || 0)}</strong></div>
          </div>
        </Card>

        <Card pad>
          <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
            <h5 style={{ fontSize: 'var(--text-sm)' }}>Equipment</h5>
            <Link to="/admin/bookings" className="tiny" style={{ color: 'var(--orange-500)' }}>View →</Link>
          </div>
          <div className="stack small" style={{ gap: 'var(--s2)' }}>
            <div className="row-between"><span className="muted">Items</span><strong>{number(equipment?.items || 0)}</strong></div>
            <div className="row-between"><span className="muted">On hire</span><strong>{number(equipment?.active_bookings || 0)}</strong></div>
            <div className="row-between"><span className="muted">Maintenance</span><strong>{number(equipment?.in_maintenance || 0)}</strong></div>
            <div className="row-between"><span className="muted">Revenue</span>
              <strong>{moneyCompact(equipment?.revenue_cents || 0, currency)}</strong>
            </div>
          </div>
        </Card>

        <Card pad>
          <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
            <h5 style={{ fontSize: 'var(--text-sm)' }}>Print</h5>
            <Link to="/admin/print-orders" className="tiny" style={{ color: 'var(--orange-500)' }}>View →</Link>
          </div>
          <div className="stack small" style={{ gap: 'var(--s2)' }}>
            <div className="row-between"><span className="muted">Orders</span><strong>{number(print?.orders || 0)}</strong></div>
            <div className="row-between"><span className="muted">In production</span><strong>{number(print?.in_production || 0)}</strong></div>
            <div className="row-between"><span className="muted">Rush jobs</span>
              <strong style={{ color: Number(print?.rush_jobs) > 0 ? 'var(--warning)' : undefined }}>
                {number(print?.rush_jobs || 0)}
              </strong>
            </div>
            <div className="row-between"><span className="muted">Revenue</span>
              <strong>{moneyCompact(print?.revenue_cents || 0, currency)}</strong>
            </div>
          </div>
        </Card>

        <Card pad>
          <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
            <h5 style={{ fontSize: 'var(--text-sm)' }}>AI assistant</h5>
            <Link to="/admin/ai" className="tiny" style={{ color: 'var(--orange-500)' }}>View →</Link>
          </div>
          <div className="stack small" style={{ gap: 'var(--s2)' }}>
            <div className="row-between"><span className="muted">Active</span><strong>{number(ai?.active_assistants || 0)}</strong></div>
            <div className="row-between"><span className="muted">Conversations</span><strong>{number(ai?.conversations || 0)}</strong></div>
            <div className="row-between"><span className="muted">Leads captured</span>
              <strong style={{ color: 'var(--success)' }}>{number(ai?.leads_captured || 0)}</strong>
            </div>
            <div className="row-between"><span className="muted">Escalations</span><strong>{number(ai?.escalations || 0)}</strong></div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------- NEEDS ATTENTION */}
      {attention && (
        <div>
          <h3 style={{ marginBottom: 'var(--s5)' }}>Needs your attention</h3>
          <div className="grid grid-3">
            {attentionGroups.map((group) => {
              const rows = attention[group.key] || [];
              if (rows.length === 0) return null;
              return (
                <Card key={group.key}>
                  <div className="card-header">
                    <div className="row" style={{ gap: 'var(--s2)' }}>
                      <span className={`badge badge-${group.tone}`}>{rows.length}</span>
                      <h5 style={{ fontSize: 'var(--text-sm)' }}>{group.label}</h5>
                    </div>
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {rows.slice(0, 6).map((row, i) => (
                      <div key={i} style={{ padding: 'var(--s3) var(--s6)', borderBottom: '1px solid var(--border)' }}>
                        <div className="small bold truncate">
                          {row.reference || row.domain || row.name || row.event_name || row.contact_name}
                        </div>
                        <div className="tiny muted truncate">
                          {group.key === 'overdue_invoices' && `${row.organisation_name} · ${row.days_overdue} days · ${money(row.balance_cents, currency, row.currency)}`}
                          {group.key === 'expiring_hosting' && `${row.organisation_name} · ${row.days_left} days left`}
                          {group.key === 'awaiting_approval' && `${row.project_name} · ${row.organisation_name}`}
                          {group.key === 'upcoming_bookings' && `${row.venue || '—'} · ${date(row.start_date)}`}
                          {group.key === 'lead_followups' && `${row.company_name || 'No company'} · ${date(row.next_followup_at)}`}
                          {group.key === 'subscriptions_near_capacity' && `${row.organisation_name} · ${row.capacity_used}/${row.capacity_units} used`}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card-footer">
                    <Link to={group.link} className="small" style={{ color: 'var(--orange-500)' }}>
                      See all →
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
