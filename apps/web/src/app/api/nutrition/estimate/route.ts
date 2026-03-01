import { NextResponse } from "next/server";

export const runtime = "nodejs";

type EstimateItem = {
  name: string;
  quantity_guess: string;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

type EstimateResponse = {
  items: EstimateItem[];
  totals: {
    calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
  confidence: "low" | "medium" | "high";
  notes: string[];
};

const ESTIMATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "totals", "confidence", "notes"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity_guess", "calories"],
        properties: {
          name: { type: "string", minLength: 1 },
          quantity_guess: { type: "string", minLength: 1 },
          calories: { type: "number", minimum: 0 },
          protein_g: { type: "number", minimum: 0 },
          carbs_g: { type: "number", minimum: 0 },
          fat_g: { type: "number", minimum: 0 },
        },
      },
    },
    totals: {
      type: "object",
      additionalProperties: false,
      required: ["calories"],
      properties: {
        calories: { type: "number", minimum: 0 },
        protein_g: { type: "number", minimum: 0 },
        carbs_g: { type: "number", minimum: 0 },
        fat_g: { type: "number", minimum: 0 },
      },
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const SYSTEM_PROMPT = `You estimate meal nutrition from natural language.
Always return strict JSON matching the provided schema.
Rules:
- Use realistic portions and nutrition values.
- Keep calories and macros numeric only.
- If uncertain, lower confidence and explain in notes.
- Keep notes concise (max 4 bullets).
- Do not include markdown or text outside JSON.`;

function clampNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function extractTextPayload(responseJson: Record<string, unknown>): string {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text;
  }

  const output = Array.isArray(responseJson.output) ? responseJson.output : [];
  for (const outputPart of output) {
    if (!outputPart || typeof outputPart !== "object") continue;
    const content = Array.isArray((outputPart as { content?: unknown }).content)
      ? ((outputPart as { content?: unknown }).content as Array<Record<string, unknown>>)
      : [];
    for (const chunk of content) {
      if (chunk?.type === "output_text" && typeof chunk.text === "string" && chunk.text.trim()) {
        return chunk.text;
      }
      if (chunk?.type === "text" && typeof chunk.text === "string" && chunk.text.trim()) {
        return chunk.text;
      }
    }
  }

  return "";
}

function normalizeEstimate(raw: unknown): EstimateResponse {
  const fallback: EstimateResponse = {
    items: [],
    totals: { calories: 0 },
    confidence: "low",
    notes: ["AI estimate unavailable. Enter values manually."],
  };

  if (!raw || typeof raw !== "object") return fallback;

  const parsed = raw as Partial<EstimateResponse> & {
    totals?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
  };

  const items: EstimateItem[] = [];
  for (const item of parsed.items ?? []) {
    const calories = clampNumber(item?.calories);
    if (!item?.name || !item?.quantity_guess || calories === undefined) continue;

    const normalized: EstimateItem = {
      name: String(item.name),
      quantity_guess: String(item.quantity_guess),
      calories,
    };

    const protein = clampNumber(item.protein_g);
    const carbs = clampNumber(item.carbs_g);
    const fat = clampNumber(item.fat_g);
    if (protein !== undefined) normalized.protein_g = protein;
    if (carbs !== undefined) normalized.carbs_g = carbs;
    if (fat !== undefined) normalized.fat_g = fat;
    items.push(normalized);
  }

  const totals = {
    calories: clampNumber(parsed.totals?.calories) ?? 0,
    protein_g: clampNumber(parsed.totals?.protein_g),
    carbs_g: clampNumber(parsed.totals?.carbs_g),
    fat_g: clampNumber(parsed.totals?.fat_g),
  };

  const confidence: EstimateResponse["confidence"] =
    parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? parsed.confidence
      : "low";

  const notes = Array.isArray(parsed.notes)
    ? parsed.notes
        .map((note) => String(note).trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    items,
    totals,
    confidence,
    notes: notes.length > 0 ? notes : fallback.notes,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to apps/web/.env.local." },
      { status: 500 },
    );
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Meal description text is required." }, { status: 400 });
  }

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "nutrition_estimate",
            schema: ESTIMATE_SCHEMA,
            strict: true,
          },
        },
      }),
    });

    const aiJson = (await aiResponse.json()) as Record<string, unknown>;

    if (!aiResponse.ok) {
      const errorMessage =
        typeof aiJson?.error === "object" && aiJson.error && "message" in aiJson.error
          ? String((aiJson.error as { message?: string }).message)
          : "AI provider request failed";
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    const payloadText = extractTextPayload(aiJson);
    if (!payloadText) {
      return NextResponse.json({ error: "AI returned empty output." }, { status: 502 });
    }

    const estimate = normalizeEstimate(JSON.parse(payloadText));
    return NextResponse.json(estimate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to estimate nutrition.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
