import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

function truncate(text: string, max = 16000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n\n[... truncated ...]";
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

    const { documentId1, documentId2 } = await req.json();

    // Verify the requesting user is authenticated and owns both documents
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

    const [{ data: doc1 }, { data: doc2 }] = await Promise.all([
      supabase.from("documents").select("*").eq("id", documentId1).maybeSingle(),
      supabase.from("documents").select("*").eq("id", documentId2).maybeSingle(),
    ]);

    if (!doc1 || !doc2) {
      return new Response(JSON.stringify({ error: "One or both documents not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (doc1.user_id !== user.id || doc2.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a senior legal analyst. Compare these two legal documents thoroughly.

DOCUMENT 1: "${doc1.title}" (${doc1.doc_type})
${truncate(doc1.extracted_text)}

---

DOCUMENT 2: "${doc2.title}" (${doc2.doc_type})
${truncate(doc2.extracted_text)}

---

Return ONLY valid JSON in this exact structure:
{
  "overall_assessment": "paragraph comparing the two documents",
  "more_favourable": "Document 1|Document 2|Equal",
  "more_favourable_reason": "why one is more favourable",
  "key_differences": [
    { "area": "area name", "doc1": "what doc1 says", "doc2": "what doc2 says", "significance": "Low|Medium|High" }
  ],
  "conflicting_clauses": [
    { "clause": "clause topic", "doc1_position": "doc1 stance", "doc2_position": "doc2 stance", "conflict_risk": "explanation" }
  ],
  "additions_in_doc2": ["list of clauses/terms added in doc2 vs doc1"],
  "removals_in_doc2": ["list of clauses/terms removed in doc2 vs doc1"],
  "risk_comparison": { "doc1_risk": "Low|Medium|High|Critical", "doc2_risk": "Low|Medium|High|Critical", "verdict": "explanation" },
  "recommendation": "final recommendation paragraph"
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
    const result = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(text);

    return new Response(JSON.stringify({ result, doc1: { id: doc1.id, title: doc1.title, doc_type: doc1.doc_type }, doc2: { id: doc2.id, title: doc2.title, doc_type: doc2.doc_type } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Compare error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
