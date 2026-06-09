import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

function truncate(text: string, max = 20000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n\n[... document truncated ...]";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { sessionId, documentId, userId, question, history } = await req.json();

    // Verify the requesting user is authenticated
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch document text and verify ownership
    const { data: doc } = await supabase
      .from("documents")
      .select("extracted_text, title, doc_type, jurisdiction, governing_law, user_id")
      .eq("id", documentId)
      .maybeSingle();

    if (!doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (doc.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure session exists
    let resolvedSessionId = sessionId;
    if (!resolvedSessionId) {
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({ document_id: documentId, user_id: userId })
        .select()
        .single();
      resolvedSessionId = newSession?.id;
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      session_id: resolvedSessionId,
      role: "user",
      content: question,
    });

    const systemPrompt = `You are LexParse, an expert AI legal assistant. You are analyzing the following legal document:

Title: ${doc.title}
Type: ${doc.doc_type}
Jurisdiction: ${doc.jurisdiction || "Not specified"}
Governing Law: ${doc.governing_law || "Not specified"}

FULL DOCUMENT TEXT:
${truncate(doc.extracted_text)}

---
Answer the user's questions about this document. Be precise, cite specific clauses when relevant, and always provide practical legal insight. If a question cannot be answered from the document, say so clearly. Format your responses with clear structure using markdown when helpful.`;

    const messages = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: question },
    ];

    // Stream response
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();

        // Save assistant message after streaming
        EdgeRuntime.waitUntil(
          supabase.from("chat_messages").insert({
            session_id: resolvedSessionId,
            role: "assistant",
            content: fullResponse,
          })
        );
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Session-Id": resolvedSessionId,
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
