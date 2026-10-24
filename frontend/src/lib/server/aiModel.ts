import OpenAI from "openai";

/**
 * Which OpenAI model writes recommendations, reads listings and lays out PDFs. OPENAI_MODEL in the
 * environment overrides it without a deploy; if OpenAI rejects the model (unknown name or an
 * unsupported option), the call is retried once on FALLBACK_MODEL so features keep working.
 */
export const DEFAULT_MODEL = "gpt-6-luna";
export const FALLBACK_MODEL = "gpt-4o";

export const aiModel = () => process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

// Reasoning models (gpt-5+, o-series) take a reasoning effort and only their default temperature
const isReasoningModel = (model: string) => /^(gpt-[5-9]|o\d)/.test(model);
const EFFORTS = ["none", "minimal", "low", "medium", "high"] as const;
type Effort = (typeof EFFORTS)[number];
// "none" keeps these short structured-JSON tasks as fast as the old non-reasoning model
const effort = (): Effort => {
  const v = process.env.OPENAI_REASONING_EFFORT?.trim() as Effort | undefined;
  return v && EFFORTS.includes(v) ? v : "none";
};

type Messages = OpenAI.Chat.ChatCompletionMessageParam[];

function params(model: string, messages: Messages, temperature?: number): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming {
  return {
    model,
    messages,
    response_format: { type: "json_object" },
    ...(isReasoningModel(model) ? { reasoning_effort: effort() } : temperature !== undefined ? { temperature } : {}),
  };
}

const rejectedModel = (error: unknown) =>
  error instanceof OpenAI.APIError ? error.status === 400 || error.status === 404 : false;

/** One JSON-mode chat completion; returns the message text (null when the model sent none). */
export async function jsonCompletion(
  client: Pick<OpenAI, "chat">,
  messages: Messages,
  options: { temperature?: number } = {},
): Promise<string | null> {
  const model = aiModel();
  try {
    const response = await client.chat.completions.create(params(model, messages, options.temperature));
    return response.choices[0]?.message?.content ?? null;
  } catch (error) {
    if (model === FALLBACK_MODEL || !rejectedModel(error)) throw error;
    console.warn(`OpenAI rejected model ${model}; retrying on ${FALLBACK_MODEL}`, error);
    const response = await client.chat.completions.create(params(FALLBACK_MODEL, messages, options.temperature));
    return response.choices[0]?.message?.content ?? null;
  }
}
