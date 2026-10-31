import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { unwrap } from '../services/api';
import { TOKEN_KEY } from '../utils/format';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const metaResponse = await api.get('/meta');
        if (!active) return;
        setMeta(metaResponse.data.data);
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          const me = await api.get('/auth/me');
          if (!active) return;
          setUser(unwrap(me));
        }
        setBootError('');
      } catch (error) {
        if (!active) return;
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setBootError(error?.response ? '' : 'The finance API is not reachable.');
      } finally {
        if (active) setReady(true);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    const response = await api.post('/dev-auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, response.data.data.token);
    setUser(response.data.data.user);
  }

  async function acceptToken(token) {
    localStorage.setItem(TOKEN_KEY, token.trim());
    const me = await api.get('/auth/me');
    setUser(unwrap(me));
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    meta,
    ready,
    bootError,
    login,
    acceptToken,
    logout,
    can: (permission) => Boolean(user?.permissions?.includes(permission)),
  }), [user, meta, ready, bootError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
