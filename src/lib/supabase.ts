import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'lawyer' | 'admin' | 'paralegal';
          firm_name: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      documents: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      analyses: {
        Row: {
          id: string;
          document_id: string;
          analysis_type: string;
          result_json: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['analyses']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['analyses']['Insert']>;
      };
      chat_sessions: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_sessions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['chat_sessions']['Insert']>;
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>;
      };
      annotations: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['annotations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['annotations']['Insert']>;
      };
      templates: {
        Row: {
          id: string;
          name: string;
          description: string;
          prompt_template: string;
          category: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['templates']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['templates']['Insert']>;
      };
    };
  };
};
