import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, RefreshCw, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage } from '../types';

const STARTER_QUESTIONS = [
  'What are my termination rights?',
  'Summarize the payment terms',
  'What happens if there is a breach?',
  'Is this contract enforceable in India?',
  'What are the indemnity obligations?',
  'List all deadlines I need to track',
];

type Props = { documentId: string };

export default function ChatPanel({ documentId }: Props) {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSession();
  }, [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  async function loadSession() {
    if (!user) return;
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setSessionId(existing.id);
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', existing.id)
        .order('created_at', { ascending: true });
      if (msgs) setMessages(msgs as ChatMessage[]);
    }
  }

  async function sendMessage(question: string) {
    if (!question.trim() || streaming || !user) return;
    setInput('');
    setStreaming(true);
    setStreamingText('');

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId || '',
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            sessionId,
            documentId,
            userId: user.id,
            question,
            history,
          }),
        }
      );

      const newSessionId = resp.headers.get('X-Session-Id');
      if (newSessionId && !sessionId) setSessionId(newSessionId);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') break;
            try {
              const { text } = JSON.parse(payload);
              fullText += text;
              setStreamingText(fullText);
            } catch {}
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: sessionId || newSessionId || '',
        role: 'assistant',
        content: fullText,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingText('');
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        session_id: sessionId || '',
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function resetSession() {
    if (!user) return;
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ document_id: documentId, user_id: user.id })
      .select()
      .single();
    if (data) {
      setSessionId(data.id);
      setMessages([]);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-slate-900 dark:text-white">Chat with Document</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={resetSession}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
              Ask anything about this document
            </p>
            <div className="grid grid-cols-1 gap-2">
              {STARTER_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-3 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-card'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-card">
              {streamingText ? (
                <span className="whitespace-pre-wrap">{streamingText}<span className="chat-cursor" /></span>
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analysing…
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-end gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this document…"
            disabled={streaming}
            className="flex-1 resize-none text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none placeholder-slate-400 py-1 max-h-32 scrollbar-thin"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
          >
            {streaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
