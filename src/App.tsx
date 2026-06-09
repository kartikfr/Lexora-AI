import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import DocumentPage from './pages/DocumentPage';
import ComparePage from './pages/ComparePage';
import TemplatesPage from './pages/TemplatesPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('lexparse-dark') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('lexparse-dark', String(darkMode));
  }, [darkMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500">Loading LexParse…</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <Layout darkMode={darkMode} toggleDark={() => setDarkMode(v => !v)}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/document/:id" element={<DocumentPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
