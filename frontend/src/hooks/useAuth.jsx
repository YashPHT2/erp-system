import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { authApi, refreshSession, setAccessToken, clearAccessToken, getErrorMessage, unwrap } from '../services/api';
import { TOKEN_KEY } from '../utils/format';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');
  useEffect(() => {
    let active = true;
    localStorage.removeItem(TOKEN_KEY);
    const ended = () => setUser(null);
    window.addEventListener('edufinance:session-ended', ended);
    (async () => {
      try {
        const metadata = unwrap(await api.get('/meta'));
        if (!active) return;
        setMeta(metadata);
        if (!metadata.setupRequired) {
          try {
            const session = await refreshSession();
            if (active) setUser(session.user);
          } catch (error) { if (error.response?.status !== 401) throw error; }
        }
        if (active) setBootError('');
      } catch (error) { if (active) setBootError(getErrorMessage(error)); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; window.removeEventListener('edufinance:session-ended', ended); };
  }, []);
  async function login(email, password) {
    clearAccessToken();
    const data = unwrap(await authApi.post('/auth/login', { email, password }));
    setAccessToken(data.accessToken); setUser(data.user); setBootError('');
  }
  async function logout() {
    await authApi.post('/auth/logout');
    clearAccessToken(); setUser(null);
  }
  async function reloadMeta() { setMeta(unwrap(await api.get('/meta'))); }
  function endSession() { clearAccessToken(); setUser(null); }
  const value = useMemo(() => ({ user, meta, ready, bootError, login, logout, reloadMeta, endSession,
    can: permission => Boolean(user?.permissions?.includes(permission)) }), [user, meta, ready, bootError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
