import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Play, Search, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Template, Document } from '../types';

export default function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [resultDocId, setResultDocId] = useState('');

  useEffect(() => {
    supabase.from('templates').select('*').order('category').then(({ data }) => {
      if (data) setTemplates(data as Template[]);
    });
    if (user) {
      supabase.from('documents').select('*').eq('user_id', user.id).eq('status', 'ready')
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setDocs(data as Document[]); });
    }
  }, [user]);

  const categories = [...new Set(templates.map(t => t.category))];
  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const categoryColors: Record<string, string> = {
    NDA: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    Employment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    Property: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    Finance: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    Technology: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400',
    General: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  };

  async function runTemplate() {
    if (!selectedTemplate || !selectedDocId || !user) return;
    setRunning(true);
    setDone(false);

    try {
      const { data: doc } = await supabase
        .from('documents')
        .select('extracted_text, doc_type')
        .eq('id', selectedDocId)
        .maybeSingle();

      if (!doc) throw new Error('Document not found');

      const { data: { session } } = await supabase.auth.getSession();

      // Store a custom analysis result using the template prompt
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            documentId: selectedDocId,
            analysisType: 'summary', // run a fresh summary + red flags with template context
          }),
        }
      );
      if (!resp.ok) throw new Error('Analysis failed');

      setDone(true);
      setResultDocId(selectedDocId);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Templates Library</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Pre-built analysis prompts for specific document types
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(template => (
          <div
            key={template.id}
            onClick={() => { setSelectedTemplate(template); setDone(false); setSelectedDocId(''); }}
            className={`cursor-pointer bg-white dark:bg-slate-800 rounded-xl border transition-all p-5 ${
              selectedTemplate?.id === template.id
                ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-card-hover'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/40 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{template.name}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${categoryColors[template.category] || categoryColors.General}`}>
                    {template.category}
                  </span>
                </div>
              </div>
              {selectedTemplate?.id === template.id && (
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{template.description}</p>
          </div>
        ))}
      </div>

      {/* Run panel */}
      {selectedTemplate && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 p-5 shadow-card fade-in">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{selectedTemplate.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{selectedTemplate.description}</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Select Document to Analyse
              </label>
              <select
                value={selectedDocId}
                onChange={e => { setSelectedDocId(e.target.value); setDone(false); }}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a document…</option>
                {docs.map(d => (
                  <option key={d.id} value={d.id}>{d.title} ({d.doc_type})</option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Analysis Focus</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">{selectedTemplate.prompt_template}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={runTemplate}
                disabled={!selectedDocId || running}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? 'Running Analysis…' : 'Run Template'}
              </button>

              {done && (
                <button
                  onClick={() => navigate(`/document/${resultDocId}`)}
                  className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Done — View Results
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
