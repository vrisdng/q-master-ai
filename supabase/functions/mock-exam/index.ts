import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const MODEL_ID = Deno.env.get("MODEL_ID");

type Role = "guest" | "user" | "admin";

type TestType =
	| "mcq"
	| "fill-in-the-blank"
	| "essay"
	| "matching"
	| "short-answer";

interface GeneratePayload {
	action: "generate";
	documentId: string;
	config: {
		intensity: "light" | "standard" | "intense";
		timerEnabled: boolean;
		requirements: Array<{
			type: TestType;
			count: number;
			targetWordCount?: number;
		}>;
	};
}

interface EvaluatePayload {
	action: "evaluate";
	documentId: string;
	examId: string;
	intensity: "light" | "standard" | "intense";
	questions: MockExamQuestion[];
	responses: Array<{
		questionId: string;
		response: unknown;
	}>;
}

type RequestPayload = GeneratePayload | EvaluatePayload;

interface MockExamQuestionBase {
	id: string;
	type: TestType;
	prompt: string;
	intensity: "light" | "standard" | "intense";
}

interface MCQOption {
	label: string;
	text: string;
}

interface MockExamMCQQuestion extends MockExamQuestionBase {
	type: "mcq";
	options: MCQOption[];
	answerKey: string;
	explanation: string;
}

interface MockExamFillQuestion extends MockExamQuestionBase {
	type: "fill-in-the-blank";
	answer: string;
	explanation: string;
}

interface MockExamMatchingQuestion extends MockExamQuestionBase {
	type: "matching";
	pairs: Array<{ prompt: string; answer: string }>;
	explanation: string;
}

interface MockExamEssayQuestion extends MockExamQuestionBase {
	type: "essay";
	targetWordCount: number;
	idealResponse: string;
	rubric: string[];
}

interface MockExamShortAnswerQuestion extends MockExamQuestionBase {
	type: "short-answer";
	targetWordCount: number;
	keyPoints: string[];
	idealResponse: string;
}

type MockExamQuestion =
	| MockExamMCQQuestion
	| MockExamFillQuestion
	| MockExamMatchingQuestion
	| MockExamEssayQuestion
	| MockExamShortAnswerQuestion;

interface MockExamGenerationResult {
	examId: string;
	documentTitle: string;
	intensity: "light" | "standard" | "intense";
	timer: {
		enabled: boolean;
		suggestedMinutes: number;
	};
	questions: MockExamQuestion[];
}

interface MockExamQuestionScore {
	questionId: string;
	score: number;
	outOf: number;
	isCorrect: boolean | null;
	feedback: string;
	strengths: string[];
	improvements: string[];
}

interface MockExamEvaluationResult {
	examId: string;
	documentTitle: string;
	intensity: "light" | "standard" | "intense";
	overallScore: number;
	details: MockExamQuestionScore[];
	highlights: {
		strengths: string[];
		weakAreas: string[];
		suggestions: string[];
	};
}

type DocumentRow = {
	id: string;
	owner_id: string;
	title: string;
	source_type: string;
	metadata: Record<string, unknown> | null;
};

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});

const getRole = async (
	client: ReturnType<typeof createClient>,
	userId: string,
): Promise<Role> => {
	const { data, error } = await client
		.from("user_roles")
		.select("role")
		.eq("user_id", userId)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle<{ role: Role }>();

	if (error) {
		console.error("Role lookup failed", error);
		return "user";
	}

	return (data?.role ?? "user") as Role;
};

const extractContent = (metadata: Record<string, unknown> | null) => {
	if (!metadata) return "";
	const content = metadata["content"];
	return typeof content === "string" ? content : "";
};

const chunkText = (content: string) => {
	const words = content.split(/\s+/);
	const chunkSize = 900;
	const overlap = 180;
	const chunks: string[] = [];

	for (let i = 0; i < words.length; i += chunkSize - overlap) {
		chunks.push(words.slice(i, i + chunkSize).join(" "));
		if (chunks.length >= 8) break;
	}

	return chunks.join("\n\n").slice(0, 15000);
};

