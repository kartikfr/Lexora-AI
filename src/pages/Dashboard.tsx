import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, AlertTriangle, Clock, TrendingUp, ArrowRight,
  Trash2, MoreVertical, Search, Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Document, RiskLevel } from '../types';
import UploadZone from '../components/UploadZone';
import RiskBadge from '../components/RiskBadge';
import { SkeletonCard } from '../components/Skeleton';
import { formatFileSize } from '../lib/pdf';
import { formatDistanceToNow } from 'date-fns';

type DocWithRisk = Document & { risk_level?: RiskLevel; red_flag_count?: number };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocWithRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  async function loadDocs() {
    if (!user) return;
    setLoading(true);

    // Fetch documents
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!documents?.length) {
      setDocs([]);
      setLoading(false);
      return;
    }

    const docIds = documents.map(d => d.id);

    // Batch-fetch all relevant analyses in one query instead of N×2 queries
    const { data: allAnalyses } = await supabase
      .from('analyses')
      .select('document_id, analysis_type, result_json')
      .in('document_id', docIds)
      .in('analysis_type', ['summary', 'red_flags']);

    const enriched: DocWithRisk[] = documents.map(doc => {
      const summary = allAnalyses?.find(
        a => a.document_id === doc.id && a.analysis_type === 'summary'
      );
      const redFlags = allAnalyses?.find(
        a => a.document_id === doc.id && a.analysis_type === 'red_flags'
      );
      const riskLevel = (summary?.result_json as { risk_level?: RiskLevel } | null)?.risk_level;
      const flags = (redFlags?.result_json as { red_flags?: unknown[] } | null)?.red_flags;
      return {
        ...doc,
        risk_level: riskLevel,
        red_flag_count: flags?.length,
      } as DocWithRisk;
    });

    setDocs(enriched);
    setLoading(false);
  }

  useEffect(() => { loadDocs(); }, [user]);

  // Close context menu on outside click
  useEffect(() => {
    function close() { setMenuOpen(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  async function deleteDoc(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this document and all its analyses?')) return;
    await supabase.from('documents').delete().eq('id', id);
    setDocs(d => d.filter(doc => doc.id !== id));
    setMenuOpen(null);
  }

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.doc_type.toLowerCase().includes(search.toLowerCase())
  );

  const totalRedFlags = docs.reduce((s, d) => s + (d.red_flag_count || 0), 0);
  const highRiskCount = docs.filter(d => d.risk_level === 'Critical' || d.risk_level === 'High').length;
  const processingCount = docs.filter(d => d.status === 'processing').length;

  const docTypeBadge: Record<string, string> = {
    'Contract/Agreement': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    'Court Judgment': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    'Legislation/Act': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    'FIR/Police Document': 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
    'MOU': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    'Employment Agreement': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400',
    'Property Document': 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
    'IP Agreement': 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    'Compliance Document': 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
    'Tender/Procurement': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
  };

  return (
    <div className="p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 hidden sm:block">
            AI-powered legal document intelligence
          </p>
        </div>
        <button
          onClick={() => setShowUpload(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all shadow-sm"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload PDF</span>
          <span className="sm:hidden">Upload</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Analysed', value: docs.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Red Flags', value: totalRedFlags, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          { label: 'High Risk', value: highRiskCount, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
          { label: 'Processing', value: processingCount, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-card"
          >
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Upload zone — collapsible */}
      {(showUpload || docs.length === 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-card">
          {docs.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Upload Document</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Collapse
              </button>
            </div>
          )}
          <UploadZone
            onComplete={(id) => {
              setShowUpload(false);
              loadDocs();
              navigate(`/document/${id}`);
            }}
          />
        </div>
      )}

      {/* Documents */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm flex-1">
            Recent Documents
            {!loading && (
              <span className="ml-2 text-xs font-normal text-slate-400">({filtered.length})</span>
            )}
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-40 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-slate-300 dark:text-slate-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {search ? 'No documents match your search' : 'No documents yet'}
            </p>
            {!search && (
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                Upload a legal PDF to get started
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/document/${doc.id}`)}
              >
                {/* Icon */}
                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4.5 h-4.5 text-blue-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 dark:text-white text-sm truncate max-w-[240px]">
                      {doc.title}
                    </p>
                    {doc.doc_type && doc.doc_type !== 'Processing…' && doc.doc_type !== 'Unknown' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${docTypeBadge[doc.doc_type] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {doc.doc_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-xs text-slate-200 dark:text-slate-700">·</span>
                    <span className="text-xs text-slate-400">{formatFileSize(doc.file_size)}</span>
                    <span className="text-xs text-slate-200 dark:text-slate-700">·</span>
                    <span className="text-xs text-slate-400">{doc.page_count}pp</span>
                    {!!doc.red_flag_count && (
                      <>
                        <span className="text-xs text-slate-200 dark:text-slate-700">·</span>
                        <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                          {doc.red_flag_count} flags
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.status === 'processing' ? (
                    <span className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-lg animate-pulse font-medium">
                      Processing…
                    </span>
                  ) : doc.status === 'failed' ? (
                    <span className="text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-lg font-medium">
                      Failed
                    </span>
                  ) : doc.risk_level ? (
                    <RiskBadge level={doc.risk_level} size="sm" />
                  ) : null}

                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />

                  {/* Context menu */}
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === doc.id ? null : doc.id); }}
                      className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === doc.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-10 py-1">
                        <button
                          onClick={(e) => deleteDoc(doc.id, e)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
