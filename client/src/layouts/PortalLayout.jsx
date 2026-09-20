import { Outlet, NavLink, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/UI';
import { LogoMark } from '../components/Motion';

const NAV = [
  { to: '/portal', label: 'Overview', end: true },
  { to: '/portal/projects', label: 'Projects' },
  { to: '/portal/invoices', label: 'Invoices' },
  { to: '/portal/requests', label: 'Requests' },
];

export default function PortalLayout() {
  const { user, logout, currency, setCurrency } = useApp();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--ink)',
        position: 'sticky', top: 0, zIndex: 80,
      }}>
        <div className="container">
          <div className="row-between" style={{ height: 'var(--header-h)' }}>
            <Link to="/portal" className="row" style={{ gap: 10, color: '#fff' }}>
              <LogoMark size={28} onDark />
              <div style={{ lineHeight: 1.25 }}>
                <div style={{
                  fontFamily: 'var(--display)', fontWeight: 700, color: '#fff',
                  fontSize: 15, letterSpacing: '-.04em', textTransform: 'uppercase',
                }}>
                  Client Portal
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
                  {user?.organisation_name}
                </div>
              </div>
            </Link>

            <div className="row" style={{ gap: 'var(--s3)' }}>
              <select
                className="select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  width: 'auto', padding: '0.35rem 1.9rem 0.35rem 0.7rem',
                  fontSize: 'var(--text-xs)', background: 'rgba(255,255,255,0.08)',
                  color: 'white', borderColor: 'rgba(255,255,255,0.2)',
                }}
                aria-label="Display currency"
              >
                <option value="TZS" style={{ color: 'var(--ink-900)' }}>TZS</option>
                <option value="USD" style={{ color: 'var(--ink-900)' }}>USD</option>
              </select>

              <Avatar src={user?.avatar_url} first={user?.first_name} last={user?.last_name} />
              <button className="btn btn-light btn-sm" onClick={logout}>Sign out</button>
            </div>
          </div>

          <nav className="row" style={{ gap: 'var(--s5)', paddingBottom: 'var(--s3)', overflowX: 'auto' }}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--primary)' : 'rgba(255,255,255,.55)',
                  paddingBottom: 'var(--s2)',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="container" style={{ paddingBlock: 'var(--s8)' }}>
        <Outlet />
      </main>
    </div>
  );
}
