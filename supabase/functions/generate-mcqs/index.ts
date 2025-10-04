// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: any) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}

	try {
		if (req.method !== "POST") {
			return json(405, { error: "Method not allowed. Use POST." });
		}

		// 0) Env validation
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

		console.log("SUPABASE_URL:", supabaseUrl);
		console.log("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey);
		console.log("LOVABLE_API_KEY:", lovableApiKey);

		if (!supabaseUrl) return json(500, { error: "Missing SUPABASE_URL" });
		if (!supabaseKey)
			return json(500, { error: "Missing SUPABASE_SERVICE_ROLE_KEY" });
		if (!lovableApiKey) return json(500, { error: "Missing LOVABLE_API_KEY" });

		const supabase = createClient(supabaseUrl, supabaseKey);

		// 1) Input validation
		let body: any;
		try {
			body = await req.json();
		} catch {
			return json(400, { error: "Invalid JSON body" });
		}
		const { studySetId } = body ?? {};
		if (!studySetId) {
			return json(400, { error: "studySetId is required" });
		}

		console.log("Generate MCQs request for study set:", studySetId);

		// 2) Fetch study set
		const { data: studySet, error: fetchError } = await supabase
			.from("study_sets")
			.select("*")
			.eq("id", studySetId)
			.single();

		if (fetchError) {
			console.error("Supabase fetchError:", fetchError);
			return json(404, { error: "Study set not found" });
		}
		if (!studySet?.text) {
			return json(400, { error: "Study set has no text" });
		}

		const config = studySet.config ?? {};
		const text: string = studySet.text as string;

		// 3) Chunk (with hard truncation so prompts don't explode)
		const words = text.split(/\s+/);
		const chunkSize = 1000;
		const overlap = 200;
		const chunks: string[] = [];
		for (let i = 0; i < words.length; i += chunkSize - overlap) {
			chunks.push(words.slice(i, i + chunkSize).join(" "));
			if (chunks.length >= 6) break; // cap total chunks to keep context manageable
		}
		console.log("Created chunks:", chunks.length);

		// Cap context to ~12k chars
		const context = chunks.slice(0, 3).join("\n\n").slice(0, 12000);

		// 4) Call LLM in batches (defensive: 1–3 per call)
		const targetCount = Math.max(1, Math.min(50, Number(config.mcqCount) || 5));
		const questionsPerCall = Math.min(3, targetCount);
		const mcqs: any[] = [];

		// IMPORTANT: verify the model id your gateway supports.
		// If 2.5 isn’t available, try "google/gemini-1.5-flash".
		const model = "deepseek/deepseek-chat-v3.1:free";
		// const model =
		// 	Deno.env.get("LOVABLE_MODEL")?.trim() || "google/gemini-1.5-flash";

		console.log("MODEL: ", model);

		for (
			let produced = 0;
			produced < targetCount;
			produced += questionsPerCall
		) {
			const batchSize = Math.min(questionsPerCall, targetCount - produced);

			const systemPrompt =
				"You are an assessment designer. Generate precise, single-correct multiple-choice questions grounded strictly in the provided source text. Use British English. Never hallucinate. Each MCQ must have exactly 4 options (A, B, C, D) with exactly one correct answer.";

			const topics =
				Array.isArray(config.topics) && config.topics.length
					? `Topics: ${config.topics.join(", ")}\n`
					: "";

			const userPrompt = `Generate ${batchSize} multiple-choice questions based on this text.

Difficulty: ${config.difficulty ?? "mixed"}
${topics}
Source text:
${context}

For each question, return JSON with this exact structure:
{
  "stem": "Question text (max 35 words)",
  "options": [
    {"label": "A", "text": "Option A text"},
    {"label": "B", "text": "Option B text"},
    {"label": "C", "text": "Option C text"},
    {"label": "D", "text": "Option D text"}
  ],
  "answerKey": "A|B|C|D",
  "solution": "2-4 sentence explanation referencing the source",
  "sources": ["chunk-1"]
}

Return ONLY a JSON array of questions. No prose.`;

			const payload = {
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				temperature: 0.7,
				// Some gateways require explicit JSON response; if supported, uncomment:
				// response_format: { type: "json_object" },
			};

			const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${lovableApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const errText = await res.text().catch(() => "");
				console.error("AI API error:", res.status, errText);
				// Surface exact upstream status to your client to make debugging easier
				return json(502, {
					error: "AI generation failed",
					status: res.status,
					details: errText,
				});
			}

			const data = await res.json().catch((e) => {
				console.error("AI JSON decode error:", e);
				return null;
			});
			if (!data?.choices?.[0]?.message?.content) {
				console.error("AI response missing content:", data);
				return json(502, { error: "AI response missing content", raw: data });
			}

			const content: string = data.choices[0].message.content;
			console.log("AI response (truncated):", content.slice(0, 300));

			try {
				// Be strict: require content to be a pure JSON array
				let parsed: any;
				if (content.trim().startsWith("[")) {
					parsed = JSON.parse(content);
				} else {
					// Fallback: try to extract first JSON array
					const m = content.match(/\[[\s\S]*\]/);
					parsed = m ? JSON.parse(m[0]) : [];
				}
				if (!Array.isArray(parsed))
					throw new Error("Parsed content is not an array");
				mcqs.push(...parsed);
			} catch (e) {
				console.error("JSON parse error:", e);
				// Continue but report partials
			}
		}

		console.log("Generated MCQs:", mcqs.length);

		// 5) Validate
		const validMCQs = mcqs.filter(
			(q) =>
				q &&
				typeof q.stem === "string" &&
				Array.isArray(q.options) &&
				q.options.length === 4 &&
				["A", "B", "C", "D"].includes(q.answerKey) &&
				typeof q.solution === "string",
		);

		console.log("Valid MCQs:", validMCQs.length);

		if (validMCQs.length === 0) {
			return json(422, { error: "No valid MCQs produced by model" });
		}

		// 6) Insert
		const itemsToInsert = validMCQs.map((mcq: any) => ({
			study_set_id: studySetId,
			type: "mcq",
			stem: mcq.stem,
			options: mcq.options, // JSONB column expected
			answer_key: mcq.answerKey,
			solution: mcq.solution,
			difficulty: config.difficulty ?? null,
			sources: mcq.sources ?? [],
		}));

		const { error: insertError } = await supabase
			.from("items")
			.insert(itemsToInsert);
		if (insertError) {
			console.error("Insert error:", insertError);
			// Bubble up the exact DB error for debugging (often RLS or schema mismatch)
			return json(500, { error: "Insert failed", details: insertError });
		}

		return json(200, {
			status: "completed",
			counts: { mcq: validMCQs.length },
		});
	} catch (e) {
		console.error("Generate MCQs error (uncaught):", e);
		const msg = e instanceof Error ? e.message : "Unknown error";
		return json(500, { error: msg });
	}
});