const extractJson = (raw: string) => {
	const trimmed = raw.trim();
	const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = match ? match[1] : trimmed;

	try {
		return JSON.parse(candidate);
	} catch (_) {
		const first = candidate.indexOf("{");
		const last = candidate.lastIndexOf("}");
		if (first >= 0 && last > first) {
			const sliced = candidate.slice(first, last + 1);
			return JSON.parse(sliced);
		}
		throw new Error("Unable to parse JSON from model response");
	}
};

const callModel = async (
	apiKey: string,
	systemPrompt: string,
	userPrompt: string,
	temperature = 0.4,
) => {
	const payload = {
		model: MODEL_ID,
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature,
	};

	const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"X-Title": "q-master-ai-test-mode",
		},
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		console.error("AI request failed", res.status, detail.slice(0, 300));
		throw new Error("AI generation failed");
	}

	const data = await res.json();
	const content: string | undefined = data?.choices?.[0]?.message?.content;

	if (!content) {
		throw new Error("AI response missing content");
	}

	return content;
};

const normalizeRequirementSummary = (
	requirements: GeneratePayload["config"]["requirements"],
) => {
	return requirements
		.map((req) => {
			const base = `${req.count} ${req.type.replace(/-/g, " ")} question${
				req.count === 1 ? "" : "s"
			}`;
			if (
				(req.type === "essay" || req.type === "short-answer") &&
				req.targetWordCount
			) {
				return `${base} targeting ~${req.targetWordCount} words`;
			}
			return base;
		})
		.join("\n- ");
};

const sanitizeQuestions = (
	questions: unknown[],
	intensity: "light" | "standard" | "intense",
): MockExamQuestion[] => {
	const toRecord = (value: unknown): Record<string, unknown> | null =>
		typeof value === "object" && value !== null ? value as Record<string, unknown> : null;

	return questions
		.map((item, index) => {
			const record = toRecord(item);
			if (!record) return null;

			const idValue = record.id;
			const id = typeof idValue === "string" && idValue.trim().length > 0
				? idValue.trim()
				: `Q${index + 1}`;

			const type = record.type as TestType | undefined;
			const promptValue = record.prompt;
			const prompt = typeof promptValue === "string" ? promptValue.trim() : "";

			if (!prompt || !type) return null;

			switch (type) {
				case "mcq": {
					const rawOptions = record.options;
					const options = Array.isArray(rawOptions)
						? rawOptions
								.map((option) => {
									const optionRecord = toRecord(option);
									if (!optionRecord) return null;
									const label = typeof optionRecord.label === "string"
										? optionRecord.label.trim()
										: "";
									const text = typeof optionRecord.text === "string"
										? optionRecord.text.trim()
										: "";
									return label && text ? { label, text } : null;
								})
								.filter((opt): opt is MCQOption => Boolean(opt))
						: [];

					const answerKeyValue = record.answerKey;
					const answerKey = typeof answerKeyValue === "string" ? answerKeyValue.trim() : "";
					const explanationValue = record.explanation;
					const explanation = typeof explanationValue === "string"
						? explanationValue.trim()
						: "";

					if (
						options.length < 4 ||
						!["A", "B", "C", "D"].includes(answerKey) ||
						!explanation
					) {
						return null;
					}

					return {
						id,
						type,
						prompt,
						intensity,
						options,
						answerKey,
						explanation,
					} satisfies MockExamMCQQuestion;
				}
				case "fill-in-the-blank": {
					const answerValue = record.answer;
					const explanationValue = record.explanation;
					const answer = typeof answerValue === "string" ? answerValue.trim() : "";
					const explanation = typeof explanationValue === "string"
						? explanationValue.trim()
						: "";
					if (!answer || !explanation) return null;

					return {
						id,
						type,
						prompt,
						intensity,
						answer,
						explanation,
					} satisfies MockExamFillQuestion;
				}
				case "matching": {
					const rawPairs = record.pairs;
					const pairs = Array.isArray(rawPairs)
						? rawPairs
								.map((pair) => {
									const pairRecord = toRecord(pair);
									if (!pairRecord) return null;
									const promptText = typeof pairRecord.prompt === "string"
										? pairRecord.prompt.trim()
										: "";
									const answerText = typeof pairRecord.answer === "string"
										? pairRecord.answer.trim()
										: "";
									return promptText && answerText
										? { prompt: promptText, answer: answerText }
										: null;
								})
								.filter((pair): pair is { prompt: string; answer: string } => Boolean(pair))
						: [];
					const explanationValue = record.explanation;
					const explanation = typeof explanationValue === "string"
						? explanationValue.trim()
						: "";
					if (pairs.length === 0 || !explanation) return null;

					return {
						id,
						type,
						prompt,
						intensity,
						pairs,
						explanation,
					} satisfies MockExamMatchingQuestion;
				}
				case "essay": {
					const targetWordCount = Number(record.targetWordCount ?? 0);
					const idealResponseValue = record.idealResponse;
					const idealResponse = typeof idealResponseValue === "string"
						? idealResponseValue.trim()
						: "";
					const rawRubric = record.rubric;
					const rubric = Array.isArray(rawRubric)
						? rawRubric
								.map((rule) =>
									typeof rule === "string" ? rule.trim() : String(rule ?? "").trim(),
								)
								.filter((entry) => entry.length > 0)
						: [];

					if (!idealResponse || targetWordCount <= 0) return null;

					return {
						id,
						type,
						prompt,
						intensity,
						targetWordCount,
						idealResponse,
						rubric: rubric.length > 0 ? rubric : ["Clarity", "Accuracy", "Depth"],
					} satisfies MockExamEssayQuestion;
				}
				case "short-answer": {
					const targetWordCount = Number(record.targetWordCount ?? 0);
					const rawKeyPoints = record.keyPoints;
					const keyPoints = Array.isArray(rawKeyPoints)
						? rawKeyPoints
								.map((point) =>
									typeof point === "string" ? point.trim() : String(point ?? "").trim(),
								)
								.filter((entry) => entry.length > 0)
						: [];
					const idealResponseValue = record.idealResponse;
					const idealResponse = typeof idealResponseValue === "string"
						? idealResponseValue.trim()
						: "";

					if (!idealResponse || targetWordCount <= 0) return null;

					return {
						id,
						type,
						prompt,
						intensity,
						targetWordCount,
						keyPoints,
						idealResponse,
					} satisfies MockExamShortAnswerQuestion;
				}
				default:
					return null;
			}
		})
		.filter((question): question is MockExamQuestion => question !== null);
};

