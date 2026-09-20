import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, date, dateRange, humanise, daysUntil } from '../../utils/format';
import {
  Card, Button, DataTable, Pagination, SearchInput, Badge, Empty,
  Modal, Field, Input, Textarea, Select, Tabs, Spinner, Alert,
} from '../../components/UI';

const STATUSES = ['enquiry', 'quoted', 'confirmed', 'dispatched', 'on_hire', 'returned', 'completed', 'cancelled'];

export default function Bookings() {
  const [tab, setTab] = useState('list');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [equipment, setEquipment] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ items: [] });
  const [availability, setAvailability] = useState([]);
  const [quote, setQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  const [calendarRange, setCalendarRange] = useState(() => {
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 45);
    return { start: today.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  });
  const [calendar, setCalendar] = useState([]);

  const { currency, toast } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/bookings/equipment?limit=200&status=available').catch(() => ({ data: [] })),
      api.get('/organisations?limit=200').catch(() => ({ data: [] })),
    ]).then(([e, o]) => {
      setEquipment(e.data || []);
      setOrganisations(o.data || []);
    });
  }, []);

  const load = useCallback(async () => {
    if (tab !== 'list') return;
    setLoading(true);
    try {
      const res = await api.get(`/bookings${api.qs({ page, search, status, sort: 'start_date:desc' })}`);
      setRows(res.data || []);
      setPagination(res.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, status, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'calendar') return;
    api.get(`/bookings/calendar${api.qs(calendarRange)}`)
      .then((res) => setCalendar(res.data || []))
      .catch(() => setCalendar([]));
  }, [tab, calendarRange]);

  // Re-check availability and price whenever the draft booking changes.
  useEffect(() => {
    if (!creating || !form.start_date || !form.end_date || !form.items?.length) {
      setAvailability([]);
      setQuote(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const ids = form.items.map((i) => i.equipment_id).filter(Boolean).join(',');
        const [avail, priced] = await Promise.all([
          api.get(`/bookings/availability${api.qs({
            start: form.setup_date || form.start_date,
            end: form.teardown_date || form.end_date,
            equipment_ids: ids,
          })}`),
          api.post('/bookings/calculate', {
            start_date: form.start_date,
            end_date: form.end_date,
            items: form.items,
          }),
        ]);
        setAvailability(avail.data || []);
        setQuote(priced.data);
      } catch { /* the form still works without the preview */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [creating, form]);

  const addLine = () => {
    setForm((f) => ({ ...f, items: [...(f.items || []), { equipment_id: '', quantity: 1, measure_qty: 1, rate_type: 'daily' }] }));
  };

  const updateLine = (index, patch) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const removeLine = (index) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  };

  const create = async () => {
    setSaving(true);
    try {
      const res = await api.post('/bookings', form);
      toast(res.message, 'success');
      setCreating(false);
      setForm({ items: [] });
      load();
    } catch (err) {
      if (err.details?.conflicts) {
        toast(
          `Not available: ${err.details.conflicts.map((c) => `${c.name} (${c.available} of ${c.requested})`).join(', ')}`,
          'error'
        );
      } else {
        toast(err.message, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const setBookingStatus = async (booking, next) => {
    try {
      await api.patch(`/bookings/${booking.id}`, { status: next });
      toast(`Booking ${humanise(next).toLowerCase()}`, 'success');
      load();
      if (detail) {
        const fresh = await api.get(`/bookings/${booking.id}`);
        setDetail(fresh.data);
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const openDetail = async (row) => {
    try {
      const res = await api.get(`/bookings/${row.id}`);
      setDetail(res.data);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          <h2>Equipment hire</h2>
          <p className="muted small">
            Availability is checked against every confirmed booking, so the same item can never be double-booked.
          </p>
        </div>
        <Button variant="primary" onClick={() => { setForm({ items: [], status: 'enquiry' }); setCreating(true); }}>
          + New booking
        </Button>
      </div>

      <Tabs
        tabs={[{ key: 'list', label: 'Bookings' }, { key: 'calendar', label: 'Calendar' }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'list' && (
        <Card>
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search reference, event or venue…" />
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
            </select>
          </div>

          <DataTable
            loading={loading}
            rows={rows}
            onRowClick={openDetail}
            empty={<Empty title="No bookings yet" description="Create one to hold equipment for a date." />}
            columns={[
              {
                key: 'reference',
                label: 'Booking',
                render: (row) => (
                  <div style={{ minWidth: 0 }}>
                    <div className="bold mono">{row.reference}</div>
                    <div className="tiny muted truncate">{row.event_name || row.contact_name}</div>
                  </div>
                ),
              },
              {
                key: 'organisation_name',
                label: 'Client',
                render: (row) => <span className="small">{row.organisation_name || row.contact_name}</span>,
              },
              {
                key: 'dates',
                label: 'Dates',
                render: (row) => (
                  <div>
                    <div className="small">{dateRange(row.start_date, row.end_date)}</div>
                    <div className="tiny muted">{row.rental_days} day{row.rental_days === 1 ? '' : 's'}</div>
                  </div>
                ),
              },
              { key: 'venue', label: 'Venue', render: (row) => <span className="small truncate">{row.venue || '—'}</span> },
              { key: 'item_count', label: 'Items', align: 'right' },
              {
                key: 'total_cents',
                label: 'Total',
                align: 'right',
                render: (row) => money(row.total_cents, currency, row.currency),
              },
              { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
            ]}
          />

          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
        </Card>
      )}

      {tab === 'calendar' && (
        <Card>
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <h4>Booking calendar</h4>
            <div className="row" style={{ gap: 'var(--s2)' }}>
              <input
                className="input" type="date" value={calendarRange.start}
                onChange={(e) => setCalendarRange({ ...calendarRange, start: e.target.value })}
                style={{ width: 'auto' }}
              />
              <input
                className="input" type="date" value={calendarRange.end}
                onChange={(e) => setCalendarRange({ ...calendarRange, end: e.target.value })}
                style={{ width: 'auto' }}
              />
            </div>
          </div>
          <div className="card-body">
            {calendar.length === 0 ? (
              <Empty title="Nothing booked in this window" />
            ) : (
              <div className="stack">
                {calendar.map((booking) => {
                  const days = daysUntil(booking.start_date);
                  return (
                    <div key={booking.id} className="card card-pad" style={{
                      borderLeft: `3px solid ${
                        booking.status === 'on_hire' ? 'var(--orange-500)'
                          : booking.status === 'confirmed' ? 'var(--success)'
                          : 'var(--ink-300)'
                      }`,
                    }}>
                      <div className="row-between row-wrap" style={{ gap: 'var(--s4)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="row" style={{ gap: 'var(--s2)' }}>
                            <span className="bold">{booking.event_name || booking.reference}</span>
                            <Badge status={booking.status} />
                          </div>
                          <div className="small muted">
                            {booking.organisation_name} · {booking.venue || 'Venue not set'}
                          </div>
                          {booking.equipment_summary && (
                            <div className="tiny muted" style={{ marginTop: 4 }}>{booking.equipment_summary}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="small bold">{dateRange(booking.start_date, booking.end_date)}</div>
                          {days !== null && days >= 0 && days <= 14 && (
                            <div className="tiny" style={{ color: days <= 3 ? 'var(--warning)' : 'var(--ink-500)' }}>
                              in {days} day{days === 1 ? '' : 's'}
                            </div>
                          )}
                          <div className="tiny muted">{money(booking.total_cents, currency, booking.currency)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------ NEW BOOKING */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New equipment booking"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create booking</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 'var(--s6)' }} className="booking-grid">
          <div>
            <div className="field-row">
              <Field label="Contact name" required>
                <Input
                  value={form.contact_name || ''}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </Field>
              <Field label="Client organisation">
                <Select
                  value={form.organisation_id || ''}
                  onChange={(e) => setForm({ ...form, organisation_id: e.target.value })}
                  placeholder="Walk-in / not linked"
                  options={organisations.map((o) => ({ value: o.id, label: o.name }))}
                />
              </Field>
            </div>

            <div className="field-row">
              <Field label="Phone">
                <Input value={form.contact_phone || ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.contact_email || ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </Field>
            </div>

            <Field label="Event name">
              <Input value={form.event_name || ''} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
            </Field>

            <Field label="Venue">
              <Input value={form.venue || ''} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            </Field>

            <div className="field-row">
              <Field label="Event starts" required>
                <Input
                  type="datetime-local"
                  value={form.start_date || ''}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </Field>
              <Field label="Event ends" required>
                <Input
                  type="datetime-local"
                  value={form.end_date || ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </Field>
            </div>

            <div className="field-row">
              <Field label="Gear leaves store" hint="Blocks stock from this moment, not just the event start">
                <Input
                  type="datetime-local"
                  value={form.setup_date || ''}
                  onChange={(e) => setForm({ ...form, setup_date: e.target.value })}
                />
              </Field>
              <Field label="Gear back in store">
                <Input
                  type="datetime-local"
                  value={form.teardown_date || ''}
                  onChange={(e) => setForm({ ...form, teardown_date: e.target.value })}
                />
              </Field>
            </div>

            <div className="row-between" style={{ marginBlock: 'var(--s4)' }}>
              <h5 style={{ fontSize: 'var(--text-sm)' }}>Equipment</h5>
              <Button size="sm" variant="outline" onClick={addLine}>+ Add item</Button>
            </div>

            {(form.items || []).map((item, index) => {
              const avail = availability.find((a) => String(a.id) === String(item.equipment_id));
              const short = avail && Number(item.quantity) > avail.available;
              return (
                <div key={index} style={{
                  padding: 'var(--s3)', border: `1px solid ${short ? 'var(--danger)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', marginBottom: 'var(--s2)',
                }}>
                  <div className="row" style={{ gap: 'var(--s2)', alignItems: 'flex-end' }}>
                    <Field label="Item" style={{ flex: 1 }}>
                      <Select
                        value={item.equipment_id || ''}
                        onChange={(e) => updateLine(index, { equipment_id: e.target.value })}
                        placeholder="Choose equipment"
                        options={equipment.map((eq) => ({
                          value: eq.id,
                          label: `${eq.name} — ${money(eq.daily_rate_cents, 'TZS')}/day`,
                        }))}
                      />
                    </Field>
                    <Field label="Qty" style={{ width: 80 }}>
                      <Input
                        type="number" min={1} value={item.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Sqm/units" style={{ width: 90 }}>
                      <Input
                        type="number" step="0.1" value={item.measure_qty}
                        onChange={(e) => updateLine(index, { measure_qty: Number(e.target.value) })}
                      />
                    </Field>
                    <Button variant="ghost" size="sm" onClick={() => removeLine(index)} style={{ color: 'var(--danger)' }}>
                      ✕
                    </Button>
                  </div>
                  {avail && (
                    <div className="tiny" style={{ color: short ? 'var(--danger)' : 'var(--success)' }}>
                      {short
                        ? `Only ${avail.available} available for these dates (you asked for ${item.quantity})`
                        : `${avail.available} of ${avail.total_units} available`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <aside>
            <div className="card card-pad" style={{ background: 'var(--ink-50)' }}>
              <h5 style={{ fontSize: 'var(--text-sm)' }}>Estimate</h5>
              {quote ? (
                <>
                  <div className="stack tiny" style={{ gap: 6, marginTop: 'var(--s3)' }}>
                    <div className="row-between">
                      <span className="muted">Hire days</span>
                      <span>{quote.rental_days}</span>
                    </div>
                    <div className="row-between">
                      <span className="muted">Equipment</span>
                      <span>{money(quote.subtotal_cents, currency)}</span>
                    </div>
                    {quote.transport_cents > 0 && (
                      <div className="row-between">
                        <span className="muted">Transport</span>
                        <span>{money(quote.transport_cents, currency)}</span>
                      </div>
                    )}
                    {quote.operator_cents > 0 && (
                      <div className="row-between">
                        <span className="muted">Technician</span>
                        <span>{money(quote.operator_cents, currency)}</span>
                      </div>
                    )}
                    <div className="row-between">
                      <span className="muted">VAT</span>
                      <span>{money(quote.vat_cents, currency)}</span>
                    </div>
                  </div>
                  <div className="row-between" style={{
                    marginTop: 'var(--s3)', paddingTop: 'var(--s3)', borderTop: '2px solid var(--ink-800)',
                  }}>
                    <strong>Total</strong>
                    <strong>{money(quote.total_cents, currency)}</strong>
                  </div>
                  {quote.deposit_cents > 0 && (
                    <div className="tiny muted" style={{ marginTop: 'var(--s2)' }}>
                      Refundable deposit: {money(quote.deposit_cents, currency)}
                    </div>
                  )}
                </>
              ) : (
                <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
                  Choose dates and equipment to see a price.
                </p>
              )}
            </div>
          </aside>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .booking-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </Modal>

      {/* ---------------------------------------------------- BOOKING DETAIL */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Booking ${detail.reference}` : ''}
        size="lg"
        footer={
          detail && (
            <div className="row-between" style={{ width: '100%' }}>
              <Badge status={detail.status} />
              <div className="row" style={{ gap: 'var(--s2)' }}>
                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                {detail.status === 'enquiry' && (
                  <Button variant="primary" onClick={() => setBookingStatus(detail, 'confirmed')}>Confirm</Button>
                )}
                {detail.status === 'confirmed' && (
                  <Button variant="primary" onClick={() => setBookingStatus(detail, 'dispatched')}>Mark dispatched</Button>
                )}
                {['dispatched', 'on_hire'].includes(detail.status) && (
                  <Button variant="primary" onClick={() => setBookingStatus(detail, 'returned')}>Record return</Button>
                )}
                {detail.status === 'returned' && (
                  <Button variant="primary" onClick={() => setBookingStatus(detail, 'completed')}>Complete</Button>
                )}
              </div>
            </div>
          )
        }
      >
        {detail && (
          <>
            <div className="grid grid-2" style={{ marginBottom: 'var(--s6)' }}>
              <div>
                <div className="tiny muted">Client</div>
                <div className="bold">{detail.organisation_name || detail.contact_name}</div>
                <div className="small muted">{detail.contact_phone} {detail.contact_email}</div>
              </div>
              <div>
                <div className="tiny muted">Event</div>
                <div className="bold">{detail.event_name || '—'}</div>
                <div className="small muted">{detail.venue}</div>
              </div>
              <div>
                <div className="tiny muted">Hire period</div>
                <div className="bold">{dateRange(detail.start_date, detail.end_date)}</div>
                <div className="small muted">{detail.rental_days} days</div>
              </div>
              <div>
                <div className="tiny muted">Total</div>
                <div className="bold">{money(detail.total_cents, currency, detail.currency)}</div>
                {Number(detail.deposit_cents) > 0 && (
                  <div className="small muted">Deposit {money(detail.deposit_cents, currency, detail.currency)}</div>
                )}
              </div>
            </div>

            <h5 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--s3)' }}>Equipment on this booking</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items?.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="small bold">{item.equipment_name}</div>
                      <div className="tiny muted mono">{item.sku}{item.asset_tag && ` · ${item.asset_tag}`}</div>
                    </td>
                    <td className="num">{item.quantity}{item.measure_qty > 1 && ` × ${item.measure_qty}`}</td>
                    <td className="num">{money(item.rate_cents, currency, detail.currency)}</td>
                    <td className="num bold">{money(item.line_total_cents, currency, detail.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {detail.damage_report && (
              <Alert tone="warning" title="Damage reported">{detail.damage_report}</Alert>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
