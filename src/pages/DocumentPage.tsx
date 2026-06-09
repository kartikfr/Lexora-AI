import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, RefreshCw, FileText, Loader2,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MessageSquare,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Document as DocType, Analysis, AnalysisType } from '../types';
import AnalysisTab, { AnalysisTabBar } from '../components/AnalysisTabs';
import ChatPanel from '../components/ChatPanel';
import { Breadcrumb } from '../components/Layout';
import RiskBadge from '../components/RiskBadge';
import { formatFileSize } from '../lib/pdf';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const ANALYSIS_TYPES: AnalysisType[] = [
  'summary', 'red_flags', 'obligations', 'timeline',
  'clauses', 'missing_clauses', 'glossary', 'risk_score',
];

const POLL_INTERVAL_MS = 3000;

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocType | null>(null);
  const [analyses, setAnalyses] = useState<Record<AnalysisType, Record<string, unknown> | null>>(
    {} as Record<AnalysisType, Record<string, unknown> | null>
  );
  const [loadingTabs, setLoadingTabs] = useState<Set<AnalysisType>>(new Set(ANALYSIS_TYPES));
  const [doneTabs, setDoneTabs] = useState<Set<AnalysisType>>(new Set());
  const [activeTab, setActiveTab] = useState<AnalysisType>('summary');
  const [showChat, setShowChat] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PDF viewer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);

  const loadAnalyses = useCallback(async (docId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('analyses')
      .select('*')
      .eq('document_id', docId);

    // Build a fresh result from DB data — no stale state spread
    const result = {} as Record<AnalysisType, Record<string, unknown> | null>;
    const done = new Set<AnalysisType>();

    for (const type of ANALYSIS_TYPES) {
      const found = data?.find((a: Analysis) => a.analysis_type === type);
      if (found) {
        result[type] = found.result_json as Record<string, unknown>;
        done.add(type);
      } else {
        result[type] = null;
      }
    }

    setAnalyses(result);
    setDoneTabs(done);
    setLoadingTabs(new Set(ANALYSIS_TYPES.filter(t => !done.has(t))));

    return done.size === ANALYSIS_TYPES.length;
  }, []);

  const loadDocument = useCallback(async (docId: string) => {
    const { data } = await supabase.from('documents').select('*').eq('id', docId).maybeSingle();
    if (data) setDoc(data as DocType);
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(docId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const allDone = await loadAnalyses(docId);
      await loadDocument(docId);
      if (allDone) stopPolling();
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    if (!id) return;
    loadDocument(id);
    loadAnalyses(id).then(allDone => {
      if (!allDone) startPolling(id);
    });
    return stopPolling;
  }, [id]);

  useEffect(() => {
    if (doc?.file_url && !pdfDoc) loadPdf(doc.file_url);
  }, [doc?.file_url]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage);
  }, [pdfDoc, currentPage, scale]);

  async function loadPdf(url: string) {
    setPdfLoading(true);
    setPdfError('');
    try {
      const pdf = await pdfjs.getDocument(url).promise;
      setPdfDoc(pdf);
    } catch {
      setPdfError('Could not render PDF preview. You can still view the analysis results.');
    } finally {
      setPdfLoading(false);
    }
  }

  async function renderPage(pageNum: number) {
    if (!pdfDoc || !canvasRef.current) return;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
    }
  }

  async function rerunAnalysis() {
    if (!id) return;
    setRerunning(true);
    stopPolling();
    setLoadingTabs(new Set(ANALYSIS_TYPES));
    setDoneTabs(new Set());
    await supabase.from('documents').update({ status: 'processing' }).eq('id', id);
    const { data: { session } } = await supabase.auth.getSession();
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ documentId: id }),
    }).finally(() => setRerunning(false));
    // Start polling immediately so results appear as each module finishes
    startPolling(id);
  }

  const summaryResult = analyses.summary as { risk_level?: string } | null;
  const riskLevel = summaryResult?.risk_level;
  const allDone = doneTabs.size === ANALYSIS_TYPES.length;
  const analysisCount = doneTabs.size;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 min-w-0">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <Breadcrumb items={[{ label: 'Dashboard', to: '/' }, { label: doc?.title || 'Document' }]} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Analysis progress */}
          {!allDone ? (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin" />
              {analysisCount}/{ANALYSIS_TYPES.length} modules
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3 h-3" />
              Analysis complete
            </div>
          )}

          {riskLevel && <RiskBadge level={riskLevel} size="sm" />}

          <button
            onClick={rerunAnalysis}
            disabled={rerunning}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
            title="Re-run all analyses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rerunning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Re-analyse</span>
          </button>

          {doc?.file_url && (
            <a
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View PDF</span>
            </a>
          )}

          <button
            onClick={() => setShowChat(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${
              showChat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* PDF viewer — hidden on small screens */}
        <div className="hidden lg:flex w-[360px] xl:w-[400px] flex-shrink-0 flex-col border-r border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-950">
          {/* PDF toolbar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[72px] text-center tabular-nums">
              {currentPage} / {pdfDoc?.numPages ?? doc?.page_count ?? '—'}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(pdfDoc?.numPages ?? 999, p + 1))}
              disabled={!pdfDoc || currentPage >= pdfDoc.numPages}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-slate-400 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto scrollbar-thin flex flex-col items-center py-4 px-3 gap-4">
            {pdfLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin" />
                <p className="text-xs">Loading PDF…</p>
              </div>
            )}
            {pdfError && !pdfLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 p-6 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                <p className="text-xs leading-relaxed">{pdfError}</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="shadow-xl rounded max-w-full"
              style={{ display: pdfDoc && !pdfError ? 'block' : 'none' }}
            />
          </div>

          {/* Doc meta strip */}
          {doc && (
            <div className="px-3 py-2 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1">{doc.title}</p>
              <span className="text-xs text-slate-400 flex-shrink-0">{formatFileSize(doc.file_size)}</span>
            </div>
          )}
        </div>

        {/* Analysis panel */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${showChat ? 'hidden xl:flex' : 'flex'}`}>
          <AnalysisTabBar
            active={activeTab}
            onChange={setActiveTab}
            loadingTabs={loadingTabs}
            doneTabs={doneTabs}
            analyses={analyses}
          />
          <div className="flex-1 overflow-y-auto scrollbar-thin bg-white dark:bg-slate-800">
            <AnalysisTab
              type={activeTab}
              data={analyses[activeTab]}
              loading={loadingTabs.has(activeTab)}
            />
          </div>
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="w-full xl:w-[380px] flex-shrink-0 border-l border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800 overflow-hidden">
            <ChatPanel documentId={id!} />
          </div>
        )}
      </div>
    </div>
  );
}
