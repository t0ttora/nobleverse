import { NextResponse } from 'next/server';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      messages?: ChatMessage[];
      model?: string;
    };
    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing messages' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = body.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // If no key, return a stubbed demo response to keep UI functional in dev
    if (!apiKey) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const reply =
        'AI is not configured yet. Set OPENAI_API_KEY to enable real answers.\n\nYou asked: ' +
        (lastUser?.content || '(empty)');
      return NextResponse.json({ reply, model: 'demo' });
    }

    // Call OpenAI Chat Completions API without adding new deps
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        stream: false
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: 'Upstream error', details: errText },
        { status: 502 }
      );
    }

    const json = (await resp.json()) as any;
    const reply: string = json?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ reply, model });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