const scoreStringSimilarity = (expected: string, received: string) => {
	const normalize = (value: string) =>
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, " ")
			.trim();

	const a = normalize(expected);
	const b = normalize(received);

	if (!a || !b) return 0;
	if (a === b) return 1;

	const tokensA = new Set(a.split(" "));
	const tokensB = new Set(b.split(" "));

	let overlap = 0;
	tokensA.forEach((token) => {
		if (tokensB.has(token)) overlap += 1;
	});

	return overlap / Math.max(tokensA.size, tokensB.size);
};

const evaluateConstructedResponse = async (
	apiKey: string,
	question: MockExamEssayQuestion | MockExamShortAnswerQuestion,
	response: string,
) => {
	const systemPrompt =
		"You are an expert exam grader. Evaluate the student's answer using the rubric provided. Always respond with strict JSON.";

	const rubricSummary = "rubric" in question
		? question.rubric.join("; ")
		: question.keyPoints.join("; ");

	const userPrompt = `Question:
${question.prompt}

Student response:
${response || "(no response provided)"}

Reference answer:
${"idealResponse" in question ? question.idealResponse : ""}

Evaluation rubric/key points:
${rubricSummary}

Return JSON with:
{
  "score": number between 0 and 1,
  "feedback": "short paragraph",
  "strengths": ["1-2 bullet strengths"],
  "improvements": ["1-2 bullet suggestions"]
}`;

	const raw = await callModel(apiKey, systemPrompt, userPrompt, 0.3);
	const parsed = extractJson(raw) as {
		score?: number;
		feedback?: string;
		strengths?: string[];
		improvements?: string[];
	};

	const clampedScore = typeof parsed.score === "number"
		? Math.max(0, Math.min(1, parsed.score))
		: 0;

	return {
		score: clampedScore,
		feedback: parsed.feedback?.trim() ||
			"Response evaluated based on provided rubric.",
		strengths: Array.isArray(parsed.strengths)
			? parsed.strengths
					.map((entry) => String(entry ?? "").trim())
					.filter((entry) => entry.length > 0)
			: [],
		improvements: Array.isArray(parsed.improvements)
			? parsed.improvements
					.map((entry) => String(entry ?? "").trim())
					.filter((entry) => entry.length > 0)
			: [],
	};
};

