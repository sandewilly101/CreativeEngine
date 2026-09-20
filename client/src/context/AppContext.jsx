import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, tokenStore, onAuthExpired } from '../utils/api';
import { setRates } from '../utils/format';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrencyState] = useState(() => {
    try { return localStorage.getItem('ce_currency') || 'TZS'; } catch { return 'TZS'; }
  });
  const [siteSettings, setSiteSettings] = useState({});
  const [slots, setSlots] = useState({});
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  // ------------------------------------------------------------- TOASTS
  const toast = useCallback((message, tone = 'default', ms = 4200) => {
    const id = ++toastId.current;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), ms);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  // --------------------------------------------------------------- AUTH
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    tokenStore.setAccess(res.accessToken);
    tokenStore.setRefresh(res.refreshToken);
    setUser(res.user);
    if (res.user?.display_currency) setCurrencyState(res.user.display_currency);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', { refreshToken: tokenStore.getRefresh() });
    } catch { /* signing out locally matters more than the server call */ }
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.user);
      return res.user;
    } catch {
      return null;
    }
  }, []);

  /** Permission check used to show or hide UI. The server enforces it too. */
  const can = useCallback((...permissions) => {
    if (!user) return false;
    if (user.role_slug === 'admin') return true;
    return permissions.some((p) => user.permissions?.includes(p));
  }, [user]);

  const setCurrency = useCallback((next) => {
    setCurrencyState(next);
    try { localStorage.setItem('ce_currency', next); } catch { /* private mode */ }
    if (user) api.patch('/auth/me', { display_currency: next }).catch(() => {});
  }, [user]);

  // --------------------------------------------------------------- BOOT
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Public data first; the site must render for signed-out visitors.
      try {
        const [ratesRes, settingsRes, slotsRes] = await Promise.all([
          api.get('/public/rates').catch(() => null),
          api.get('/public/settings').catch(() => null),
          api.get('/public/slots').catch(() => null),
        ]);
        if (!cancelled) {
          if (ratesRes?.data?.rates) setRates(ratesRes.data.rates);
          if (settingsRes?.data) setSiteSettings(settingsRes.data);
          if (slotsRes?.data) setSlots(slotsRes.data);
        }
      } catch { /* the site still works without these */ }

      // Then restore a session if there is one.
      if (tokenStore.getRefresh()) {
        try {
          const res = await api.post('/auth/refresh', { refreshToken: tokenStore.getRefresh() });
          tokenStore.setAccess(res.accessToken);
          if (!cancelled) {
            setUser(res.user);
            if (res.user?.display_currency) setCurrencyState(res.user.display_currency);
          }
        } catch {
          tokenStore.clear();
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  // Sign out cleanly if a refresh fails mid-session.
  useEffect(() => onAuthExpired(() => {
    setUser(null);
    toast('Your session has expired. Please sign in again.', 'error');
  }), [toast]);

  const value = {
    user, loading, login, logout, refreshUser, can,
    currency, setCurrency,
    siteSettings,
    slots,
    /** URL for an image slot, or null if neither an upload nor a fallback exists. */
    slot: (key) => slots[key]?.url ?? null,
    slotAlt: (key) => slots[key]?.alt ?? '',
    toast, toasts, dismissToast,
    isAdmin: user?.role_slug === 'admin',
    isStaff: user?.role_slug === 'staff',
    isClient: user?.role_slug === 'client',
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
