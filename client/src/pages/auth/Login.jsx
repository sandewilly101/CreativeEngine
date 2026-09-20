import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { api } from '../../utils/api';
import { Button, Field, Input, Alert } from '../../components/UI';
import { LogoMark, Marquee, ArrowRight } from '../../components/Motion';

const CAPABILITIES = [
  'Brand identity', 'Websites', 'AI assistants', 'Events',
  'Large format print', 'LED hire', 'Campaigns', 'Signage',
];

export default function Login() {
  const [mode, setMode] = useState('login'); // login | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const { login, user, siteSettings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Already signed in: send them where they belong.
  if (user) {
    const target = user.role_slug === 'client' ? '/portal' : '/admin';
    navigate(location.state?.from?.pathname || target, { replace: true });
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const account = await login(email, password);
      const target = account.role_slug === 'client' ? '/portal' : '/admin';
      navigate(location.state?.from?.pathname || target, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setNotice(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const brand = siteSettings.brand || {};

  return (
    <div className="login">
      {/* ------------------------------------------------------- BRAND SIDE */}
      <div className="login__brand">
        <span className="login__glow" aria-hidden="true" />

        <Link to="/" className="logo" style={{ color: '#fff', position: 'relative' }}>
          <LogoMark size={32} spin onDark />
          <span className="logo__text">
            {brand.company_name || 'Creative Engine'}
            <small>Idea to Impact</small>
          </span>
        </Link>

        <div className="login__pitch">
          <h2 className="display display--sm">
            One partner.<br />One <span className="accent">engine.</span>
          </h2>
          <p>
            Track projects, approve work, view invoices and request services —
            all in one place.
          </p>
        </div>

        <div className="login__band">
          <Marquee speed={48} gap={12}>
            {CAPABILITIES.map((label) => (
              <span key={label} className="mq-pill"><i />{label}</span>
            ))}
          </Marquee>
        </div>
      </div>

      {/* -------------------------------------------------------- FORM SIDE */}
      <div className="login__form">
        <div className="login__inner">
          {mode === 'login' ? (
            <>
              <h1 className="h2">Sign in</h1>
              <p className="muted" style={{ marginTop: 6, marginBottom: 32 }}>
                Welcome back.
              </p>

              {error && <Alert tone="danger">{error}</Alert>}

              <form onSubmit={submit} style={{ marginTop: error ? 20 : 0 }}>
                <Field label="Email address" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@creativeengine.co.tz"
                    autoComplete="username"
                    required
                    autoFocus
                  />
                </Field>

                <Field label="Password" required>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </Field>

                <Button type="submit" variant="primary" className="btn-block" loading={busy}>
                  Sign in
                </Button>
              </form>

              <button
                className="login__link"
                onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}
              >
                Forgot your password?
              </button>
            </>
          ) : (
            <>
              <h1 className="h2">Reset your password</h1>
              <p className="muted" style={{ marginTop: 6, marginBottom: 32 }}>
                We will email you a link to set a new one.
              </p>

              {error && <Alert tone="danger">{error}</Alert>}
              {notice && <Alert tone="success">{notice}</Alert>}

              <form onSubmit={sendReset} style={{ marginTop: (error || notice) ? 20 : 0 }}>
                <Field label="Email address" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@creativeengine.co.tz"
                    required
                    autoFocus
                  />
                </Field>

                <Button type="submit" variant="primary" className="btn-block" loading={busy}>
                  Send reset link
                </Button>
              </form>

              <button
                className="login__link"
                onClick={() => { setMode('login'); setError(''); setNotice(''); }}
              >
                ← Back to sign in
              </button>
            </>
          )}

          <div className="login__foot">
            <Link to="/">← Back to the website</Link>
          </div>
        </div>
      </div>

      <style>{`
        .login { min-height: 100vh; display: grid; grid-template-columns: 1.05fr 1fr; }
        /* Grid items default to min-width:auto and so refuse to shrink below
           their content. Without this the brand side's marquee widens the
           whole page and squeezes the form into a strip. */
        .login > * { min-width: 0; }

        .login__brand {
          position: relative;
          background: var(--ink);
          color: #fff;
          padding: clamp(32px, 4vw, 56px);
          display: flex; flex-direction: column; justify-content: space-between;
          gap: 40px;
          overflow: clip;
        }
        .login__glow {
          position: absolute; bottom: -25%; left: -18%;
          width: 560px; height: 560px; border-radius: 50%;
          background: radial-gradient(circle, rgba(204, 255, 1, .18), transparent 68%);
          pointer-events: none;
        }
        .login__pitch { position: relative; max-width: 30ch; }
        .login__pitch .display { color: #fff; }
        .login__pitch p {
          margin-top: 20px; font-size: 17px; line-height: 1.6;
          color: rgba(255, 255, 255, .6);
        }
        .login__band {
          position: relative;
          padding-top: 26px;
          border-top: 1px solid rgba(255, 255, 255, .1);
          min-width: 0;
          overflow: clip;
        }
        .login__band .mq-pill {
          background: rgba(255, 255, 255, .06);
          border-color: rgba(255, 255, 255, .14);
          color: rgba(255, 255, 255, .75);
        }

        .login__form { display: grid; place-items: center; padding: 40px 28px; background: var(--white); }
        .login__inner { width: 100%; max-width: 380px; }
        .login__link {
          display: block; width: 100%;
          margin-top: 18px; padding: 10px;
          background: none; border: 0; cursor: pointer;
          font-family: var(--ui); font-size: 14px; color: var(--muted);
          transition: color var(--fast) var(--ease);
        }
        .login__link:hover { color: var(--flame); }
        .login__foot { margin-top: 40px; text-align: center; }
        .login__foot a { font-size: 14px; color: var(--muted); }
        .login__foot a:hover { color: var(--ink); }

        @media (max-width: 860px) {
          .login { grid-template-columns: 1fr; }
          .login__brand { display: none; }
        }
      `}</style>
    </div>
  );
}
