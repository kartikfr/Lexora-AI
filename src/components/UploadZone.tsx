import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromPDF, formatFileSize } from '../lib/pdf';

type UploadState = 'idle' | 'extracting' | 'uploading' | 'analyzing' | 'done' | 'error';

type Props = {
  onComplete?: (documentId: string) => void;
  compact?: boolean;
};

export default function UploadZone({ onComplete, compact = false }: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const pdf = accepted[0];
    if (!pdf || !user) return;
    setFile(pdf);
    setError('');

    try {
      // Step 1 — Extract text
      setState('extracting');
      setProgress('Extracting text from PDF…');
      const { text, pageCount, usedOCR } = await extractTextFromPDF(pdf);
      if (usedOCR) setProgress('Scanned PDF detected, using OCR fallback…');

      // Step 2 — Upload file to Supabase Storage
      setState('uploading');
      setProgress('Uploading document…');
      const filePath = `${user.id}/${Date.now()}_${pdf.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('legal-documents')
        .upload(filePath, pdf);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('legal-documents')
        .getPublicUrl(filePath);

      // Step 3 — Insert document record
      const title = pdf.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title,
          file_url: urlData.publicUrl,
          file_size: pdf.size,
          page_count: pageCount,
          doc_type: 'Processing…',
          status: 'processing',
          extracted_text: text,
          jurisdiction: '',
          governing_law: '',
        })
        .select()
        .single();
      if (docErr) throw docErr;

      // Step 4 — Trigger analysis
      setState('analyzing');
      setProgress('Running AI analysis (this takes ~30 seconds)…');
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ documentId: doc.id }),
        }
      );
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Analysis failed');
      }

      setState('done');
      setProgress('Analysis complete!');
      onComplete?.(doc.id);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [user, onComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 52428800,
    disabled: state !== 'idle' && state !== 'error' && state !== 'done',
  });

  function reset() {
    setState('idle');
    setProgress('');
    setError('');
    setFile(null);
  }

  const isProcessing = state === 'extracting' || state === 'uploading' || state === 'analyzing';

  if (compact && state === 'idle') {
    return (
      <div
        {...getRootProps()}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-all text-sm font-medium"
      >
        <input {...getInputProps()} />
        <Upload className="w-4 h-4" />
        Upload PDF
      </div>
    );
  }

  return (
    <div>
      {state === 'idle' || state === 'error' ? (
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
              : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragActive ? 'bg-blue-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Upload className={`w-7 h-7 ${isDragActive ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {isDragActive ? 'Drop your PDF here' : 'Upload a legal document'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Drag & drop or click to browse · PDF up to 50MB · 200 pages
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Contract', 'Judgment', 'FIR', 'MOU', 'Legislation', 'Compliance'].map(t => (
                <span key={t} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md">{t}</span>
              ))}
            </div>
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-sm justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-white dark:bg-slate-800">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${state === 'done' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
              {state === 'done' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <FileText className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">{file?.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{file ? formatFileSize(file.size) : ''}</p>
              <div className="mt-3">
                {isProcessing && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {progress}
                  </div>
                )}
                {state === 'done' && (
                  <p className="text-sm text-emerald-600 font-medium">Analysis complete — redirecting…</p>
                )}
              </div>
              {isProcessing && (
                <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                    style={{
                      width: state === 'extracting' ? '20%' : state === 'uploading' ? '45%' : '80%',
                    }}
                  />
                </div>
              )}
            </div>
            {(state === 'done' || state === 'error') && (
              <button onClick={reset} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
