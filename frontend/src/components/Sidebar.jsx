import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { navigation, settingsItem } from './navigation';
import { useAuth } from '../hooks/useAuth';
import { LogoMark } from './LogoMark';

export function Sidebar({ collapsed, mobileOpen, onToggle, onClose }) {
  const { can } = useAuth();
  const groups = navigation.map(group => ({ ...group, items: group.items.filter(item => !item.permission || can(item.permission)) })).filter(group => group.items.length);
  const SettingsIcon = settingsItem.icon;
  return (
    <>
      {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" aria-label="Close menu" onClick={onClose} />}
      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ${collapsed ? 'w-[72px]' : 'w-60'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`flex h-14 items-center border-b border-slate-100 ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'}`}>
          <LogoMark />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">EduFinance</p>
              <p className="truncate text-[11px] text-slate-500">Finance & payroll</p>
            </div>
          )}
          <button type="button" className="ml-auto rounded-md p-1 text-slate-400 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{group.label}</p>}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      onClick={onClose}
                      className={({ isActive }) => `flex h-8 items-center rounded-md text-sm ${collapsed ? 'justify-center' : 'gap-2.5 px-2'} ${isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-2">
          {can('settings.read') && <NavLink
            to={settingsItem.to}
            title={collapsed ? 'Settings' : undefined}
            onClick={onClose}
            className={({ isActive }) => `flex h-8 items-center rounded-md text-sm ${collapsed ? 'justify-center' : 'gap-2.5 px-2'} ${isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
            {!collapsed && 'Settings'}
          </NavLink>}
          <button type="button" className="mt-1 hidden h-8 w-full items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700 lg:flex" onClick={onToggle}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