const summarizePerformance = async (
	apiKey: string,
	documentTitle: string,
	results: MockExamQuestionScore[],
	intensity: "light" | "standard" | "intense",
) => {
	const systemPrompt =
		"You turn exam grading data into motivational feedback. Always return strict JSON.";

	const summaryPayload = {
		documentTitle,
		intensity,
		results: results.map((result) => ({
			questionId: result.questionId,
			score: result.score,
			outOf: result.outOf,
			isCorrect: result.isCorrect,
			feedback: result.feedback,
			strengths: result.strengths,
			improvements: result.improvements,
		})),
	};

	const userPrompt = `Transform the following exam grading data into feedback. Focus on constructive guidance and encouragement.\n\n${JSON.stringify(summaryPayload)}\n\nReturn JSON:\n{\n  "strengths": ["..."],\n  "weakAreas": ["..."],\n  "suggestions": ["..."]\n}`;

	try {
		const raw = await callModel(apiKey, systemPrompt, userPrompt, 0.2);
		const parsed = extractJson(raw) as {
			strengths?: string[];
			weakAreas?: string[];
			suggestions?: string[];
		};

		return {
			strengths: Array.isArray(parsed.strengths)
				? parsed.strengths
						.map((entry) => String(entry ?? "").trim())
						.filter((entry) => entry.length > 0)
				: [],
			weakAreas: Array.isArray(parsed.weakAreas)
				? parsed.weakAreas
						.map((entry) => String(entry ?? "").trim())
						.filter((entry) => entry.length > 0)
				: [],
			suggestions: Array.isArray(parsed.suggestions)
				? parsed.suggestions
						.map((entry) => String(entry ?? "").trim())
						.filter((entry) => entry.length > 0)
				: [],
		};
	} catch (error) {
		console.error("Performance summary generation failed", error);
		return {
			strengths: [],
			weakAreas: [],
			suggestions: [
				"Review your notes and revisit areas that felt less comfortable.",
			],
		};
	}
};

