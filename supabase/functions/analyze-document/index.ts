import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

function truncate(text: string, max = 24000): string {
  if (!text || text.length <= max) return text || "";
  return text.slice(0, max) + "\n\n[... document truncated for analysis ...]";
}

async function callClaude(systemPrompt: string, userContent: string): Promise<unknown> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: userContent }],
    system: systemPrompt,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  // Try JSON code block first, then raw JSON object
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/```\s*([\s\S]*?)\s*```/) ||
                    text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch {}
  }
  try { return JSON.parse(text); } catch {}
  // Fallback: return raw text wrapped
  return { raw: text };
}

async function upsertAnalysis(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  type: string,
  result: unknown
): Promise<void> {
  const { data: existing } = await supabase
    .from("analyses")
    .select("id")
    .eq("document_id", documentId)
    .eq("analysis_type", type)
    .maybeSingle();

  if (existing) {
    await supabase.from("analyses").update({ result_json: result }).eq("id", existing.id);
  } else {
    await supabase.from("analyses").insert({ document_id: documentId, analysis_type: type, result_json: result });
  }
}

async function detectDocumentType(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  text: string
): Promise<string> {
  const snippet = truncate(text, 3000);
  const result = await callClaude(
    "You are a legal document classifier. Return ONLY valid JSON, no markdown.",
    `Classify this legal document into exactly one of these types: Contract/Agreement, Court Judgment, Legislation/Act, FIR/Police Document, MOU, Compliance Document, Property Document, Employment Agreement, IP Agreement, Tender/Procurement, Other.

Return JSON: { "type": "...", "confidence": "High|Medium|Low", "jurisdiction": "country or region or Unknown", "governing_law": "governing law or Unknown" }

DOCUMENT START:
${snippet}`
  ) as { type?: string; confidence?: string; jurisdiction?: string; governing_law?: string };

  const docType = result?.type || "Other";
  const jurisdiction = result?.jurisdiction || "";
  const governing_law = result?.governing_law || "";

  await supabase.from("documents").update({ doc_type: docType, jurisdiction, governing_law }).eq("id", documentId);
  return docType;
}

