import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Scale, LayoutDashboard, FileText, GitCompare, BookOpen,
  Settings, LogOut, Moon, Sun, Menu, X, ChevronRight, Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Props = { children: React.ReactNode; darkMode: boolean; toggleDark: () => void };

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compare', icon: GitCompare, label: 'Compare' },
  { to: '/templates', icon: BookOpen, label: 'Templates' },
];

export default function Layout({ children, darkMode, toggleDark }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const roleColors: Record<string, string> = {
    lawyer: 'bg-blue-100 text-blue-700',
    admin: 'bg-rose-100 text-rose-700',
    paralegal: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-slate-900 dark:bg-slate-950 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-base tracking-tight">LexParse</span>
            <p className="text-slate-500 text-xs">Legal AI</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {profile?.role === 'admin' && (
            <NavLink
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              Admin Panel
            </NavLink>
          )}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-slate-800 space-y-1">
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-all"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                isActive ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Settings className="w-4 h-4" />
            Settings
          </NavLink>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg text-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>

          {/* Profile chip */}
          {profile && (
            <div className="mt-2 px-3 py-2.5 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">{profile.name?.[0]?.toUpperCase() || 'U'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{profile.name || 'User'}</p>
                  <p className="text-slate-500 text-xs truncate">{profile.firm_name || profile.email}</p>
                </div>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${roleColors[profile.role] || 'bg-slate-700 text-slate-300'}`}>
                  {profile.role}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 dark:text-slate-300">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-slate-900 dark:text-white">LexParse</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-4">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="w-3.5 h-3.5" />}
          {item.to ? (
            <NavLink to={item.to} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              {item.label}
            </NavLink>
          ) : (
            <span className="text-slate-900 dark:text-white font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
