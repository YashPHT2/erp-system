import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageMeta';
import { reportService } from '../services/financeService';
import { getErrorMessage } from '../services/api';

export function Navbar({ onMenu }) {
  const { user, logout, can } = useAuth();
  const page = usePageTitle();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);
  const notesRef = useRef(null);

  useEffect(() => {
    function close(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
      if (notesRef.current && !notesRef.current.contains(event.target)) setNotesOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function openNotes() {
    setNotesOpen((open) => !open);
    setMenuOpen(false);
    if (!can('reports.read')) return;
    try {
      setNotes(await reportService.notifications());
    } catch (error) {
      setNotes([{ id: 'error', tone: 'neutral', text: getErrorMessage(error) }]);
    }
  }

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      <button type="button" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-50 lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-slate-500">{page.group}</p>
        <h1 className="truncate text-sm font-semibold text-slate-900">{page.title}</h1>
      </div>

      {can('fees.read') && (
        <form
          className="ml-auto hidden max-w-sm flex-1 md:block"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) navigate(`/fees/collect?q=${encodeURIComponent(query.trim())}`);
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or admission number" className="input pl-9" />
          </div>
        </form>
      )}

      <div className={`flex items-center gap-1 ${can('fees.read') ? '' : 'ml-auto'}`}>
        <div className="relative" ref={notesRef}>
          <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-50" aria-label="Notifications" onClick={openNotes}>
            <Bell className="h-4 w-4" />
          </button>
          {notesOpen && (
            <div className="absolute right-0 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Notifications</p>
              {notes.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">You are up to date.</p>}
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className="block w-full rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setNotesOpen(false);
                    if (note.href) navigate(note.href);
                  }}
                >
                  {note.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button type="button" className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-slate-50" onClick={() => { setMenuOpen((open) => !open); setNotesOpen(false); }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-4 text-slate-800">{user?.name}</span>
              <span className="block text-[11px] text-slate-500">{user?.roleLabel}</span>
            </span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <p className="mt-1 text-xs font-medium text-blue-700">{user?.roleLabel}</p>
              </div>
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenuOpen(false); setProfileOpen(true); }}>
                <UserRound className="h-4 w-4" /> Profile
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenuOpen(false); navigate('/account/password'); }}>Change password</button>
              {logoutError && <p className="px-3 py-2 text-xs text-rose-700">{logoutError}</p>}
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={async () => { try { await logout(); } catch (error) { setLogoutError(getErrorMessage(error)); } }}>
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close profile" onClick={() => setProfileOpen(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Name</dt><dd className="font-medium text-slate-900">{user?.name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="text-slate-900">{user?.email || '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Role</dt><dd className="text-slate-900">{user?.roleLabel}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">User ID</dt><dd className="truncate text-slate-900">{user?.userId}</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Your account permissions are managed by your institution administrator.
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-secondary" onClick={() => setProfileOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
