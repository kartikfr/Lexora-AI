import { useState, useEffect } from 'react';
import { GitCompare, Loader2, ArrowRight, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Document } from '../types';
import RiskBadge from '../components/RiskBadge';

type CompareResult = {
  overall_assessment: string;
  more_favourable: string;
  more_favourable_reason: string;
  key_differences: Array<{ area: string; doc1: string; doc2: string; significance: string }>;
  conflicting_clauses: Array<{ clause: string; doc1_position: string; doc2_position: string; conflict_risk: string }>;
  additions_in_doc2: string[];
  removals_in_doc2: string[];
  risk_comparison: { doc1_risk: string; doc2_risk: string; verdict: string };
  recommendation: string;
};

export default function ComparePage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [doc1Id, setDoc1Id] = useState('');
  const [doc2Id, setDoc2Id] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [docInfo, setDocInfo] = useState<{ doc1: { title: string }; doc2: { title: string } } | null>(null);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (user) {
      supabase.from('documents').select('*').eq('user_id', user.id).eq('status', 'ready')
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setDocs(data as Document[]); });
    }
  }, [user]);

  async function compare() {
    if (!doc1Id || !doc2Id || doc1Id === doc2Id) {
      setError('Please select two different documents');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compare-documents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ documentId1: doc1Id, documentId2: doc2Id }),
        }
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
      setDocInfo({ doc1: data.doc1, doc2: data.doc2 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'differences', label: `Differences (${result?.key_differences?.length ?? 0})` },
    { id: 'conflicts', label: `Conflicts (${result?.conflicting_clauses?.length ?? 0})` },
    { id: 'changes', label: 'Changes' },
    { id: 'risk', label: 'Risk' },
  ];

  const significanceColors: Record<string, string> = {
    High: 'text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400',
    Medium: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400',
    Low: 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Compare Documents</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Side-by-side AI analysis of two legal documents
        </p>
      </div>

      {/* Selection */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Document 1</label>
            <select
              value={doc1Id}
              onChange={e => setDoc1Id(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a document…</option>
              {docs.map(d => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-9 h-9 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Document 2</label>
            <select
              value={doc2Id}
              onChange={e => setDoc2Id(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a document…</option>
              {docs.map(d => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-3 py-2 rounded-lg">{error}</div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={compare}
            disabled={loading || !doc1Id || !doc2Id}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
            {loading ? 'Comparing…' : 'Compare Documents'}
          </button>
        </div>

        {docs.length === 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Info className="w-4 h-4 flex-shrink-0" />
            Upload and analyse documents from the Dashboard first.
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 fade-in">
          {/* Section tabs */}
          <div className="flex overflow-x-auto scrollbar-thin gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeSection === s.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* More favourable banner */}
          {result.more_favourable && result.more_favourable !== 'Equal' && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {result.more_favourable} is more favourable
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">{result.more_favourable_reason}</p>
              </div>
            </div>
          )}

          {/* Overview */}
          {activeSection === 'overview' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Overall Assessment</h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.overall_assessment}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Recommendation</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">{result.recommendation}</p>
              </div>
            </div>
          )}

          {/* Differences */}
          {activeSection === 'differences' && (
            <div className="space-y-3">
              {result.key_differences?.map((diff, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{diff.area}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${significanceColors[diff.significance] || 'text-slate-500 bg-slate-100'}`}>
                      {diff.significance}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">{docInfo?.doc1.title || 'Doc 1'}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{diff.doc1}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{docInfo?.doc2.title || 'Doc 2'}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{diff.doc2}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conflicts */}
          {activeSection === 'conflicts' && (
            <div className="space-y-3">
              {result.conflicting_clauses?.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No conflicting clauses detected</p>
                </div>
              ) : (
                result.conflicting_clauses?.map((conflict, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{conflict.clause}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Doc 1 Position</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{conflict.doc1_position}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Doc 2 Position</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{conflict.doc2_position}</p>
                      </div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400">{conflict.conflict_risk}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Changes */}
          {activeSection === 'changes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full" />
                  Added in Doc 2
                </h4>
                {result.additions_in_doc2?.length === 0 ? (
                  <p className="text-sm text-slate-400">No additions detected</p>
                ) : (
                  <ul className="space-y-1.5">
                    {result.additions_in_doc2?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full" />
                  Removed from Doc 1
                </h4>
                {result.removals_in_doc2?.length === 0 ? (
                  <p className="text-sm text-slate-400">No removals detected</p>
                ) : (
                  <ul className="space-y-1.5">
                    {result.removals_in_doc2?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <ArrowRight className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Risk */}
          {activeSection === 'risk' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Risk Comparison</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">{docInfo?.doc1.title || 'Document 1'}</p>
                  <RiskBadge level={result.risk_comparison.doc1_risk} />
                </div>
                <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">{docInfo?.doc2.title || 'Document 2'}</p>
                  <RiskBadge level={result.risk_comparison.doc2_risk} />
                </div>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{result.risk_comparison.verdict}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
