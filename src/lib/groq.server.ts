/**
 * Groq (openai/gpt-oss-120b) helper — server-only.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

export async function groqJson<T>(prompt: string, maxTokens = 1200): Promise<T> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured yet (missing Groq API key).");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a precise information extraction engine. You always reply with a single valid JSON object and no preamble, prose or markdown fences.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new Error("The Groq API key was rejected. Please check the key.");
    if (res.status === 429) throw new Error("The AI service is rate limited right now. Try again in a moment.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI returned an empty response.");

  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new Error("Unable to parse the AI response — manual review needed.");
  }
}
