import React, { useState } from 'react';
import {
  SummaryResult, RedFlagsResult, ObligationsResult, TimelineResult,
  ClausesResult, MissingClausesResult, GlossaryResult, RiskScoreResult,
  AnalysisType, ANALYSIS_LABELS,
} from '../types';
import RiskBadge from './RiskBadge';
import SkeletonBlock from './Skeleton';
import {
  FileText, AlertTriangle, Users, Calendar, List,
  CheckSquare, BookOpen, BarChart3, ChevronDown, ChevronUp,
  Search, AlertCircle,
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

type Props = {
  type: AnalysisType;
  data: Record<string, unknown> | null;
  loading: boolean;
};

const TAB_ICONS: Record<AnalysisType, React.ElementType> = {
  summary: FileText,
  red_flags: AlertTriangle,
  obligations: Users,
  timeline: Calendar,
  clauses: List,
  missing_clauses: CheckSquare,
  glossary: BookOpen,
  risk_score: BarChart3,
};

export function AnalysisTabBar({
  active,
  onChange,
  loadingTabs,
  doneTabs,
  analyses,
}: {
  active: AnalysisType;
  onChange: (t: AnalysisType) => void;
  loadingTabs: Set<AnalysisType>;
  doneTabs: Set<AnalysisType>;
  analyses?: Record<AnalysisType, Record<string, unknown> | null>;
}) {
  const types = Object.keys(ANALYSIS_LABELS) as AnalysisType[];

  function getBadge(t: AnalysisType): string | null {
    if (!analyses?.[t]) return null;
    if (t === 'red_flags') {
      const count = (analyses[t] as { red_flags?: unknown[] })?.red_flags?.length;
      return count ? String(count) : null;
    }
    if (t === 'missing_clauses') {
      const count = (analyses[t] as { missing_clauses?: unknown[] })?.missing_clauses?.length;
      return count ? String(count) : null;
    }
    return null;
  }

  return (
    <div className="flex overflow-x-auto scrollbar-thin border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
      {types.map(t => {
        const Icon = TAB_ICONS[t];
        const isActive = active === t;
        const isLoading = loadingTabs.has(t);
        const badge = getBadge(t);
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`relative flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
              isActive
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {ANALYSIS_LABELS[t]}
            {isLoading ? (
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />
            ) : badge ? (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none ${
                t === 'red_flags'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
              }`}>
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function AnalysisTab({ type, data, loading }: Props) {
  if (loading) {
    return (
      <div className="p-5 space-y-4 animate-pulse">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <SkeletonBlock lines={5} />
        <SkeletonBlock lines={4} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Analysis not available yet</p>
      </div>
    );
  }

  switch (type) {
    case 'summary': return <SummaryTab data={data as unknown as SummaryResult} />;
    case 'red_flags': return <RedFlagsTab data={data as unknown as RedFlagsResult} />;
    case 'obligations': return <ObligationsTab data={data as unknown as ObligationsResult} />;
    case 'timeline': return <TimelineTab data={data as unknown as TimelineResult} />;
    case 'clauses': return <ClausesTab data={data as unknown as ClausesResult} />;
    case 'missing_clauses': return <MissingClausesTab data={data as unknown as MissingClausesResult} />;
    case 'glossary': return <GlossaryTab data={data as unknown as GlossaryResult} />;
    case 'risk_score': return <RiskScoreTab data={data as unknown as RiskScoreResult} />;
    default: return null;
  }
}

function SummaryTab({ data }: { data: SummaryResult }) {
  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">Executive Summary</h3>
        {data.risk_level && <RiskBadge level={data.risk_level} />}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {data.summary}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Document Type</p>
          <span className="inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-sm px-3 py-1 rounded-lg">
            {data.doc_type}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Parties Involved</p>
          <div className="flex flex-wrap gap-1.5">
            {data.parties?.map(p => (
              <span key={p} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md">{p}</span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Key Points</p>
        <div className="space-y-2">
          {data.key_points?.map((pt, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <span className="w-5 h-5 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 rounded-full text-xs flex items-center justify-center flex-shrink-0 font-semibold">{i + 1}</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{pt}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RedFlagsTab({ data }: { data: RedFlagsResult }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...(data.red_flags || [])].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  return (
    <div className="p-5 space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Red Flags</h3>
        <span className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md font-medium">
          {sorted.length} found
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <CheckSquare className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <p className="text-sm">No significant red flags detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((flag, i) => (
            <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <RiskBadge level={flag.severity} size="sm" />
                <p className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{flag.issue}</p>
                {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
              </button>
              {expanded === i && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Problematic Clause</p>
                    <blockquote className="text-sm text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/20 border-l-[3px] border-amber-400 pl-3 py-2 rounded-r-lg italic">
                      "{flag.clause_text}"
                    </blockquote>
                  </div>
                  {flag.page_hint && (
                    <p className="text-xs text-slate-400">Section: {flag.page_hint}</p>
                  )}
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Recommendation</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{flag.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObligationsTab({ data }: { data: ObligationsResult }) {
  const obligations = data.obligations || [];
  const grouped: Record<string, typeof obligations> = {};
  for (const ob of obligations) {
    (grouped[ob.party] = grouped[ob.party] || []).push(ob);
  }
  const typeColors: Record<string, string> = {
    SHALL: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    MAY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    'MUST NOT': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  };
  return (
    <div className="p-5 space-y-5 fade-in">
      <h3 className="font-semibold text-slate-900 dark:text-white">Obligations & Rights</h3>
      {obligations.length === 0 ? (
        <div className="text-center py-10">
          <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No obligations or rights extracted</p>
        </div>
      ) : (
        Object.entries(grouped).map(([party, obs]) => (
          <div key={party}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-slate-400" />
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{party}</h4>
              <span className="text-xs text-slate-400">({obs.length})</span>
            </div>
            <div className="space-y-2">
              {obs.map((ob, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5 ${typeColors[ob.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {ob.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{ob.description}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {ob.clause_reference && <span className="text-xs text-slate-400">{ob.clause_reference}</span>}
                      {ob.is_time_bound && ob.deadline && (
                        <span className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          Due: {ob.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function TimelineTab({ data }: { data: TimelineResult }) {
  return (
    <div className="p-5 fade-in">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-5">Key Dates & Deadlines</h3>
      {!data.events?.length ? (
        <p className="text-sm text-slate-400 text-center py-8">No specific dates or deadlines found</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-5">
            {data.events.map((ev, i) => (
              <div key={i} className="relative fade-in">
                <div className="absolute -left-6 top-1.5 w-4 h-4 bg-white dark:bg-slate-800 border-2 border-blue-500 rounded-full" />
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{ev.event_name}</h4>
                    <span className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-md font-medium flex-shrink-0">
                      {ev.date_or_period}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{ev.description}</p>
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <span className="text-xs text-slate-400">Responsible: {ev.party_responsible}</span>
                    {ev.consequence_if_missed && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">{ev.consequence_if_missed}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClausesTab({ data }: { data: ClausesResult }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const clauses = data.clauses || [];
  const favColors: Record<string, string> = {
    Favourable: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400',
    Neutral: 'text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-400',
    Unfavourable: 'text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400',
  };
  const standardColors: Record<string, string> = {
    Standard: 'text-slate-500',
    Unusual: 'text-amber-600 dark:text-amber-400',
    Missing: 'text-red-500',
  };
  return (
    <div className="p-5 space-y-3 fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Clause Breakdown</h3>
        {clauses.length > 0 && (
          <span className="text-xs text-slate-400">{clauses.length} clauses</span>
        )}
      </div>
      {clauses.length === 0 ? (
        <div className="text-center py-10">
          <List className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No clauses extracted</p>
        </div>
      ) : (
        clauses.map((cl, i) => (
          <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
              <span className="text-xs font-mono text-slate-400 w-8 flex-shrink-0">{cl.number}</span>
              <p className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">{cl.title}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${standardColors[cl.standard_or_unusual] || 'text-slate-500'}`}>
                  {cl.standard_or_unusual}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${favColors[cl.favourability] || 'text-slate-500 bg-slate-100'}`}>
                  {cl.favourability}
                </span>
                {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {expanded === i && (
              <div className="px-4 pb-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400">{cl.summary}</p>
                {cl.page_hint && <p className="text-xs text-slate-400 mt-1">Section: {cl.page_hint}</p>}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function MissingClausesTab({ data }: { data: MissingClausesResult }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="p-5 space-y-3 fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Missing Clauses</h3>
        <span className="text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-md font-medium">
          {data.missing_clauses?.length ?? 0} missing
        </span>
      </div>
      {!data.missing_clauses?.length ? (
        <div className="text-center py-8">
          <CheckSquare className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">All standard clauses appear to be present</p>
        </div>
      ) : (
        data.missing_clauses.map((mc, i) => (
          <div key={i} className="border border-red-200 dark:border-red-800/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors text-left"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">{mc.clause_name}</p>
              {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expanded === i && (
              <div className="px-4 pb-4 space-y-3 border-t border-red-100 dark:border-red-900/30 pt-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Why Important</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{mc.why_important}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Risk if Absent</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{mc.risk_if_absent}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Suggested Language</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 italic">{mc.suggested_language}</p>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function GlossaryTab({ data }: { data: GlossaryResult }) {
  const [search, setSearch] = useState('');
  const filtered = data.terms?.filter(t =>
    t.term.toLowerCase().includes(search.toLowerCase()) ||
    t.plain_english.toLowerCase().includes(search.toLowerCase())
  ) || [];
  return (
    <div className="p-5 space-y-4 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">Defined Terms Glossary</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search terms…"
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
          />
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map((term, i) => (
          <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-blue-700 dark:text-blue-400">{term.term}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-1">"{term.definition_in_doc}"</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{term.plain_english}</p>
          </div>
        ))}
        {!filtered.length && (
          <p className="text-sm text-slate-400 text-center py-6">
            {search ? 'No matching terms' : 'No defined terms extracted'}
          </p>
        )}
      </div>
    </div>
  );
}

function RiskScoreTab({ data }: { data: RiskScoreResult }) {
  const radarData = data.scores?.map(s => ({
    subject: s.dimension.replace(' / ', '/').replace(' Risk', '').replace('Enforceability ', 'Enforce.').slice(0, 12),
    score: s.score,
    fullMark: 10,
  })) || [];

  const overallColor =
    data.overall_score >= 8 ? 'text-rose-700' :
    data.overall_score >= 6 ? 'text-red-600' :
    data.overall_score >= 4 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Risk Scorecard</h3>
        <div className="text-right">
          <span className={`text-3xl font-bold ${overallColor}`}>{data.overall_score?.toFixed(1)}</span>
          <span className="text-slate-400 text-sm">/10</span>
        </div>
      </div>

      {radarData.length > 0 && (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Radar name="Risk" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip formatter={(v) => [`${v}/10`, 'Risk Score']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.verdict && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {data.verdict}
        </div>
      )}

      <div className="space-y-2">
        {data.scores?.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.dimension}</p>
                <span className={`text-sm font-bold flex-shrink-0 ${s.score >= 7 ? 'text-red-600' : s.score >= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {s.score}/10
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-2">
                <div
                  className={`h-full rounded-full ${s.score >= 7 ? 'bg-red-500' : s.score >= 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${s.score * 10}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

