import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, truncate } from '../../utils/format';
import PageHero from '../../components/PageHero';
import { Reveal, Eyebrow, ArrowRight } from '../../components/Motion';
import { Spinner, Empty, Modal, Button, Field, Input } from '../../components/UI';

export default function EquipmentCatalogue() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const { currency, toast, slot} = useApp();

  useEffect(() => {
    setLoading(true);
    const qs = api.qs({ category, search });
    Promise.all([
      api.get(`/public/equipment${qs}`).catch(() => ({ data: [] })),
      api.get('/public/equipment/categories').catch(() => ({ data: [] })),
    ])
      .then(([eq, cats]) => {
        setItems(eq.data || []);
        setCategories(cats.data || []);
      })
      .finally(() => setLoading(false));
  }, [category, search]);

  const checkAvailability = async () => {
    if (!dates.start || !dates.end) {
      toast('Choose both a start and an end date', 'error');
      return;
    }
    setChecking(true);
    try {
      const res = await api.get(
        `/public/equipment/${selected.id}/availability${api.qs({ start: dates.start, end: dates.end })}`
      );
      setAvailability(res.data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setChecking(false);
    }
  };

  const openItem = (item) => {
    setSelected(item);
    setAvailability(null);
    setDates({ start: '', end: '' });
  };

  return (
    <>
      <PageHero
        eyebrow="Equipment hire"
        title="LED, sound, lighting"
        highlight="and structures."
        lead="Hire the gear on its own, or let us run the whole production. Book two to four weeks ahead — LED walls and line array go first in peak season."
        media={slot('equipment-hero')}
        mediaAlt="Staging, lighting and AV equipment prepared for an event"
      />

      <section className="section">
        <div className="container">
          <div className="row row-wrap" style={{ gap: 'var(--s3)', marginBottom: 'var(--s8)' }}>
            <input
              className="input"
              placeholder="Search equipment…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <button
              className={`filter ${!category ? 'is-on' : ''}`}
              onClick={() => setCategory('')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                className={`filter ${category === cat.slug ? 'is-on' : ''}`}
                onClick={() => setCategory(cat.slug)}
              >
                {cat.name}
                {cat.item_count > 0 && <span className="tiny muted"> ({cat.item_count})</span>}
              </button>
            ))}
          </div>

          {loading ? <Spinner center /> : items.length === 0 ? (
            <Empty title="No equipment matches" description="Try a different category or search term." />
          ) : (
            <div className="grid grid-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  className="card card-hover"
                  onClick={() => openItem(item)}
                  style={{ textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{
                    aspectRatio: '4/3',
                    background: item.cover_thumb || item.cover_url
                      ? `url(${item.cover_thumb || item.cover_url}) center/cover`
                      : 'linear-gradient(135deg, var(--ink-200), var(--ink-100))',
                  }} />
                  <div className="card-pad">
                    <div className="row-between">
                      <span className="tiny bold muted">{item.category_name}</span>
                      {item.is_featured && <span className="badge badge-brand">Popular</span>}
                    </div>
                    <h4 style={{ fontSize: 'var(--text-base)', marginTop: 4 }}>{item.name}</h4>
                    <p className="small muted" style={{ marginTop: 'var(--s2)', minHeight: 40 }}>
                      {truncate(item.description, 90)}
                    </p>

                    <div className="row-between" style={{
                      marginTop: 'var(--s4)', paddingTop: 'var(--s3)', borderTop: '1px solid var(--border)',
                    }}>
                      <div>
                        <span className="bold">{money(item.daily_rate_cents, currency)}</span>
                        <span className="tiny muted">
                          {item.unit_of_measure === 'sqm' ? ' / sqm / day' : ' / day'}
                        </span>
                      </div>
                      <span className="tiny" style={{ color: 'var(--flame)', fontWeight: 600 }}>
                        Check dates →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Link to="/contact" className="btn">Request this equipment</Link>
          </>
        }
      >
        {selected && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s6)' }} className="equip-modal">
            <div>
              {selected.cover_url && (
                <img
                  src={selected.cover_url}
                  alt={selected.name}
                  style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: 'var(--s4)' }}
                />
              )}
              <p className="small">{selected.description}</p>

              {selected.specifications?.length > 0 && (
                <table className="table" style={{ marginTop: 'var(--s5)' }}>
                  <tbody>
                    {selected.specifications.map((spec, i) => (
                      <tr key={i}>
                        <td className="small muted" style={{ padding: '0.5rem 0' }}>{spec.label}</td>
                        <td className="small bold" style={{ padding: '0.5rem 0', textAlign: 'right' }}>{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <div className="card card-pad" style={{ background: 'var(--ink-50)' }}>
                <h5 style={{ fontSize: 'var(--text-sm)' }}>Rates</h5>
                <div className="stack small" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
                  <div className="row-between">
                    <span className="muted">Daily</span>
                    <span className="bold">{money(selected.daily_rate_cents, currency)}</span>
                  </div>
                  {Number(selected.half_day_rate_cents) > 0 && (
                    <div className="row-between">
                      <span className="muted">Half day</span>
                      <span className="bold">{money(selected.half_day_rate_cents, currency)}</span>
                    </div>
                  )}
                  {Number(selected.weekly_rate_cents) > 0 && (
                    <div className="row-between">
                      <span className="muted">Weekly</span>
                      <span className="bold">{money(selected.weekly_rate_cents, currency)}</span>
                    </div>
                  )}
                  {Number(selected.deposit_cents) > 0 && (
                    <div className="row-between">
                      <span className="muted">Refundable deposit</span>
                      <span className="bold">{money(selected.deposit_cents, currency)}</span>
                    </div>
                  )}
                  {selected.requires_operator === 1 && (
                    <div className="tiny" style={{ color: 'var(--warning)', marginTop: 4 }}>
                      A technician is required with this item and is charged separately.
                    </div>
                  )}
                </div>
              </div>

              <div className="card card-pad" style={{ marginTop: 'var(--s4)' }}>
                <h5 style={{ fontSize: 'var(--text-sm)' }}>Check availability</h5>
                <div style={{ marginTop: 'var(--s3)' }}>
                  <Field label="From">
                    <Input
                      type="date"
                      value={dates.start}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setDates({ ...dates, start: e.target.value })}
                    />
                  </Field>
                  <Field label="To">
                    <Input
                      type="date"
                      value={dates.end}
                      min={dates.start || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setDates({ ...dates, end: e.target.value })}
                    />
                  </Field>
                  <Button variant="dark" onClick={checkAvailability} loading={checking} className="btn-block">
                    Check
                  </Button>
                </div>

                {availability && (
                  <div
                    className={`alert ${availability.is_available ? 'alert-success' : 'alert-danger'}`}
                    style={{ marginTop: 'var(--s4)' }}
                  >
                    <div>
                      {availability.is_available ? (
                        <>
                          <strong>{availability.available} available</strong> of {availability.total_units} for those dates.
                        </>
                      ) : (
                        <>Fully booked for those dates. Talk to us — we can often source more through our supplier network.</>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @media (max-width: 768px) {
          .equip-modal { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
