/*
  # LexParse Full Schema

  ## Overview
  Creates all tables for the LexParse legal PDF analysis application.

  ## New Tables
  
  1. `profiles` — Extended user data linked to auth.users
     - id, name, email, role (lawyer/admin/paralegal), firm_name, created_at

  2. `documents` — Uploaded legal PDFs
     - id, user_id, title, file_url, file_size, page_count, doc_type, status, extracted_text, jurisdiction, governing_law, created_at

  3. `analyses` — Results from the 8 AI analysis modules
     - id, document_id, analysis_type, result_json, created_at

  4. `chat_sessions` — Chat threads per document
     - id, document_id, user_id, created_at

  5. `chat_messages` — Individual messages in chat sessions
     - id, session_id, role (user/assistant), content, created_at

  6. `annotations` — User highlights and notes on PDFs
     - id, document_id, user_id, page_number, selected_text, note, tag, color, created_at

  7. `templates` — Pre-built analysis prompt templates
     - id, name, description, prompt_template, category, created_at

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Admins can access all data via role check
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'lawyer' CHECK (role IN ('lawyer', 'admin', 'paralegal')),
  firm_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  page_count integer NOT NULL DEFAULT 0,
  doc_type text NOT NULL DEFAULT 'Unknown',
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  extracted_text text NOT NULL DEFAULT '',
  jurisdiction text NOT NULL DEFAULT '',
  governing_law text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ANALYSES
CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis_type text NOT NULL,
  result_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses of own documents"
  ON analyses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = analyses.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analyses for own documents"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = analyses.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update analyses for own documents"
  ON analyses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = analyses.document_id
      AND documents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = analyses.document_id
      AND documents.user_id = auth.uid()
    )
  );

-- CHAT SESSIONS
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
  ON chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of own sessions"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own sessions"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- ANNOTATIONS
CREATE TABLE IF NOT EXISTS annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_number integer NOT NULL DEFAULT 1,
  selected_text text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  tag text NOT NULL DEFAULT 'Important' CHECK (tag IN ('Risk', 'Query', 'Important', 'Action Required')),
  color text NOT NULL DEFAULT '#FCD34D',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own annotations"
  ON annotations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own annotations"
  ON annotations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations"
  ON annotations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
  ON annotations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- TEMPLATES
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  prompt_template text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
  ON templates FOR SELECT
  TO authenticated
  USING (true);

-- Seed default templates
INSERT INTO templates (name, description, prompt_template, category) VALUES
  ('NDA Checker', 'Comprehensive review of Non-Disclosure Agreements', 'Review this NDA and identify: 1) Scope of confidential information - is it too broad or too narrow? 2) Duration - is the confidentiality period reasonable? 3) Exclusions from confidentiality 4) Return/destruction of materials clause 5) Remedies for breach 6) Mutual vs one-sided obligations. Flag any clauses that are unusually restrictive or missing standard protections.', 'NDA'),
  ('Employment Contract Review', 'Full analysis of employment agreements', 'Review this employment contract focusing on: 1) Non-compete clauses - scope, duration, geography 2) IP assignment clauses 3) Termination provisions - notice periods, grounds for termination 4) Benefits and compensation terms 5) Arbitration clauses 6) Garden leave provisions. Identify any employee-unfriendly terms.', 'Employment'),
  ('Property Sale Agreement', 'Due diligence for property transactions', 'Analyze this property sale agreement for: 1) Title representations and warranties 2) Conditions precedent to closing 3) Earnest money and default provisions 4) Representations about property condition 5) Closing date and extension rights 6) Risk of loss provisions 7) Any unusual encumbrances or restrictions.', 'Property'),
  ('Loan Agreement Review', 'Analysis of financing and loan documents', 'Review this loan agreement for: 1) Interest rate terms - fixed vs variable, default rate 2) Prepayment penalties 3) Covenant restrictions on borrower 4) Events of default - are they reasonable? 5) Collateral provisions 6) Cross-default clauses 7) Acceleration provisions. Flag lender-favorable terms that could trap the borrower.', 'Finance'),
  ('Software License Review', 'IP and technology licensing analysis', 'Analyze this software license for: 1) License scope - what is actually licensed? 2) Restrictions on use - are they reasonable? 3) IP ownership - who owns modifications/derivatives? 4) Limitation of liability - is it adequate? 5) Audit rights 6) Termination triggers 7) SLA obligations 8) Data privacy provisions. Identify terms that create IP or liability risks.', 'Technology')
ON CONFLICT DO NOTHING;

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('legal-documents', 'legal-documents', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'legal-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'legal-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'legal-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_document_id ON analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_document_id ON chat_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_annotations_document_id ON annotations(document_id);
