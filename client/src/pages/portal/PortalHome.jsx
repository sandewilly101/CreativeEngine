import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, moneyCompact, date, humanise, number } from '../../utils/format';
import { Card, Spinner, Badge, Progress, Empty, StatTile, Button } from '../../components/UI';

export default function PortalHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currency, user } = useApp();

  useEffect(() => {
    api.get('/dashboard/client')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner center />;
  if (!data) return <Empty title="Could not load your dashboard" description="Please try again shortly." />;

  const { projects, invoices, requests, subscriptions, awaiting_your_approval: approvals } = data;

  return (
    <div className="stack-lg">
      <div>
        <h2>Hello, {user?.first_name}</h2>
        <p className="muted small">Here is where everything stands with {user?.organisation_name}.</p>
      </div>

      {approvals?.length > 0 && (
        <Card style={{ borderColor: 'var(--orange-500)', borderWidth: 2 }}>
          <div className="card-header">
            <div>
              <h4>Waiting for your review</h4>
              <span className="tiny muted">Work is paused until you approve or request changes</span>
            </div>
            <span className="badge badge-brand">{approvals.length}</span>
          </div>
          <div className="card-body">
            <div className="stack" style={{ gap: 'var(--s3)' }}>
              {approvals.map((item) => (
                <Link
                  key={item.id}
                  to={`/portal/projects/${item.project_id}`}
                  className="row-between card card-pad card-hover"
                >
                  <div>
                    <div className="bold">{item.name}</div>
                    <div className="tiny muted">{item.project_name}</div>
                  </div>
                  <span className="small" style={{ color: 'var(--orange-500)', fontWeight: 600 }}>Review →</span>
                </Link>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-4">
        <StatTile label="Active projects" value={number(projects?.filter((p) => p.status === 'active').length || 0)} />
        <StatTile
          label="Outstanding"
          value={moneyCompact(invoices?.outstanding_cents || 0, currency)}
          sub={`${invoices?.open_count || 0} open invoices`}
          tone={Number(invoices?.overdue_cents) > 0 ? 'danger' : undefined}
        />
        <StatTile label="Active services" value={number(subscriptions?.length || 0)} sub="Monthly agreements" />
        <StatTile label="Open requests" value={number(requests?.filter((r) => r.status !== 'completed').length || 0)} />
      </div>

      <div className="grid grid-2">
        <Card>
          <div className="card-header">
            <h4>Your projects</h4>
            <Link to="/portal/projects" className="tiny" style={{ color: 'var(--orange-500)' }}>See all →</Link>
          </div>
          <div className="card-body">
            {projects?.length ? (
              <div className="stack" style={{ gap: 'var(--s4)' }}>
                {projects.slice(0, 5).map((project) => (
                  <Link key={project.id} to={`/portal/projects/${project.id}`} className="card card-pad card-hover">
                    <div className="row-between" style={{ marginBottom: 'var(--s2)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="bold truncate">{project.name}</div>
                        <div className="tiny muted">{humanise(project.stage)} · due {date(project.due_date)}</div>
                      </div>
                      <Badge status={project.status} />
                    </div>
                    <Progress value={project.progress_percent} />
                    <div className="tiny muted" style={{ marginTop: 4 }}>{project.progress_percent}% complete</div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="No projects yet" description="They will appear here once work begins." />
            )}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="card-header">
              <h4>Your services</h4>
            </div>
            <div className="card-body">
              {subscriptions?.length ? (
                <div className="stack" style={{ gap: 'var(--s4)' }}>
                  {subscriptions.map((sub) => {
                    const pct = sub.capacity_units
                      ? (Number(sub.capacity_used) / Number(sub.capacity_units)) * 100
                      : null;
                    return (
                      <div key={sub.id} className="card card-pad">
                        <div className="row-between">
                          <div>
                            <div className="bold small">{sub.name}</div>
                            <div className="tiny muted">
                              {money(sub.amount_cents, currency, sub.currency)} per {sub.billing_interval.replace('ly', '')}
                            </div>
                          </div>
                          <Badge status={sub.status} />
                        </div>
                        {pct !== null && (
                          <div style={{ marginTop: 'var(--s3)' }}>
                            <div className="row-between tiny" style={{ marginBottom: 3 }}>
                              <span className="muted">This cycle</span>
                              <span>{sub.capacity_used} of {sub.capacity_units} used</span>
                            </div>
                            <Progress value={pct} tone={pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : undefined} />
                          </div>
                        )}
                        {sub.next_billing_date && (
                          <div className="tiny muted" style={{ marginTop: 'var(--s2)' }}>
                            Next invoice {date(sub.next_billing_date)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty title="No active services" />
              )}
            </div>
          </Card>

          <Card>
            <div className="card-header">
              <h4>Recent requests</h4>
              <Link to="/portal/requests" className="tiny" style={{ color: 'var(--orange-500)' }}>See all →</Link>
            </div>
            <div className="card-body">
              {requests?.length ? (
                <div className="stack" style={{ gap: 'var(--s3)' }}>
                  {requests.map((req) => (
                    <div key={req.id} className="row-between">
                      <div style={{ minWidth: 0 }}>
                        <div className="small bold truncate">{req.title}</div>
                        <div className="tiny muted">{req.reference} · {date(req.created_at)}</div>
                      </div>
                      <Badge status={req.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No requests yet"
                  description="Need something? Raise a request and we will pick it up."
                  action={<Link to="/portal/requests" className="btn btn-primary btn-sm">New request</Link>}
                />
              )}
            </div>
          </Card>
        </div>
      </div>

      {Number(invoices?.overdue_cents) > 0 && (
        <Card style={{ borderColor: 'var(--danger)' }}>
          <div className="card-body">
            <div className="row-between row-wrap" style={{ gap: 'var(--s4)' }}>
              <div>
                <h4 style={{ color: 'var(--danger)' }}>You have overdue invoices</h4>
                <p className="small muted" style={{ marginTop: 4 }}>
                  {money(invoices.overdue_cents, currency)} is past its due date.
                </p>
              </div>
              <Link to="/portal/invoices" className="btn btn-primary">View invoices</Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
