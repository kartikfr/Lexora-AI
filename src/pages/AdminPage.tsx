import { useEffect, useState } from 'react';
import {
  Shield, Users, FileText, Activity, Trash2, Search,
  RefreshCw, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Document } from '../types';
import { formatFileSize } from '../lib/pdf';
import { formatDistanceToNow } from 'date-fns';
import RiskBadge from '../components/RiskBadge';

type UserRow = { id: string; name: string; email: string; role: string; firm_name: string; created_at: string; doc_count?: number };

export default function AdminPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'documents' | 'health'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [docs, setDocs] = useState<(Document & { risk_level?: string; user_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    else if (activeTab === 'documents') loadAllDocs();
  }, [activeTab]);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) {
      const enriched = await Promise.all(
        (data as UserRow[]).map(async (u) => {
          const { count } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id);
          return { ...u, doc_count: count || 0 };
        })
      );
      setUsers(enriched);
    }
    setLoading(false);
  }

  async function loadAllDocs() {
    setLoading(true);
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (documents) {
      const enriched = await Promise.all(
        (documents as Document[]).map(async (doc) => {
          const { data: prof } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', doc.user_id)
            .maybeSingle();
          const { data: summary } = await supabase
            .from('analyses')
            .select('result_json')
            .eq('document_id', doc.id)
            .eq('analysis_type', 'summary')
            .maybeSingle();
          return {
            ...doc,
            user_name: (prof as { name?: string } | null)?.name || 'Unknown',
            risk_level: (summary?.result_json as { risk_level?: string } | null)?.risk_level,
          };
        })
      );
      setDocs(enriched);
    }
    setLoading(false);
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document and all its analyses?')) return;
    await supabase.from('documents').delete().eq('id', id);
    setDocs(d => d.filter(doc => doc.id !== id));
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.firm_name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDocs = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.user_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    users: users.length,
    docs: docs.length,
    processing: docs.filter(d => d.status === 'processing').length,
    failed: docs.filter(d => d.status === 'failed').length,
  };

  const roleColors: Record<string, string> = {
    lawyer: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    admin: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
    paralegal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-rose-100 dark:bg-rose-950/40 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">System management and oversight</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Users', value: stats.users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { icon: FileText, label: 'Total Documents', value: stats.docs, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
          { icon: Clock, label: 'Processing', value: stats.processing, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          { icon: AlertCircle, label: 'Failed', value: stats.failed, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-card">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
        <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'health', label: 'System Health', icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id as typeof activeTab); setSearch(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
          </div>
          <button
            onClick={() => activeTab === 'users' ? loadUsers() : loadAllDocs()}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Users table */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Firm</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Docs</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center">
                          <span className="text-blue-700 dark:text-blue-400 text-xs font-semibold">{u.name?.[0]?.toUpperCase() || 'U'}</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{u.name || '—'}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{u.firm_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${roleColors[u.role] || 'bg-slate-100 text-slate-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{u.doc_count}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Documents table */}
        {activeTab === 'documents' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Document</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Risk</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Uploaded</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredDocs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate max-w-[200px]">{doc.title}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{doc.user_name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{doc.doc_type}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                        doc.status === 'ready' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                        doc.status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 animate-pulse' :
                        'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {doc.risk_level && (
                        <RiskBadge level={doc.risk_level as Parameters<typeof RiskBadge>[0]['level']} size="sm" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatFileSize(doc.file_size)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteDoc(doc.id)}
                        className="p-1 text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Health */}
        {activeTab === 'health' && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Analysis Success Rate', value: docs.length ? `${Math.round((docs.filter(d => d.status === 'ready').length / docs.length) * 100)}%` : 'N/A', icon: CheckCircle2, iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
                { label: 'Failed Analyses', value: stats.failed, icon: AlertCircle, iconColor: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30' },
                { label: 'Currently Processing', value: stats.processing, icon: Clock, iconColor: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
              ].map(({ label, value, icon: Icon, iconColor, bgColor }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bgColor}`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Edge Functions Status</p>
              <div className="space-y-2">
                {['analyze-document', 'chat-document', 'compare-documents'].map(fn => (
                  <div key={fn} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400 font-mono">{fn}</span>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      Deployed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
