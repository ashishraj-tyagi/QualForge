
export type LlmResult = { content: string; provider: string; model: string };

function stripFences(content: string): string {
  return content
    .replace(/^```gherkin\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

/** Prefer LLM_API_KEY; fall back to provider-specific env vars. */
export function resolveApiKey(provider: string): string | undefined {
  const primary = process.env.LLM_API_KEY?.trim();
  if (primary) return primary;
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY?.trim();
  }
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_API_KEY?.trim();
  }
  return undefined;
}

export function resolveProvider(): string {
  return (process.env.LLM_PROVIDER || "openai").toLowerCase();
}

export function requireLlm(): boolean {
  return ["1", "true", "yes"].includes(
    (process.env.REQUIRE_LLM || "").toLowerCase(),
  );
}

async function callOpenAi(
  key: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned empty content");
  return stripFences(content);
}

async function callAnthropic(
  key: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Anthropic request failed: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic returned empty content");
  return stripFences(text);
}

/**
 * Call configured LLM. Throws `NO_KEY` when no key is available (unless REQUIRE_LLM).
 */
export async function generateGherkin(
  systemPrompt: string,
  userPrompt: string,
): Promise<LlmResult> {
  const provider = resolveProvider();
  const key = resolveApiKey(provider);
  if (!key) {
    throw new Error("NO_KEY");
  }

  const system =
    "You are a senior quality engineer. Output only Gherkin feature files. " +
    "Never invent endpoints not in the OpenAPI. Never hard-code secrets beyond " +
    "the known StockRoom seed passwords used in examples.";

  if (provider === "openai") {
    const model = process.env.LLM_MODEL || "gpt-4o-mini";
    const content = await callOpenAi(
      key,
      model,
      `${system}\n\n${systemPrompt}`,
      userPrompt,
    );
    return { content, provider, model };
  }

  if (provider === "anthropic") {
    const model = process.env.LLM_MODEL || "claude-sonnet-4-20250514";
    const content = await callAnthropic(
      key,
      model,
      `${system}\n\n${systemPrompt}`,
      userPrompt,
    );
    return { content, provider, model };
  }

  throw new Error(
    `Unsupported LLM_PROVIDER=${provider}. Use openai or anthropic.`,
  );
}