async function runModule(
  type: string,
  documentText: string,
  docType: string,
  supabase: ReturnType<typeof createClient>,
  documentId: string
): Promise<void> {
  const docSnippet = truncate(documentText);
  let systemPrompt = "";
  let userContent = "";

  switch (type) {
    case "summary":
      systemPrompt = "You are a senior lawyer. Return ONLY valid JSON, no markdown prose outside the JSON block.";
      userContent = `Analyse this legal document. Return exactly this JSON structure:
{ "summary": "one paragraph plain-English summary of what this document is about", "doc_type": "document type", "parties": ["party name 1", "party name 2"], "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"], "risk_level": "Low" }

risk_level must be one of: Low, Medium, High, Critical

DOCUMENT:
${docSnippet}`;
      break;

    case "red_flags":
      systemPrompt = "You are a senior lawyer specialising in risk analysis. Return ONLY valid JSON, no prose outside JSON.";
      userContent = `Identify ALL red flags, problematic clauses, one-sided provisions, missing protections, and legally risky language in this document.

Return this JSON:
{ "red_flags": [{ "clause_text": "exact verbatim quote from document", "page_hint": "clause or section reference", "issue": "why this is problematic", "severity": "High", "recommendation": "how to fix or negotiate" }] }

severity must be one of: Low, Medium, High, Critical. Return an empty array if no red flags exist.

DOCUMENT:
${docSnippet}`;
      break;

    case "obligations":
      systemPrompt = "You are a legal analyst. Return ONLY valid JSON.";
      userContent = `Extract every obligation, right, restriction, and permission in this document. Categorise by party.

Return this JSON:
{ "obligations": [{ "party": "Party Name", "type": "SHALL", "description": "what they must do", "clause_reference": "clause 4.1", "is_time_bound": false, "deadline": null }] }

type must be one of: SHALL (mandatory), MAY (optional), MUST NOT (prohibited).

DOCUMENT:
${docSnippet}`;
      break;

    case "timeline":
      systemPrompt = "You are a legal analyst. Return ONLY valid JSON, sorted chronologically.";
      userContent = `Extract every date, deadline, notice period, renewal date, termination trigger, and time-bound obligation from this document.

Return this JSON:
{ "events": [{ "event_name": "descriptive name", "date_or_period": "specific date or period like '30 days'", "description": "what happens", "party_responsible": "party name", "consequence_if_missed": "what happens if missed" }] }

Return an empty array if no dates found.

DOCUMENT:
${docSnippet}`;
      break;

    case "clauses":
      systemPrompt = "You are a legal analyst. Return ONLY valid JSON.";
      userContent = `Break this document into its major clauses or sections.

Return this JSON:
{ "clauses": [{ "number": "1", "title": "Clause Title", "summary": "one sentence plain-English summary", "standard_or_unusual": "Standard", "favourability": "Neutral", "page_hint": "section ref or null" }] }

standard_or_unusual: Standard | Unusual | Missing
favourability: Favourable | Neutral | Unfavourable (from the perspective of the first party named)

DOCUMENT:
${docSnippet}`;
      break;

    case "missing_clauses":
      systemPrompt = "You are a senior legal drafter. Return ONLY valid JSON.";
      userContent = `Based on this ${docType} document, identify what standard legal clauses are MISSING that should typically be present. Check for: limitation of liability, indemnification, dispute resolution, governing law, force majeure, IP ownership, confidentiality, termination for convenience, assignment restrictions, warranties, representations, etc.

Return this JSON:
{ "missing_clauses": [{ "clause_name": "Limitation of Liability", "why_important": "protects parties from unlimited exposure", "risk_if_absent": "unlimited financial exposure", "suggested_language": "brief suggested clause text" }] }

Return empty array if nothing material is missing.

DOCUMENT:
${docSnippet}`;
      break;

    case "glossary":
      systemPrompt = "You are a legal analyst. Return ONLY valid JSON.";
      userContent = `Extract all defined terms from this document — words or phrases that are: in quotation marks, in ALL CAPS, or explicitly defined with "means", "refers to", "shall mean".

Return this JSON:
{ "terms": [{ "term": "DEFINED TERM", "definition_in_doc": "the exact definition as written in the document", "plain_english": "what this means in plain English" }] }

Return empty array if no defined terms exist.

DOCUMENT:
${docSnippet}`;
      break;

    case "risk_score":
      systemPrompt = "You are a senior legal risk analyst. Return ONLY valid JSON.";
      userContent = `Rate this document across exactly these 10 legal risk dimensions on a scale of 1–10 (10 = highest risk).

Return this exact JSON:
{ "scores": [{ "dimension": "Liability Exposure", "score": 5, "reason": "one concise sentence", "worst_clause": "most problematic clause or 'None'" }], "overall_score": 5.0, "verdict": "2-3 sentence overall risk assessment" }

The 10 dimensions must be exactly: Liability Exposure, Termination Risk, Payment/Financial Risk, IP Risk, Confidentiality Risk, Dispute Resolution Weakness, Regulatory Compliance Risk, Enforceability Risk, Ambiguity/Drafting Quality, Missing Protections

DOCUMENT:
${docSnippet}`;
      break;
  }

  const result = await callClaude(systemPrompt, userContent);
  await upsertAnalysis(supabase, documentId, type, result);
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

    const { documentId, analysisType } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the requesting user owns this document
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

    const { data: doc } = await supabase
      .from("documents")
      .select("*")
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

    if (!doc.extracted_text || doc.extracted_text.length < 50) {
      await supabase.from("documents").update({ status: "failed" }).eq("id", documentId);
      return new Response(JSON.stringify({ error: "Document has no extractable text" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect document type first (unless we already have one)
    let docType = doc.doc_type;
    if (!analysisType && (docType === "Processing…" || docType === "Unknown" || !docType)) {
      docType = await detectDocumentType(supabase, documentId, doc.extracted_text);
    }

    const types = analysisType
      ? [analysisType]
      : ["summary", "red_flags", "obligations", "timeline", "clauses", "missing_clauses", "glossary", "risk_score"];

    // Run all analyses in parallel — each upserts its own row as it finishes
    const results = await Promise.allSettled(
      types.map((type) => runModule(type, doc.extracted_text, docType, supabase, documentId))
    );

    const failed = results.filter(r => r.status === "rejected").length;
    const status = failed === types.length ? "failed" : "ready";
    await supabase.from("documents").update({ status }).eq("id", documentId);

    return new Response(JSON.stringify({ success: true, completed: types.length - failed, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Analysis error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
