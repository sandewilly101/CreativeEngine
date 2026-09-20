import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LineChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, moneyCompact, number, percent, date } from '../../utils/format';
import { Card, Spinner, Tabs, DataTable, Empty, StatTile } from '../../components/UI';

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

export default function Reports() {
  const [tab, setTab] = useState('revenue');
  const [trend, setTrend] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [utilisation, setUtilisation] = useState([]);
  const [invoiceStats, setInvoiceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currency } = useApp();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard/revenue-trend?months=12').catch(() => null),
      api.get('/dashboard/division-performance?days=180').catch(() => null),
      api.get('/bookings/reports/utilisation').catch(() => null),
      api.get('/invoices/stats').catch(() => null),
    ])
      .then(([t, d, u, i]) => {
        setTrend(t?.data || null);
        setDivisions(d?.data || []);
        setUtilisation(u?.data || []);
        setInvoiceStats(i?.data || null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner center />;

  const revenueData = (trend?.revenue || []).map((row) => {
    const expense = (trend.expenses || []).find((e) => e.month === row.month);
    const revenue = Number(row.collected_cents) / 100;
    const cost = Number(expense?.expense_cents || 0) / 100;
    return {
      month: row.month,
      revenue,
      expenses: cost,
      margin: revenue > 0 ? Number((((revenue - cost) / revenue) * 100).toFixed(1)) : 0,
    };
  });

  const totalRevenue = revenueData.reduce((sum, r) => sum + r.revenue, 0);
  const totalExpenses = revenueData.reduce((sum, r) => sum + r.expenses, 0);
  const overallMargin = totalRevenue > 0
    ? ((totalRevenue - totalExpenses) / totalRevenue) * 100
    : 0;

  const TABS = [
    { key: 'revenue', label: 'Revenue and margin' },
    { key: 'divisions', label: 'Divisions' },
    { key: 'equipment', label: 'Equipment payback' },
    { key: 'receivables', label: 'Receivables' },
  ];

  return (
    <div className="stack-lg">
      <div>
        <h2>Reports</h2>
        <p className="muted small">
          The numbers that tell you whether the model is working, not just whether you are busy.
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'revenue' && (
        <div className="stack-lg">
          <div className="grid grid-4">
            <StatTile label="Revenue (12 months)" value={moneyCompact(totalRevenue * 100, currency)} />
            <StatTile label="Recorded costs" value={moneyCompact(totalExpenses * 100, currency)} />
            <StatTile
              label="Gross margin"
              value={percent(overallMargin)}
              tone={overallMargin < 30 ? 'danger' : overallMargin < 45 ? undefined : 'success'}
              sub="Revenue less recorded costs"
            />
            <StatTile
              label="Best month"
              value={revenueData.length
                ? moneyCompact(Math.max(...revenueData.map((r) => r.revenue)) * 100, currency)
                : '—'}
            />
          </div>

          <Card>
            <div className="card-header"><h4>Revenue against cost</h4></div>
            <div className="card-body">
              {revenueData.length === 0 ? (
                <Empty title="No payment history yet" description="Charts appear once payments are recorded." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={revenueData}>
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
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART.flame} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" name="Costs" fill={CHART.axis} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {revenueData.length > 1 && (
            <Card>
              <div className="card-header">
                <div>
                  <h4>Margin trend</h4>
                  <span className="tiny muted">
                    A falling line usually means scope creep or supplier costs rising faster than prices
                  </span>
                </div>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: CHART.axis }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      formatter={(value) => `${value}%`}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${CHART.grid}`, fontSize: 13 }}
                    />
                    <Line type="monotone" dataKey="margin" stroke={CHART.limeDeep} strokeWidth={2} dot={{ r: 3 }} name="Margin" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'divisions' && (
        <div className="stack-lg">
          <Card>
            <div className="card-header">
              <div>
                <h4>Project value by division</h4>
                <span className="tiny muted">Last 180 days</span>
              </div>
            </div>
            <div className="card-body">
              {divisions.length === 0 ? <Empty title="No project data yet" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={divisions.map((d) => ({
                      name: d.name,
                      budget: Number(d.budget_cents) / 100,
                      cost: Number(d.cost_cents) / 100,
                      color: d.color_hex,
                    }))}
                    layout="vertical"
                    margin={{ left: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: CHART.axis }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: CHART.axis }}
                      axisLine={false}
                      tickLine={false}
                      width={150}
                    />
                    <Tooltip
                      formatter={(value) => money(value * 100, currency)}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${CHART.grid}`, fontSize: 13 }}
                    />
                    <Bar dataKey="budget" name="Client value" radius={[0, 6, 6, 0]}>
                      {divisions.map((d, i) => <Cell key={i} fill={d.color_hex || CHART.flame} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <div className="card-header"><h4>Division detail</h4></div>
            <DataTable
              rows={divisions}
              empty={<Empty title="No data" />}
              columns={[
                {
                  key: 'name',
                  label: 'Division',
                  render: (row) => (
                    <div className="row" style={{ gap: 'var(--s2)' }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: 3, background: row.color_hex,
                      }} />
                      <span className="bold">{row.name}</span>
                    </div>
                  ),
                },
                { key: 'project_count', label: 'Projects', align: 'right', render: (row) => number(row.project_count) },
                {
                  key: 'budget_cents',
                  label: 'Client value',
                  align: 'right',
                  render: (row) => money(row.budget_cents, currency),
                },
                {
                  key: 'cost_cents',
                  label: 'Our cost',
                  align: 'right',
                  render: (row) => money(row.cost_cents, currency),
                },
                {
                  key: 'margin',
                  label: 'Margin',
                  align: 'right',
                  render: (row) => {
                    const budget = Number(row.budget_cents);
                    if (!budget) return <span className="muted">—</span>;
                    const pct = ((budget - Number(row.cost_cents)) / budget) * 100;
                    return (
                      <span className="bold" style={{
                        color: pct < 25 ? 'var(--danger)' : pct < 40 ? 'var(--warning)' : 'var(--success)',
                      }}>
                        {pct.toFixed(0)}%
                      </span>
                    );
                  },
                },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'equipment' && (
        <Card>
          <div className="card-header">
            <div>
              <h4>Equipment payback</h4>
              <span className="tiny muted">
                Hire revenue against replacement value. Anything past 100% has paid for itself —
                which is the signal to buy more of it rather than keep renting in.
              </span>
            </div>
          </div>
          <DataTable
            rows={utilisation}
            empty={<Empty title="No hire history yet" description="Complete some bookings to see payback." />}
            columns={[
              { key: 'name', label: 'Equipment', render: (row) => <span className="bold">{row.name}</span> },
              { key: 'total_units', label: 'Units', align: 'right' },
              { key: 'utilisation_days', label: 'Days hired', align: 'right', render: (row) => number(row.utilisation_days) },
              {
                key: 'lifetime_revenue_cents',
                label: 'Revenue earned',
                align: 'right',
                render: (row) => money(row.lifetime_revenue_cents, currency),
              },
              {
                key: 'replacement_value_cents',
                label: 'Replacement value',
                align: 'right',
                render: (row) => (Number(row.replacement_value_cents) > 0
                  ? money(row.replacement_value_cents, currency)
                  : <span className="muted">Not set</span>),
              },
              {
                key: 'payback_percent',
                label: 'Payback',
                align: 'right',
                render: (row) => {
                  if (row.payback_percent === null) return <span className="muted">—</span>;
                  const pct = Number(row.payback_percent);
                  return (
                    <span className="bold" style={{
                      color: pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--ink-500)',
                    }}>
                      {pct.toFixed(0)}%
                    </span>
                  );
                },
              },
            ]}
          />
        </Card>
      )}

      {tab === 'receivables' && invoiceStats && (
        <div className="stack-lg">
          <div className="grid grid-4">
            <StatTile label="Collected" value={moneyCompact(invoiceStats.summary.collected_cents, currency)} tone="success" />
            <StatTile label="Outstanding" value={moneyCompact(invoiceStats.summary.outstanding_cents, currency)} />
            <StatTile
              label="Overdue"
              value={moneyCompact(invoiceStats.summary.overdue_cents, currency)}
              tone={Number(invoiceStats.summary.overdue_cents) > 0 ? 'danger' : undefined}
            />
            <StatTile label="Total invoices" value={number(invoiceStats.summary.total_invoices)} />
          </div>

          <Card>
            <div className="card-header">
              <div>
                <h4>Ageing</h4>
                <span className="tiny muted">How long money has been owed</span>
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={invoiceStats.aging.map((a) => ({
                  bucket: a.bucket === 'current' ? 'Not due' : `${a.bucket} days`,
                  amount: Number(a.amount_cents) / 100,
                  count: a.count,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
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
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {invoiceStats.aging.map((a, i) => (
                      <Cell
                        key={i}
                        fill={
                          a.bucket === 'current' ? '#94A3B8'
                            : a.bucket === '1-30' ? '#F59E0B'
                            : a.bucket === '31-60' ? '#F97316'
                            : '#DC2626'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
