import { NOTE_TYPES, type NoteType } from './noteTypes';

const MODEL = process.env.OPENAI_MODEL || 'sol-5.6';

// Asks the model which category a note belongs to. Falls back to 'other' when there is no API key
// or the call fails, so saving a note never depends on the API being reachable.
export async function classifyNote(text: string): Promise<NoteType> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return 'other';
  const list = NOTE_TYPES.map((t) => `- ${t.id}: ${t.label}${t.hint ? ` (${t.hint})` : ''}`).join('\n');
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You categorize notes written by engineers about a machine. Choose the single best category id:\n${list}\nReply with JSON: {"type": "<id>"}.` },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) { console.error('classify failed', res.status, await res.text()); return 'other'; }
    const data = await res.json();
    const type = JSON.parse(data.choices?.[0]?.message?.content ?? '{}').type;
    return NOTE_TYPES.some((t) => t.id === type) ? type : 'other';
  } catch (e) {
    console.error('classify error', e);
    return 'other';
  }
}
