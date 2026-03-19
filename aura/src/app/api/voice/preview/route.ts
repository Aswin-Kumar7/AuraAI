import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  voiceId: z.string().min(1),
  text: z.string().min(1),
});

// Uses Deepgram TTS instead of ElevenLabs.
// voiceId is passed through as the Deepgram "voice" query param.
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { voiceId, text } = parsed.data;

    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json({ error: "Missing Deepgram API key" }, { status: 500 });
    }

    const model = process.env.DEEPGRAM_TTS_MODEL || "aura-asteria-en";

    const url = new URL("https://api.deepgram.com/v1/speak");
    url.searchParams.set("model", model);
    if (voiceId) {
      url.searchParams.set("voice", voiceId);
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Deepgram error: ${err}` }, { status: 500 });
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    return NextResponse.json({ audio: dataUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