const handleGenerate = async (
	supabase: ReturnType<typeof createClient>,
	lovableApiKey: string,
	userId: string,
	payload: GeneratePayload,
): Promise<Response> => {
	const { documentId, config } = payload;

	const { data: document, error: fetchError } = await supabase
		.from("documents")
		.select("id, owner_id, title, metadata")
		.eq("id", documentId)
		.eq("owner_id", userId)
		.maybeSingle<DocumentRow>();

	if (fetchError) {
		console.error("Document fetch error", fetchError);
		return json(500, { error: "Failed to load document" });
	}

	if (!document) {
		return json(404, { error: "Document not found" });
	}

	const rawContent = extractContent(document.metadata);
	if (!rawContent || rawContent.trim().length < 200) {
		return json(400, {
			error: "Document does not contain enough content for test generation",
		});
	}

	const normalizedContent = chunkText(rawContent);

	const requirementSummary = normalizeRequirementSummary(config.requirements);
	const targetMinutes = Math.max(
		10,
		Math.round(config.requirements.reduce(
			(sum, req) => sum + (req.type === "essay"
				? 12
				: req.type === "short-answer"
				? 6
				: req.type === "matching"
				? 5
				: 4) * req.count,
			0,
		)),
	);

	const systemPrompt =
		"You are an instructional designer creating high-quality mock exams. Respond with strict JSON only.";

	const userPrompt = `You must create a mock exam based on the provided study material.

Document title: ${document.title}
Intensity: ${config.intensity}
Student experience level: ${
	config.intensity === "light"
		? "warming up, focus on fundamentals"
		: config.intensity === "standard"
		? "confident, include applied reasoning"
		: "advanced, emphasise synthesis and nuance"
}

Requirements:
- ${requirementSummary}

Return JSON as:
{
  "questions": [
    {
      "id": "Q1",
      "type": "mcq" | "fill-in-the-blank" | "matching" | "essay" | "short-answer",
      "prompt": "Student-facing prompt",
      // For MCQ:
      "options": [{"label": "A", "text": "..."}, ...],
      "answerKey": "A|B|C|D",
      "explanation": "2 sentence rationale",
      // For fill-in-the-blank:
      "answer": "correct phrase",
      "explanation": "1-2 sentence rationale",
      // For matching:
      "pairs": [{"prompt": "Term or clue", "answer": "Matching item"}],
      "explanation": "1-2 sentence summary",
      // For essay:
      "targetWordCount": number,
      "idealResponse": "Model response (120-200 words)",
      "rubric": ["Short criterion", "..."],
      // For short-answer:
      "targetWordCount": number,
      "keyPoints": ["Point 1", "..."],
      "idealResponse": "Reference answer (60-100 words)"
    }
  ]
}

Use only information from the material below. Avoid repeating the same concept across different questions unless it tests a different skill.

Material:
"""
${normalizedContent}
"""`;

	const raw = await callModel(lovableApiKey, systemPrompt, userPrompt, 0.45);
	const parsed = extractJson(raw) as { questions?: unknown };

	if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
		return json(500, { error: "AI did not return questions" });
	}

	const examId = crypto.randomUUID();
	const questions = sanitizeQuestions(
		parsed.questions as unknown[],
		config.intensity,
	);

	if (questions.length === 0) {
		return json(500, { error: "Unable to construct valid questions" });
	}

	const responsePayload: MockExamGenerationResult = {
		examId,
		documentTitle: document.title,
		intensity: config.intensity,
		timer: {
			enabled: config.timerEnabled,
			suggestedMinutes: config.timerEnabled ? targetMinutes : Math.max(15, targetMinutes),
		},
		questions,
	};

	return json(200, { data: responsePayload });
};

