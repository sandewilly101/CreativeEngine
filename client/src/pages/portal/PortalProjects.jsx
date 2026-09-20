import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { date, humanise, daysUntil } from '../../utils/format';
import { Card, Spinner, Badge, Progress, Empty, Tabs } from '../../components/UI';

export default function PortalProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    setLoading(true);
    api.get(`/projects${api.qs({ status: filter === 'all' ? '' : filter, limit: 50 })}`)
      .then((res) => setProjects(res.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="stack-lg">
      <div>
        <h2>Your projects</h2>
        <p className="muted small">Everything we are working on for you, and where each piece stands.</p>
      </div>

      <Tabs
        tabs={[
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
          { key: 'all', label: 'All' },
        ]}
        active={filter}
        onChange={setFilter}
      />

      {loading ? <Spinner center /> : projects.length === 0 ? (
        <Empty
          title="No projects here"
          description={filter === 'active'
            ? 'Nothing is currently in progress.'
            : 'Nothing to show for this filter.'}
        />
      ) : (
        <div className="grid grid-2">
          {projects.map((project) => {
            const days = daysUntil(project.due_date);
            const late = days !== null && days < 0 && !['completed', 'cancelled'].includes(project.status);

            return (
              <Link key={project.id} to={`/portal/projects/${project.id}`} className="card card-hover">
                {project.cover_url && (
                  <div style={{ aspectRatio: '21/9', background: `url(${project.cover_url}) center/cover` }} />
                )}
                <div className="card-pad">
                  <div className="row-between" style={{ marginBottom: 'var(--s3)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold truncate">{project.name}</div>
                      <div className="tiny muted">{project.reference}</div>
                    </div>
                    <Badge status={project.status} />
                  </div>

                  {project.division_name && (
                    <span className="badge" style={{
                      background: `${project.division_color || '#f74932'}18`,
                      color: project.division_color || 'var(--orange-500)',
                      marginBottom: 'var(--s3)',
                    }}>
                      {project.division_name}
                    </span>
                  )}

                  <div style={{ marginTop: 'var(--s4)' }}>
                    <div className="row-between tiny" style={{ marginBottom: 4 }}>
                      <span className="muted">{humanise(project.stage)}</span>
                      <span className="bold">{project.progress_percent}%</span>
                    </div>
                    <Progress value={project.progress_percent} />
                  </div>

                  <div className="row-between" style={{ marginTop: 'var(--s4)' }}>
                    <div className="tiny muted">
                      Due {date(project.due_date)}
                      {late && <span style={{ color: 'var(--danger)' }}> · {Math.abs(days)} days late</span>}
                    </div>
                    {Number(project.awaiting_approval) > 0 && (
                      <span className="badge badge-warning">
                        {project.awaiting_approval} to review
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
