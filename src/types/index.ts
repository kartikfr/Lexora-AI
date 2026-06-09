export type Profile = {
  id: string;
  name: string;
  email: string;
  role: 'lawyer' | 'admin' | 'paralegal';
  firm_name: string;
  created_at: string;
};

export type Document = {
  id: string;
  user_id: string;
  title: string;
  file_url: string;
  file_size: number;
  page_count: number;
  doc_type: string;
  status: 'processing' | 'ready' | 'failed';
  extracted_text: string;
  jurisdiction: string;
  governing_law: string;
  created_at: string;
};

export type Analysis = {
  id: string;
  document_id: string;
  analysis_type: AnalysisType;
  result_json: AnalysisResult;
  created_at: string;
};

export type AnalysisType =
  | 'summary'
  | 'red_flags'
  | 'obligations'
  | 'timeline'
  | 'clauses'
  | 'missing_clauses'
  | 'glossary'
  | 'risk_score';

export type AnalysisResult =
  | SummaryResult
  | RedFlagsResult
  | ObligationsResult
  | TimelineResult
  | ClausesResult
  | MissingClausesResult
  | GlossaryResult
  | RiskScoreResult;

export type SummaryResult = {
  summary: string;
  doc_type: string;
  parties: string[];
  key_points: string[];
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
};

export type RedFlag = {
  clause_text: string;
  page_hint?: string;
  issue: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendation: string;
};

export type RedFlagsResult = {
  red_flags: RedFlag[];
};

export type Obligation = {
  party: string;
  type: 'SHALL' | 'MAY' | 'MUST NOT';
  description: string;
  clause_reference?: string;
  is_time_bound: boolean;
  deadline?: string;
};

export type ObligationsResult = {
  obligations: Obligation[];
};

export type TimelineEvent = {
  event_name: string;
  date_or_period: string;
  description: string;
  party_responsible: string;
  consequence_if_missed: string;
};

export type TimelineResult = {
  events: TimelineEvent[];
};

export type Clause = {
  number: string;
  title: string;
  summary: string;
  standard_or_unusual: 'Standard' | 'Unusual' | 'Missing';
  favourability: 'Favourable' | 'Neutral' | 'Unfavourable';
  page_hint?: string;
};

export type ClausesResult = {
  clauses: Clause[];
};

export type MissingClause = {
  clause_name: string;
  why_important: string;
  risk_if_absent: string;
  suggested_language: string;
};

export type MissingClausesResult = {
  missing_clauses: MissingClause[];
};

export type Term = {
  term: string;
  definition_in_doc: string;
  plain_english: string;
};

export type GlossaryResult = {
  terms: Term[];
};

export type RiskDimension = {
  dimension: string;
  score: number;
  reason: string;
  worst_clause: string;
};

export type RiskScoreResult = {
  scores: RiskDimension[];
  overall_score: number;
  verdict: string;
};

export type ChatSession = {
  id: string;
  document_id: string;
  user_id: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type Annotation = {
  id: string;
  document_id: string;
  user_id: string;
  page_number: number;
  selected_text: string;
  note: string;
  tag: 'Risk' | 'Query' | 'Important' | 'Action Required';
  color: string;
  created_at: string;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  category: string;
  created_at: string;
};

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export const RISK_COLORS: Record<RiskLevel, string> = {
  Low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-700 bg-amber-50 border-amber-200',
  High: 'text-red-700 bg-red-50 border-red-200',
  Critical: 'text-rose-900 bg-rose-100 border-rose-300',
};

export const RISK_DOT_COLORS: Record<RiskLevel, string> = {
  Low: 'bg-emerald-500',
  Medium: 'bg-amber-500',
  High: 'bg-red-500',
  Critical: 'bg-rose-700',
};

export const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  summary: 'Summary',
  red_flags: 'Red Flags',
  obligations: 'Obligations',
  timeline: 'Timeline',
  clauses: 'Clauses',
  missing_clauses: 'Missing',
  glossary: 'Glossary',
  risk_score: 'Risk Score',
};
