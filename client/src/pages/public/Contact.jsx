import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { Button, Field, Input, Textarea, Select, Alert } from '../../components/UI';
import { SocialRow } from '../../components/SocialIcons';

const BUDGETS = [
  'Under TZS 1,000,000',
  'TZS 1,000,000 – 5,000,000',
  'TZS 5,000,000 – 20,000,000',
  'TZS 20,000,000 – 50,000,000',
  'Over TZS 50,000,000',
  'Not sure yet',
];

export default function Contact() {
  const [divisions, setDivisions] = useState([]);
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '',
    division_id: '', budget_range: '', message: '',
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const { siteSettings } = useApp();

  useEffect(() => {
    api.get('/public/divisions')
      .then((res) => setDivisions(res.data || []))
      .catch(() => setDivisions([]));
  }, []);

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Please tell us your name';
    if (!form.email.trim() && !form.phone.trim()) {
      next.email = 'We need either an email address or a phone number';
    }
    if (form.email && !form.email.includes('@')) next.email = 'That does not look like an email address';
    if (!form.message.trim()) next.message = 'Tell us a little about the project';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSending(true);
    try {
      // Carry campaign parameters through so lead sources stay accurate.
      const params = new URLSearchParams(window.location.search);
      const res = await api.post('/public/contact', {
        ...form,
        division_id: form.division_id || null,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
      });
      setResult({ ok: true, message: res.message, reference: res.reference });
      setForm({ name: '', company: '', email: '', phone: '', division_id: '', budget_range: '', message: '' });
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  const contact = siteSettings.contact || {};
  const social = siteSettings.social || {};

  return (
    <>
      {/* data-nav-dark: this band runs up under the fixed header, so the nav
          has to know it is over ink or its text and logo stay dark on dark. */}
      <section data-nav-dark style={{
        background: 'var(--ink)', color: 'white',
        marginTop: 'calc(var(--header-h) * -1)',
        paddingTop: 'calc(var(--header-h) + var(--s16))',
        paddingBottom: 'var(--s16)',
      }}>
        <div className="container">
          <h1 style={{ color: 'white', maxWidth: 720 }}>
            Tell us what you are working on
          </h1>
          <p className="lead" style={{ color: 'var(--ink-300)', marginTop: 'var(--s5)', maxWidth: 600 }}>
            Describe the problem rather than the service you think you need. We will come
            back with what it actually takes — and an honest answer if we are not the right fit.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--s12)' }}
            className="contact-grid">
            <div>
              {result && (
                <Alert tone={result.ok ? 'success' : 'danger'} title={result.ok ? 'Thank you' : 'Something went wrong'}>
                  {result.message}
                  {result.reference && (
                    <div className="small" style={{ marginTop: 4 }}>
                      Your reference: <strong>{result.reference}</strong>
                    </div>
                  )}
                </Alert>
              )}

              <form onSubmit={submit} style={{ marginTop: result ? 'var(--s6)' : 0 }}>
                <div className="field-row">
                  <Field label="Your name" required error={errors.name}>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Amina Hassan"
                      error={errors.name}
                    />
                  </Field>
                  <Field label="Company">
                    <Input
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      placeholder="Your organisation"
                    />
                  </Field>
                </div>

                <div className="field-row">
                  <Field label="Email" error={errors.email}>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@company.co.tz"
                      error={errors.email}
                    />
                  </Field>
                  <Field label="Phone / WhatsApp">
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+255 7XX XXX XXX"
                    />
                  </Field>
                </div>

                <div className="field-row">
                  <Field label="What do you need help with?">
                    <Select
                      value={form.division_id}
                      onChange={(e) => setForm({ ...form, division_id: e.target.value })}
                      placeholder="Select an area"
                      options={divisions.map((d) => ({ value: d.id, label: d.name }))}
                    />
                  </Field>
                  <Field label="Approximate budget" hint="A range is fine — it helps us scope realistically.">
                    <Select
                      value={form.budget_range}
                      onChange={(e) => setForm({ ...form, budget_range: e.target.value })}
                      placeholder="Select a range"
                      options={BUDGETS.map((b) => ({ value: b, label: b }))}
                    />
                  </Field>
                </div>

                <Field label="About the project" required error={errors.message}>
                  <Textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="What are you trying to achieve, and by when?"
                    rows={6}
                    error={errors.message}
                  />
                </Field>

                <Button type="submit" variant="primary" size="lg" loading={sending}>
                  Send enquiry
                </Button>
                <p className="tiny muted" style={{ marginTop: 'var(--s3)' }}>
                  We usually reply within one working day.
                </p>
              </form>
            </div>

            <aside>
              <div className="card card-pad">
                <h4 style={{ fontSize: 'var(--text-base)' }}>Reach us directly</h4>
                <div className="stack" style={{ gap: 'var(--s4)', marginTop: 'var(--s5)' }}>
                  {contact.phone && (
                    <div>
                      <div className="tiny muted">Phone</div>
                      <a href={`tel:${contact.phone}`} className="bold">{contact.phone}</a>
                    </div>
                  )}
                  {contact.whatsapp && (
                    <div>
                      <div className="tiny muted">WhatsApp</div>
                      <a
                        href={`https://wa.me/${String(contact.whatsapp).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="bold"
                      >
                        {contact.whatsapp}
                      </a>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <div className="tiny muted">Email</div>
                      <a href={`mailto:${contact.email}`} className="bold">{contact.email}</a>
                    </div>
                  )}
                  <div>
                    <div className="tiny muted">Studio</div>
                    <div className="small">
                      {contact.address_line1 && <>{contact.address_line1}<br /></>}
                      {contact.city || 'Dar es Salaam'}, {contact.country || 'Tanzania'}
                    </div>
                  </div>
                  {contact.working_hours && (
                    <div>
                      <div className="tiny muted">Hours</div>
                      <div className="small">{contact.working_hours}</div>
                    </div>
                  )}

                  {Object.values(social).some(Boolean) && (
                    <div>
                      <div className="tiny muted" style={{ marginBottom: 'var(--s3)' }}>Follow</div>
                      <div className="social-row--light">
                        <SocialRow links={social} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card card-pad" style={{ marginTop: 'var(--s4)', background: 'var(--ink-100)', border: 'none' }}>
                <h5 style={{ fontSize: 'var(--text-sm)' }}>Urgent print or equipment?</h5>
                <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                  Call or WhatsApp rather than emailing. Same-day print and next-day
                  equipment are often possible, but only if we hear from you early.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
