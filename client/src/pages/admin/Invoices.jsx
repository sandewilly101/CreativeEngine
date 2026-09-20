import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, moneyCompact, date, humanise } from '../../utils/format';
import {
  Card, Button, DataTable, Pagination, SearchInput, Badge,
  StatTile, Empty, ConfirmDialog,
} from '../../components/UI';

export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);

  const [params] = useSearchParams();
  const overdueOnly = params.get('overdue') === 'true';
  const navigate = useNavigate();
  const { currency, toast } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, statsRes] = await Promise.all([
        api.get(`/invoices${api.qs({
          page, search, status,
          overdue: overdueOnly ? 'true' : undefined,
          sort: 'issue_date:desc',
        })}`),
        api.get('/invoices/stats').catch(() => null),
      ]);
      setRows(list.data || []);
      setPagination(list.pagination || { page: 1, pages: 1, total: 0 });
      setStats(statsRes?.data || null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, overdueOnly, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  const send = async (row, e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/invoices/${row.id}/send`);
      toast(`Invoice sent. Client link: ${res.data.public_url}`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remind = async (row, e) => {
    e.stopPropagation();
    try {
      await api.post(`/invoices/${row.id}/remind`);
      toast('Reminder sent', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/invoices/${deleting.id}`);
      toast('Invoice moved to trash', 'success');
      setDeleting(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(null);
    }
  };

  const summary = stats?.summary;

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Invoices</h2>
          <p className="muted small">
            VAT at 18%, with TIN and VRN carried onto every tax invoice.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/admin/invoices/new')}>+ New invoice</Button>
      </div>

      {summary && (
        <div className="grid grid-4">
          <StatTile label="Collected" value={moneyCompact(summary.collected_cents, currency)} tone="success" />
          <StatTile label="Outstanding" value={moneyCompact(summary.outstanding_cents, currency)} />
          <StatTile
            label="Overdue"
            value={moneyCompact(summary.overdue_cents, currency)}
            tone={Number(summary.overdue_cents) > 0 ? 'danger' : undefined}
            sub="Chase these first"
          />
          <StatTile label="In draft" value={moneyCompact(summary.draft_cents, currency)} sub="Not yet sent" />
        </div>
      )}

      {stats?.aging?.length > 0 && (
        <Card pad>
          <h5 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--s4)' }}>Receivables ageing</h5>
          <div className="row row-wrap" style={{ gap: 'var(--s8)' }}>
            {['current', '1-30', '31-60', '61-90', '90+'].map((bucket) => {
              const row = stats.aging.find((a) => a.bucket === bucket);
              const amount = Number(row?.amount_cents || 0);
              return (
                <div key={bucket}>
                  <div className="tiny muted">
                    {bucket === 'current' ? 'Not yet due' : `${bucket} days`}
                  </div>
                  <div className="bold" style={{
                    fontSize: 'var(--text-lg)',
                    color: bucket === '90+' && amount > 0 ? 'var(--danger)'
                      : bucket === '61-90' && amount > 0 ? 'var(--warning)' : undefined,
                  }}>
                    {moneyCompact(amount, currency)}
                  </div>
                  <div className="tiny muted">{row?.count || 0} invoices</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search reference or client…" />
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">All statuses</option>
            {['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'].map((s) => (
              <option key={s} value={s}>{humanise(s)}</option>
            ))}
          </select>
        </div>

        <DataTable
          loading={loading}
          rows={rows}
          onRowClick={(row) => navigate(`/admin/invoices/${row.id}`)}
          empty={
            <Empty
              title="No invoices yet"
              description="Raise one directly, or convert an accepted quote."
              action={<Button variant="primary" onClick={() => navigate('/admin/invoices/new')}>New invoice</Button>}
            />
          }
          columns={[
            {
              key: 'reference',
              label: 'Invoice',
              render: (row) => (
                <div style={{ minWidth: 0 }}>
                  <div className="bold mono">{row.reference}</div>
                  <div className="tiny muted truncate">{row.organisation_name}</div>
                </div>
              ),
            },
            {
              key: 'issue_date',
              label: 'Issued',
              render: (row) => <span className="small">{date(row.issue_date)}</span>,
            },
            {
              key: 'due_date',
              label: 'Due',
              render: (row) => {
                const overdue = Number(row.days_overdue) > 0 && Number(row.balance_cents) > 0;
                return (
                  <div>
                    <div className="small" style={{ color: overdue ? 'var(--danger)' : undefined }}>
                      {date(row.due_date)}
                    </div>
                    {overdue && <div className="tiny" style={{ color: 'var(--danger)' }}>{row.days_overdue} days late</div>}
                  </div>
                );
              },
            },
            {
              key: 'total_cents',
              label: 'Total',
              align: 'right',
              render: (row) => money(row.total_cents, currency, row.currency),
            },
            {
              key: 'balance_cents',
              label: 'Balance',
              align: 'right',
              render: (row) => (
                <span
                  className="bold"
                  style={{ color: Number(row.balance_cents) > 0 ? 'var(--danger)' : 'var(--success)' }}
                >
                  {money(row.balance_cents, currency, row.currency)}
                </span>
              ),
            },
            { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
            {
              key: '_actions',
              label: '',
              width: 180,
              render: (row) => (
                <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                  {row.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={(e) => send(row, e)}>Send</Button>
                  )}
                  {Number(row.balance_cents) > 0 && row.status !== 'draft' && (
                    <Button size="sm" variant="ghost" onClick={(e) => remind(row, e)}>Remind</Button>
                  )}
                  {row.public_token && (
                    <a href={`/i/${row.public_token}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                      View
                    </a>
                  )}
                  {Number(row.paid_cents) === 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(row)} style={{ color: 'var(--danger)' }}>
                      Delete
                    </Button>
                  )}
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
        title="Move this invoice to trash?"
        message={`${deleting?.reference} will be hidden but can be restored.`}
        confirmLabel="Move to trash"
      />
    </div>
  );
}
