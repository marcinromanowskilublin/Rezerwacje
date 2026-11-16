import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Navigate, NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { config } from '../../config/features';
import { bookingApi } from '../../services/bookingApi';

export default function AdminGate({ children, loginOnly = false }: { children: ReactNode; loginOnly?: boolean }) {
  const [authed, setAuthed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bookingApi.getAdminSession()
      .then((session) => {
        if (!cancelled) setAuthed(session.authenticated);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = async (login: string, value: string) => {
    setLoading(true);
    try {
      const session = await bookingApi.adminLogin(login.trim(), value);
      setAuthed(session.authenticated);
      setLoginError(null);
    } catch (err: any) {
      setAuthed(false);
      setLoginError(err?.status === 401 ? 'Nieprawidłowy login lub hasło.' : 'Nie udało się zalogować.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    await unlock(username, password);
  };

  const logout = async () => {
    try {
      await bookingApi.adminLogout();
    } finally {
      setAuthed(false);
      setPassword('');
    }
  };

  if (checkingSession) return null;

  if (!authed) {
    return (
      <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in duration-300">
        <div className="text-center">
          <h1 className="text-3xl font-light text-neutral-900 mb-2">Panel</h1>
          <p className="text-neutral-500 text-sm">Zarządzanie grafikiem i wizytami.</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <label className="block text-[11px] uppercase font-bold text-neutral-500 tracking-widest" htmlFor="admin-login">
            Login
          </label>
          <input
            id="admin-login"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:border-neutral-900 outline-none"
            autoComplete="username"
            required
          />
          <label className="block text-[11px] uppercase font-bold text-neutral-500 tracking-widest" htmlFor="admin-password">
            Hasło
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:border-neutral-900 outline-none"
            autoComplete="current-password"
            required
          />
          {loginError && <p className="text-xs text-red-600">{loginError}</p>}
          <Button type="submit" className="w-full h-12" disabled={loading}>
            {loading ? 'Logowanie...' : 'Zaloguj'}
          </Button>
          {config.API_MODE !== 'production' && (
            <p className="text-[11px] text-neutral-500 text-center">
              Podgląd lokalny: login <span className="font-mono">admin</span>, hasło <span className="font-mono">admin</span>
            </p>
          )}
        </form>
      </div>
    );
  }

  if (loginOnly) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `h-10 px-4 rounded-xl text-xs uppercase tracking-widest flex items-center ${isActive ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600 hover:text-neutral-900'}`
            }
          >
            Wizyty
          </NavLink>
          <NavLink
            to="/admin/wiadomosci"
            className={({ isActive }) =>
              `h-10 px-4 rounded-xl text-xs uppercase tracking-widest flex items-center ${isActive ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600 hover:text-neutral-900'}`
            }
          >
            Wiadomości
          </NavLink>
          <NavLink
            to="/admin/grafik"
            className={({ isActive }) =>
              `h-10 px-4 rounded-xl text-xs uppercase tracking-widest flex items-center ${isActive ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600 hover:text-neutral-900'}`
            }
          >
            Grafik
          </NavLink>
          <NavLink
            to="/admin/ustawienia"
            className={({ isActive }) =>
              `h-10 px-4 rounded-xl text-xs uppercase tracking-widest flex items-center ${isActive ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600 hover:text-neutral-900'}`
            }
          >
            Ustawienia
          </NavLink>
        </nav>
        <Button onClick={() => void logout()} variant="ghost" className="h-10 text-xs">Wyloguj</Button>
      </div>
      {children}
    </div>
  );
}
