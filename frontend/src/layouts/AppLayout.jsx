import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { PageMetaProvider } from '../hooks/usePageMeta';
import { useAuth } from '../hooks/useAuth';

export function AppLayout() {
  const { meta } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('edufinance_sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    setCollapsed((current) => {
      localStorage.setItem('edufinance_sidebar', current ? 'expanded' : 'collapsed');
      return !current;
    });
  }

  return (
    <PageMetaProvider>
      <div className="min-h-screen bg-canvas">
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggle={toggle} onClose={() => setMobileOpen(false)} />
        <div className={collapsed ? 'lg:pl-[72px]' : 'lg:pl-60'}>
          <Navbar onMenu={() => setMobileOpen(true)} />
          <main className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-[1360px]">
              {meta?.demo && <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Live demonstration — all accounts, students, and transactions shown here are sample data.</div>}
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </PageMetaProvider>
  );
}
