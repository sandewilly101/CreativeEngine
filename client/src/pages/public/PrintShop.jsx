import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, truncate } from '../../utils/format';
import PageHero from '../../components/PageHero';
import { Reveal, Eyebrow, ArrowRight } from '../../components/Motion';
import { Spinner, Empty, Modal, Button, Field, Input, Select } from '../../components/UI';

/**
 * Public print shop with a live quote calculator.
 * Pricing always comes back from the server — the browser never computes a
 * price the business has not agreed to.
 */
export default function PrintShop() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const { currency, toast, slot} = useApp();

  // configurator state
  const [config, setConfig] = useState({
    quantity: 1, width_mm: '', height_mm: '', substrate: '', sides: 'single', finishing: [],
  });
  const [quote, setQuote] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/public/print-products${category ? `?category=${category}` : ''}`)
      .then((res) => setProducts(res.data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [category]);

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  const openProduct = (product) => {
    setSelected(product);
    setQuote(null);
    const preset = product.size_presets?.[0];
    setConfig({
      quantity: product.min_order_qty || 1,
      width_mm: preset?.width_mm || '',
      height_mm: preset?.height_mm || '',
      substrate: product.substrates?.[0]?.name || '',
      sides: 'single',
      finishing: [],
    });
  };

  const calculate = useCallback(async () => {
    if (!selected) return;
    if (selected.pricing_basis === 'per_sqm' && (!config.width_mm || !config.height_mm)) return;

    setCalculating(true);
    try {
      const res = await api.post('/print-orders/calculate', {
        items: [{ product_id: selected.id, ...config }],
      });
      setQuote(res.data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCalculating(false);
    }
  }, [selected, config, toast]);

  // Recalculate as the configuration changes, lightly debounced.
  useEffect(() => {
    if (!selected) return undefined;
    const timer = setTimeout(calculate, 400);
    return () => clearTimeout(timer);
  }, [selected, config, calculate]);

  const toggleFinishing = (option) => {
    setConfig((c) => {
      const exists = c.finishing.find((f) => f.name === option.name);
      if (exists) return { ...c, finishing: c.finishing.filter((f) => f.name !== option.name) };
      // Guess a sensible default quantity: perimeter for per-metre options.
      const perimeter = ((Number(c.width_mm) + Number(c.height_mm)) * 2) / 1000;
      const qty = option.unit === 'metre' ? Math.max(1, Math.round(perimeter))
        : option.unit === 'each' && option.name.toLowerCase().includes('eyelet')
          ? Math.max(4, Math.round(perimeter * 2))
          : Number(c.quantity || 1);
      return { ...c, finishing: [...c.finishing, { name: option.name, quantity: qty }] };
    });
  };

  const setFinishingQty = (name, quantity) => {
    setConfig((c) => ({
      ...c,
      finishing: c.finishing.map((f) => (f.name === name ? { ...f, quantity: Number(quantity) || 0 } : f)),
    }));
  };

  return (
    <>
      <PageHero
        eyebrow="Print & branding"
        title="Price it yourself,"
        highlight="then send artwork."
        lead="Banners, signage, merchandise and vehicle branding. Configure the job below for an instant indicative price — we check your artwork before anything prints."
        media={slot('print-hero')}
        mediaAlt="A wide-format printer running a vivid colour banner"
      />

      <section className="section">
        <div className="container">
          <div className="row row-wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s8)' }}>
            <button
              className={`filter ${!category ? 'is-on' : ''}`}
              onClick={() => setCategory('')}
            >
              All products
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`filter ${category === cat ? 'is-on' : ''}`}
                onClick={() => setCategory(cat)}
                style={{ textTransform: 'capitalize' }}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? <Spinner center /> : products.length === 0 ? (
            <Empty title="No print products published yet" />
          ) : (
            <div className="grid grid-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  className="card card-hover"
                  onClick={() => openProduct(product)}
                  style={{ textAlign: 'left', cursor: 'pointer', padding: 0, border: '1px solid var(--border)' }}
                >
                  <div style={{
                    aspectRatio: '4/3',
                    background: product.cover_thumb || product.cover_url
                      ? `url(${product.cover_thumb || product.cover_url}) center/cover`
                      : 'linear-gradient(135deg, var(--ink-200), var(--ink-100))',
                  }} />
                  <div className="card-pad">
                    <span className="tiny bold muted" style={{ textTransform: 'capitalize' }}>{product.category}</span>
                    <h4 style={{ fontSize: 'var(--text-base)', marginTop: 4 }}>{product.name}</h4>
                    <p className="small muted" style={{ marginTop: 'var(--s2)', minHeight: 40 }}>
                      {truncate(product.description, 85)}
                    </p>
                    <div className="row-between" style={{
                      marginTop: 'var(--s4)', paddingTop: 'var(--s3)', borderTop: '1px solid var(--border)',
                    }}>
                      <div>
                        <span className="tiny muted">from </span>
                        <span className="bold">{money(product.base_price_cents, currency)}</span>
                        <span className="tiny muted">
                          {product.pricing_basis === 'per_sqm' ? ' / sqm' : ' / unit'}
                        </span>
                      </div>
                      <span className="tiny" style={{ color: 'var(--flame)', fontWeight: 600 }}>Configure →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------- CONFIGURATOR */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Configure: ${selected.name}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Link to="/contact" className="btn">Send this to us</Link>
          </>
        }
      >
        {selected && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--s6)' }} className="print-config">
            <div>
              <Field label="Quantity" required>
                <Input
                  type="number"
                  min={selected.min_order_qty || 1}
                  value={config.quantity}
                  onChange={(e) => setConfig({ ...config, quantity: Number(e.target.value) })}
                />
                {selected.min_order_qty > 1 && (
                  <span className="field-hint">Minimum order: {selected.min_order_qty}</span>
                )}
              </Field>

              {selected.pricing_basis === 'per_sqm' && (
                <>
                  {selected.size_presets?.length > 0 && (
                    <Field label="Standard sizes">
                      <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
                        {selected.size_presets.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className={`btn btn-sm ${
                              Number(config.width_mm) === preset.width_mm && Number(config.height_mm) === preset.height_mm
                                ? 'btn-dark' : 'btn-outline'
                            }`}
                            onClick={() => setConfig({
                              ...config, width_mm: preset.width_mm, height_mm: preset.height_mm,
                            })}
                            disabled={!preset.width_mm}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}

                  <div className="field-row">
                    <Field label="Width (mm)" required>
                      <Input
                        type="number"
                        value={config.width_mm}
                        onChange={(e) => setConfig({ ...config, width_mm: e.target.value })}
                      />
                    </Field>
                    <Field label="Height (mm)" required>
                      <Input
                        type="number"
                        value={config.height_mm}
                        onChange={(e) => setConfig({ ...config, height_mm: e.target.value })}
                      />
                    </Field>
                  </div>
                </>
              )}

              {selected.substrates?.length > 0 && (
                <Field label="Material">
                  <Select
                    value={config.substrate}
                    onChange={(e) => setConfig({ ...config, substrate: e.target.value })}
                  >
                    {selected.substrates.map((sub) => (
                      <option key={sub.name} value={sub.name}>
                        {sub.name}
                        {sub.price_modifier_cents > 0 && ` (+${money(sub.price_modifier_cents, currency)}/${sub.unit})`}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {selected.pricing_basis === 'per_sqm' && (
                <Field label="Printed sides">
                  <Select
                    value={config.sides}
                    onChange={(e) => setConfig({ ...config, sides: e.target.value })}
                    options={[
                      { value: 'single', label: 'Single sided' },
                      { value: 'double', label: 'Double sided' },
                    ]}
                  />
                </Field>
              )}

              {selected.finishing_options?.length > 0 && (
                <Field label="Finishing">
                  <div className="stack" style={{ gap: 'var(--s2)' }}>
                    {selected.finishing_options.map((option) => {
                      const chosen = config.finishing.find((f) => f.name === option.name);
                      return (
                        <div key={option.name} className="row" style={{ gap: 'var(--s3)' }}>
                          <label className="checkbox-row" style={{ flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={!!chosen}
                              onChange={() => toggleFinishing(option)}
                            />
                            <span className="small">
                              {option.name}
                              <span className="muted"> — {money(option.price_cents, currency)}/{option.unit}</span>
                            </span>
                          </label>
                          {chosen && (
                            <input
                              className="input"
                              type="number"
                              min={1}
                              value={chosen.quantity}
                              onChange={(e) => setFinishingQty(option.name, e.target.value)}
                              style={{ width: 80 }}
                              aria-label={`${option.name} quantity`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Field>
              )}
            </div>

            <aside>
              <div className="card card-pad" style={{ background: 'var(--ink-50)', position: 'sticky', top: 0 }}>
                <h5 style={{ fontSize: 'var(--text-sm)' }}>Indicative price</h5>

                {calculating ? (
                  <div style={{ padding: 'var(--s6) 0', textAlign: 'center' }}><Spinner /></div>
                ) : quote ? (
                  <>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)',
                      fontWeight: 800, marginBlock: 'var(--s3)',
                    }}>
                      {money(quote.total_cents, currency)}
                    </div>

                    <div className="stack tiny" style={{ gap: 6 }}>
                      {quote.items?.[0]?.area_sqm && (
                        <div className="row-between">
                          <span className="muted">Total area</span>
                          <span>{quote.items[0].area_sqm} sqm</span>
                        </div>
                      )}
                      <div className="row-between">
                        <span className="muted">Subtotal</span>
                        <span>{money(quote.subtotal_cents, currency)}</span>
                      </div>
                      {quote.items?.[0]?.finishing_cents > 0 && (
                        <div className="row-between">
                          <span className="muted">Finishing</span>
                          <span>{money(quote.items[0].finishing_cents, currency)}</span>
                        </div>
                      )}
                      <div className="row-between">
                        <span className="muted">VAT (18%)</span>
                        <span>{money(quote.vat_cents, currency)}</span>
                      </div>
                    </div>

                    <hr className="divider" style={{ marginBlock: 'var(--s4)' }} />

                    <div className="stack tiny muted" style={{ gap: 4 }}>
                      <div>Turnaround: {selected.turnaround_days} working days</div>
                      <div>Bleed required: {selected.bleed_mm}mm</div>
                      <div>Minimum resolution: {selected.min_dpi} DPI at final size</div>
                      <div>Colour: {selected.color_profile || 'CMYK'}</div>
                    </div>

                    <p className="tiny muted" style={{ marginTop: 'var(--s4)' }}>
                      This is an indicative price. We confirm it once we have seen your
                      artwork and checked the finishing.
                    </p>
                  </>
                ) : (
                  <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
                    Enter your size and quantity to see a price.
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </Modal>

      <style>{`
        @media (max-width: 800px) {
          .print-config { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
