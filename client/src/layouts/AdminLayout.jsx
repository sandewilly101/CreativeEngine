import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Avatar } from '../components/UI';
import { LogoMark } from '../components/Motion';
import Icon from '../components/Icons';
import { timeAgo } from '../utils/format';

/**
 * Admin navigation. Each entry names the permission it needs; the sidebar
 * hides what a staff member cannot reach, and the server enforces the same
 * rules independently.
 */
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true, perm: 'dashboard.view' },
      { to: '/admin/reports', label: 'Reports', icon: 'reports', perm: 'reports.view' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/admin/leads', label: 'Leads', icon: 'leads', perm: 'leads.view' },
      { to: '/admin/clients', label: 'Clients', icon: 'clients', perm: 'organisations.view' },
      { to: '/admin/quotes', label: 'Quotes', icon: 'quotes', perm: 'quotes.view' },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { to: '/admin/projects', label: 'Projects', icon: 'projects', perm: 'projects.view' },
      { to: '/admin/events', label: 'Events', icon: 'events', perm: 'events.view' },
      { to: '/admin/print-orders', label: 'Print Orders', icon: 'print', perm: 'print.view' },
      { to: '/admin/bookings', label: 'Equipment Hire', icon: 'bookings', perm: 'bookings.view' },
      { to: '/admin/equipment', label: 'Equipment', icon: 'equipment', perm: 'equipment.view' },
      { to: '/admin/suppliers', label: 'Suppliers', icon: 'suppliers', perm: 'suppliers.view' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/invoices', label: 'Invoices', icon: 'invoices', perm: 'invoices.view' },
      { to: '/admin/subscriptions', label: 'Subscriptions', icon: 'subscriptions', perm: 'subscriptions.view' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/content', label: 'Website', icon: 'website', perm: 'cms.view' },
      { to: '/admin/media', label: 'Media Library', icon: 'media', perm: 'media.view' },
      { to: '/admin/ai', label: 'AI Assistants', icon: 'ai', perm: 'ai.view' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/users', label: 'Users & Roles', icon: 'users', perm: 'users.view' },
      { to: '/admin/settings', label: 'Settings', icon: 'settings', perm: 'settings.view' },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout, can, currency, setCurrency } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/notifications?limit=12');
      setNotifications(res.data || []);
      setUnread(res.unread_count || 0);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const markRead = async (notification) => {
    try { await api.post(`/dashboard/notifications/${notification.id}/read`); } catch { /* ignore */ }
    setUnread((n) => Math.max(0, n - 1));
    setShowNotifications(false);
    if (notification.link_url) navigate(notification.link_url);
  };

  const markAllRead = async () => {
    try { await api.post('/dashboard/notifications/read-all'); } catch { /* ignore */ }
    setUnread(0);
    loadNotifications();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ------------------------------------------------------- SIDEBAR */}
      <aside
        className="admin-sidebar"
        style={{
          width: 'var(--sidebar-w)',
          background: 'var(--ink)',
          color: 'rgba(255,255,255,.62)',
          position: 'fixed', inset: '0 auto 0 0',
          overflowY: 'auto',
          zIndex: 90,
          transform: sidebarOpen ? 'none' : undefined,
        }}
      >
        <div style={{ padding: 'var(--s5) var(--s5) var(--s4)' }}>
          <Link to="/admin" className="logo" style={{ color: '#fff' }}>
            <LogoMark size={28} onDark />
            <span className="logo__text">
              Creative Engine
              <small>Admin</small>
            </span>
          </Link>
        </div>

        <nav style={{ padding: '0 var(--s3) var(--s8)' }}>
          {NAV_GROUPS.map((group) => {
            const visible = group.items.filter((item) => !item.perm || can(item.perm));
            if (!visible.length) return null;
            return (
              <div key={group.label} style={{ marginBottom: 'var(--s5)' }}>
                <div style={{
                  padding: '0 var(--s3)', marginBottom: 'var(--s2)',
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--ink-600)',
                }}>
                  {group.label}
                </div>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                      padding: '0.55rem var(--s3)',
                      borderRadius: 'var(--radius)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'white' : 'var(--ink-400)',
                      background: isActive ? 'rgba(204,255,1,.12)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--flame)' : '2px solid transparent',
                      marginBottom: 1,
                      transition: 'all 140ms',
                    })}
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 85 }}
          className="sidebar-backdrop"
        />
      )}

      {/* ---------------------------------------------------------- MAIN */}
      <div className="admin-main" style={{ flex: 1, marginLeft: 'var(--sidebar-w)', minWidth: 0 }}>
        <header style={{
          height: 'var(--header-h)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 80,
          display: 'flex', alignItems: 'center',
          padding: '0 var(--s6)', gap: 'var(--s4)',
        }}>
          <button
            className="btn btn-ghost btn-icon sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ display: 'none' }}
            aria-label="Toggle navigation"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="spacer" />

          <select
            className="select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ width: 'auto', padding: '0.35rem 1.9rem 0.35rem 0.7rem', fontSize: 'var(--text-xs)' }}
            aria-label="Display currency"
          >
            <option value="TZS">TZS</option>
            <option value="USD">USD</option>
          </select>

          <Link to="/" className="btn btn-ghost btn-sm hide-sm" target="_blank">View site</Link>

          {/* notifications */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => { setShowNotifications((v) => !v); if (!showNotifications) loadNotifications(); }}
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <Icon name="bell" size={19} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  minWidth: 16, height: 16, padding: '0 4px',
                  background: 'var(--primary)', color: 'var(--on-primary)',
                  borderRadius: 999, fontSize: 10, fontWeight: 700,
                  display: 'grid', placeItems: 'center',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  onClick={() => setShowNotifications(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 95 }}
                />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  width: 340, maxHeight: 420, overflowY: 'auto',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                  zIndex: 96,
                }}>
                  <div className="row-between" style={{ padding: 'var(--s4)', borderBottom: '1px solid var(--border)' }}>
                    <strong className="small">Notifications</strong>
                    {unread > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 'var(--s8)', textAlign: 'center' }} className="small muted">
                      Nothing new
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markRead(n)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: 'var(--s4)', border: 'none',
                          borderBottom: '1px solid var(--border)',
                          background: n.is_read ? 'transparent' : 'var(--primary-tint)',
                          cursor: 'pointer',
                        }}
                      >
                        <div className="small bold">{n.title}</div>
                        {n.body && <div className="tiny muted" style={{ marginTop: 2 }}>{n.body}</div>}
                        <div className="tiny muted" style={{ marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* user menu */}
          <div className="row" style={{ gap: 'var(--s3)' }}>
            <div className="hide-sm" style={{ textAlign: 'right', lineHeight: 1.3 }}>
              <div className="small bold">{user?.first_name} {user?.last_name}</div>
              <div className="tiny muted">{user?.role_name}</div>
            </div>
            <Avatar src={user?.avatar_url} first={user?.first_name} last={user?.last_name} />
            <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        </header>

        <main style={{ padding: 'var(--s6)', maxWidth: 1600 }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        /* The logo classes live in the public layout; the admin shell needs
           its own copy since the two never render together. */
        .logo { display: inline-flex; align-items: center; gap: 10px; }
        .logo__text {
          font-family: var(--display); font-weight: 700; font-size: 15px;
          letter-spacing: -.04em; text-transform: uppercase; line-height: 1;
        }
        .logo__text small {
          display: block; font-size: 8px; letter-spacing: .2em;
          font-weight: 600; color: var(--primary); margin-top: 3px;
        }

        @media (max-width: 1024px) {
          .admin-sidebar {
            transform: translateX(-100%);
            transition: transform 200ms ease;
          }
          .admin-sidebar[style*="none"] { transform: none !important; }
          .admin-main { margin-left: 0 !important; }
          .sidebar-toggle { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}
