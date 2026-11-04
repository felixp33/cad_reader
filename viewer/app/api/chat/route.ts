import { libraryContext, machineContext } from '@/lib/machineContext';
import { ALL_MACHINES } from '@/lib/noteTypes';

export const dynamic = 'force-dynamic';

const MODEL = process.env.OPENAI_MODEL || 'sol-5.6';

const SYSTEM = `You are an assistant that helps people understand one machine, using ONLY the briefing below.
The briefing may cover several machines; say which machine you are talking about. It lists the machine's parts and the knowledge notes its creators wrote.
- Answer from the briefing. If it does not say, say you don't know instead of guessing.
- When you use a note, mention who wrote it (by name) so the reader can follow up with them.
- Refer to parts by their given names. Keep answers short and concrete.
- Reply in the language the question is asked in.`;

type Msg = { role: 'user' | 'assistant'; content: string };

// Streams the assistant's answer as plain text.
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return new Response('OPENAI_API_KEY is not set (add it to viewer/.env.local and restart).', { status: 503 });

  const { model, messages, selected } = await req.json();
  const valid = typeof model === 'string' && Array.isArray(messages) && messages.length > 0
    && messages.every((m: Msg) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string');
  if (!valid) return new Response('invalid request', { status: 400 });

  const focus = selected && typeof selected.label === 'string' ? `\nThe reader currently has this part selected in the 3D view: ${selected.label} (id ${selected.id}).` : '';
  const history: Msg[] = (messages as Msg[]).slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(90_000)]), // never hang forever
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: 'system', content: `${SYSTEM}${focus}\n\n--- BRIEFING ---\n${model === ALL_MACHINES ? libraryContext() : machineContext(model)}` }, ...history],
    }),
  });
  if (!upstream.ok || !upstream.body) {
    console.error('chat failed', upstream.status, await upstream.text().catch(() => ''));
    return new Response(`The AI service returned an error (${upstream.status}).`, { status: 502 });
  }

  // Forward the text deltas of the SSE stream.
  const decoder = new TextDecoder(), encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  let buf = '';
  return new Response(new ReadableStream({
    // A pull that enqueues nothing is never retried, so keep reading until there is text to hand over
    // (the first chunks of a stream often carry no content).
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        let sent = false;
        for (const line of lines) {
          if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
          try {
            const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
            if (delta) { controller.enqueue(encoder.encode(delta)); sent = true; }
          } catch { /* partial or keep-alive line */ }
        }
        if (sent) return;
      }
    },
    cancel() { reader.cancel(); },
  }), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
