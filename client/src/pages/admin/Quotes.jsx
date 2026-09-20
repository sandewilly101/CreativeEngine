import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, moneyCompact, date, percent, humanise } from '../../utils/format';
import {
  Card, Button, DataTable, Pagination, SearchInput, Badge,
  StatTile, Empty, ConfirmDialog,
} from '../../components/UI';

export default function Quotes() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);

  const navigate = useNavigate();
  const { currency, toast } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, statsRes] = await Promise.all([
        api.get(`/quotes${api.qs({ page, search, status, sort: 'created_at:desc' })}`),
        api.get('/quotes/stats').catch(() => null),
      ]);
      setRows(list.data || []);
      setPagination(list.pagination || { page: 1, pages: 1, total: 0 });
      setStats(statsRes?.data || null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  const send = async (row, e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/quotes/${row.id}/send`);
      toast(`Quote sent. Share link: ${res.data.public_url}`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/quotes/${deleting.id}`);
      toast('Quote moved to trash', 'success');
      setDeleting(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(null);
    }
  };

  const byStatus = (key) => stats?.by_status?.find((s) => s.status === key);

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Quotes</h2>
          <p className="muted small">Every quote states its scope, revisions and validity before work starts.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/admin/quotes/new')}>+ New quote</Button>
      </div>

      {stats && (
        <div className="grid grid-4">
          <StatTile
            label="Out for decision"
            value={moneyCompact(
              (Number(byStatus('sent')?.value_cents || 0) + Number(byStatus('viewed')?.value_cents || 0)),
              currency
            )}
            sub={`${Number(byStatus('sent')?.count || 0) + Number(byStatus('viewed')?.count || 0)} quotes`}
          />
          <StatTile
            label="Accepted"
            value={moneyCompact(byStatus('accepted')?.value_cents || 0, currency)}
            sub={`${byStatus('accepted')?.count || 0} quotes`}
            tone="success"
          />
          <StatTile
            label="Win rate"
            value={percent(stats.win_rate_percent)}
            sub="Of quotes that got a response"
          />
          <StatTile
            label="Drafts"
            value={byStatus('draft')?.count || 0}
            sub={moneyCompact(byStatus('draft')?.value_cents || 0, currency)}
          />
        </div>
      )}

      <Card>
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search reference, title or client…" />
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">All statuses</option>
            {['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'revised'].map((s) => (
              <option key={s} value={s}>{humanise(s)}</option>
            ))}
          </select>
        </div>

        <DataTable
          loading={loading}
          rows={rows}
          onRowClick={(row) => navigate(`/admin/quotes/${row.id}`)}
          empty={
            <Empty
              title="No quotes yet"
              description="Create a quote from a lead, or start one from scratch."
              action={<Button variant="primary" onClick={() => navigate('/admin/quotes/new')}>New quote</Button>}
            />
          }
          columns={[
            {
              key: 'reference',
              label: 'Quote',
              render: (row) => (
                <div style={{ minWidth: 0 }}>
                  <div className="bold mono">{row.reference}</div>
                  <div className="tiny muted truncate">{row.title}</div>
                </div>
              ),
            },
            {
              key: 'organisation_name',
              label: 'Client',
              render: (row) => <span className="small">{row.organisation_name}</span>,
            },
            {
              key: 'total_cents',
              label: 'Value',
              align: 'right',
              render: (row) => (
                <div>
                  <div className="bold">{money(row.total_cents, currency, row.currency)}</div>
                  <div className="tiny muted">{row.item_count} items</div>
                </div>
              ),
            },
            {
              key: 'valid_until',
              label: 'Valid until',
              render: (row) => {
                const expired = new Date(row.valid_until) < new Date();
                return (
                  <span className="small" style={{ color: expired ? 'var(--danger)' : undefined }}>
                    {date(row.valid_until)}
                  </span>
                );
              },
            },
            {
              key: 'created_by_name',
              label: 'Raised by',
              render: (row) => <span className="tiny muted">{row.created_by_name || '—'}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <div>
                  <Badge status={row.status} />
                  {row.version > 1 && <div className="tiny muted">v{row.version}</div>}
                </div>
              ),
            },
            {
              key: '_actions',
              label: '',
              width: 150,
              render: (row) => (
                <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                  {row.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={(e) => send(row, e)}>Send</Button>
                  )}
                  {row.public_token && row.status !== 'draft' && (
                    <a
                      href={`/q/${row.public_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      View
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(row)}
                    style={{ color: 'var(--danger)' }}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />

        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          onChange={setPage}
        />
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Move this quote to trash?"
        message={`${deleting?.reference} will be hidden but can be restored later.`}
        confirmLabel="Move to trash"
      />
    </div>
  );
}