const handleEvaluate = async (
	lovableApiKey: string,
	documentTitle: string,
	payload: EvaluatePayload,
): Promise<Response> => {
	const { questions, responses, examId, intensity } = payload;

	const scores: MockExamQuestionScore[] = [];

	for (const question of questions) {
		const responseEntry = responses.find((entry) =>
			entry.questionId === question.id
		);
		let result: MockExamQuestionScore;

		switch (question.type) {
			case "mcq": {
				const answer = String(responseEntry?.response ?? "").trim().toUpperCase();
				const isCorrect = answer === question.answerKey;
				result = {
					questionId: question.id,
					score: isCorrect ? 1 : 0,
					outOf: 1,
					isCorrect,
					feedback: isCorrect
						? "Correct choice."
						: `Correct answer was ${question.answerKey}. ${question.explanation}`,
					strengths: isCorrect ? ["Confident recall of key facts."] : [],
					improvements: isCorrect
						? []
						: ["Revisit this concept to reinforce precise recall."],
				};
				break;
			}
			case "fill-in-the-blank": {
				const answer = String(responseEntry?.response ?? "").trim();
				const similarity = answer
					? scoreStringSimilarity(question.answer, answer)
					: 0;
				const isCorrect = similarity > 0.85;

				result = {
					questionId: question.id,
					score: similarity,
					outOf: 1,
					isCorrect,
					feedback: similarity >= 0.85
						? "Excellent recall."
						: similarity >= 0.4
						? `Partially correct. Target phrase: "${question.answer}".`
						: `Expected: "${question.answer}".`,
					strengths: similarity >= 0.85 ? ["Precise recall of terminology."] : [],
					improvements: similarity >= 0.85
						? []
						: ["Practice recalling the exact phrasing used in the notes."],
				};
				break;
			}
			case "matching": {
				const selections = Array.isArray(responseEntry?.response)
					? responseEntry?.response as Array<{ prompt: string; answer: string }>
					: [];

				let correctMatches = 0;
				question.pairs.forEach((pair) => {
					const selected = selections.find((entry) =>
						entry.prompt === pair.prompt
					);
					if (
						selected &&
						scoreStringSimilarity(pair.answer, selected.answer) > 0.85
					) {
						correctMatches += 1;
					}
				});

				const ratio = correctMatches / question.pairs.length;
				result = {
					questionId: question.id,
					score: ratio,
					outOf: 1,
					isCorrect: ratio === 1,
					feedback: ratio === 1
						? "Perfect matching."
						: `Matched ${correctMatches} of ${question.pairs.length}.`,
					strengths: ratio === 1 ? ["Strong concept linking."] : [],
					improvements: ratio === 1
						? []
						: ["Review how each term connects to its definition or example."],
				};
				break;
			}
			case "essay":
			case "short-answer": {
				const response = String(responseEntry?.response ?? "");
				const { score, feedback, strengths, improvements } =
					await evaluateConstructedResponse(
						lovableApiKey,
						question,
						response,
					);

				result = {
					questionId: question.id,
					score,
					outOf: 1,
					isCorrect: score >= 0.75 ? true : score <= 0.35 ? false : null,
					feedback,
					strengths,
					improvements,
				};
				break;
			}
			default:
				result = {
					questionId: question.id,
					score: 0,
					outOf: 1,
					isCorrect: false,
					feedback: "Question type not recognised for grading.",
					strengths: [],
					improvements: ["Please flag this item for review."],
				};
				break;
		}

		scores.push(result);
	}

	const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
	const totalPossible = scores.reduce((sum, item) => sum + item.outOf, 0);
	const overall = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

	const highlights = await summarizePerformance(
		lovableApiKey,
		documentTitle,
		scores,
		intensity,
	);

	const payload: MockExamEvaluationResult = {
		examId,
		documentTitle,
		intensity,
		overallScore: Math.round(overall),
		details: scores,
		highlights,
	};

	return json(200, { data: payload });
};

serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}

	if (req.method !== "POST") {
		return json(405, { error: "Method not allowed" });
	}

	const authHeader = req.headers.get("Authorization") ?? "";
	const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

	if (!accessToken) {
		return json(401, { error: "Unauthorized" });
	}

	let body: RequestPayload;
	try {
		body = await req.json();
	} catch (_) {
		return json(400, { error: "Invalid JSON body" });
	}

	if (!body?.action) {
		return json(400, { error: "action is required" });
	}

	try {
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

		if (!supabaseUrl || !serviceRoleKey || !lovableApiKey || !MODEL_ID) {
			console.error("Missing required environment variables");
			return json(500, { error: "Server not configured" });
		}

		const supabase = createClient(supabaseUrl, serviceRoleKey, {
			auth: { persistSession: false },
		});

		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser(accessToken);

		if (userError || !user) {
			return json(401, { error: "Unauthorized" });
		}

		const role = await getRole(supabase, user.id);
		if (role === "guest") {
			return json(403, {
				error: "Mock exams require an upgraded account",
				reason: "upgrade_required",
			});
		}

		if (body.action === "generate") {
			return await handleGenerate(supabase, lovableApiKey, user.id, body);
		}

		if (body.action === "evaluate") {
			const { documentId } = body;

			const { data: document, error: fetchError } = await supabase
				.from("documents")
				.select("id, owner_id, title")
				.eq("id", documentId)
				.eq("owner_id", user.id)
				.maybeSingle<{ id: string; owner_id: string; title: string }>();

			if (fetchError) {
				console.error("Document fetch error", fetchError);
				return json(500, { error: "Failed to load document" });
			}

			if (!document) {
				return json(404, { error: "Document not found" });
			}

			return await handleEvaluate(
				lovableApiKey,
				document.title,
				body,
			);
		}

		return json(400, { error: "Unsupported action" });
	} catch (error) {
		console.error("Mock exam error", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return json(500, { error: message });
	}
});
