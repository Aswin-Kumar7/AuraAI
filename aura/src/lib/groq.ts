import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

const groqClient = apiKey
  ? new Groq({
      apiKey,
    })
  : null;

export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 800
): Promise<string | null> {
  if (!groqClient) {
    return null;
  }

  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const choice = completion.choices?.[0];
    const content = choice?.message?.content;
    if (!content) return null;
    return content;
  } catch (error) {
    console.error("Groq error", error);
    return null;
  }
}

