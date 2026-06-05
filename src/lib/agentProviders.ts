import type { AgentProvider } from "./agents";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderResult {
  text: string;
  model: string;
}

export class MissingProviderKeyError extends Error {
  constructor(public provider: AgentProvider) {
    super(`Missing API key for ${provider}`);
  }
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function keyFor(provider: AgentProvider): string | undefined {
  if (provider === "gpt") return env("OPENAI_API_KEY");
  if (provider === "gemini") return env("GEMINI_API_KEY") ?? env("GOOGLE_API_KEY");
  if (provider === "kimi") return env("KIMI_API_KEY") ?? env("MOONSHOT_API_KEY");
  return env("ANTHROPIC_API_KEY");
}

export function isProviderConfigured(provider: AgentProvider): boolean {
  return Boolean(keyFor(provider));
}

function modelFor(provider: AgentProvider): string {
  if (provider === "gpt") return env("OPENAI_MODEL") ?? "gpt-4.1";
  if (provider === "gemini") return env("GEMINI_MODEL") ?? "gemini-2.5-flash";
  if (provider === "kimi") return env("KIMI_MODEL") ?? env("MOONSHOT_MODEL") ?? "moonshot-v1-128k";
  return env("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
}

async function postJson(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    const message =
      typeof json === "object" && json && "error" in json
        ? JSON.stringify((json as { error: unknown }).error)
        : text;
    throw new Error(message || `Provider request failed with ${res.status}`);
  }
  return json;
}

function openAiMessages(system: string, prompt: string): ProviderMessage[] {
  return [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];
}

async function callOpenAI(provider: "gpt" | "kimi", system: string, prompt: string): Promise<ProviderResult> {
  const key = keyFor(provider);
  if (!key) throw new MissingProviderKeyError(provider);
  const model = modelFor(provider);
  const baseUrl =
    provider === "kimi"
      ? env("KIMI_BASE_URL") ?? env("MOONSHOT_BASE_URL") ?? "https://api.moonshot.ai/v1"
      : env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";

  const json = (await postJson(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: openAiMessages(system, prompt),
      temperature: 0.2,
      max_tokens: provider === "kimi" ? 6000 : 8000,
    }),
  })) as {
    choices?: { message?: { content?: string } }[];
  };

  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${provider} returned an empty response`);
  return { text, model };
}

async function callGemini(system: string, prompt: string): Promise<ProviderResult> {
  const key = keyFor("gemini");
  if (!key) throw new MissingProviderKeyError("gemini");
  const model = modelFor("gemini");

  const json = (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 6000,
        },
      }),
    },
  )) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("gemini returned an empty response");
  return { text, model };
}

export async function callProviderText(
  provider: Exclude<AgentProvider, "claude">,
  system: string,
  prompt: string,
): Promise<ProviderResult> {
  if (provider === "gemini") return callGemini(system, prompt);
  return callOpenAI(provider, system, prompt);
}
