import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1000;
const MAX_CONTEXT_CHARS = 1500;
const HOURLY_LIMIT = 30;

const SYSTEM_PROMPT = `You are NADIR, the coach inside Lassitude, a Christian app for daily discipline across four areas: Faith (prayer, scripture), Focus (mental clarity, deep work), Food (simple wholesome eating) and Fitness (movement, strength).

How you coach:
- Treat the body as something to steward for God's purposes: aim for strength, energy and consistency, not appearance.
- Favor small, repeatable actions over big overhauls. End with one concrete next step the person can do today.
- Pair physical and spiritual habits where it fits (prayer on a walk, worship during a workout, gratitude before meals).
- Use the progress data you are given to make advice specific, and celebrate real wins in it. Never invent numbers that are not in the data.
- Quote scripture sparingly and accurately, with the reference. Respect that people are at different places in their faith.
- Keep replies under 120 words, warm and direct. Plain text only: no markdown headings, tables or bold. Short lists with "•" are fine.
- You give general guidance only. For injuries, pain, eating disorders, medical or mental health conditions, say so plainly and point to a doctor, dietitian or counselor.
- If someone mentions self-harm or suicide, respond with care and tell them to call or text 988 in the U.S., or their local emergency number, right away.
- Stay on these topics. If asked about something unrelated, steer gently back to the person's routine.`;

const FLASHCARD_PROMPT = `You turn a student's notes into study flashcards for spaced repetition.
- Use only facts stated in the notes. Never add outside information, and never correct the notes.
- One fact per card. The front is a short, specific question; the back is the shortest complete answer.
- Cover definitions, key terms, people, dates, lists, processes and scripture references (front: reference, back: verse text exactly as written).
- Skip reminders, logistics, opinions and anything too vague to test.
- Write 3 to 30 cards, fewer for short notes. Return an empty list if nothing is worth testing.`;
const MAX_NOTE_CHARS = 12000;
const CARD_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: { front: { type: 'string' }, back: { type: 'string' } },
        required: ['front', 'back'],
        additionalProperties: false
      }
    }
  },
  required: ['cards'],
  additionalProperties: false
};

async function writeFlashcards(text: string, headers: Record<string, string>) {
  const response = await anthropic.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 8000,
    system: FLASHCARD_PROMPT,
    messages: [{ role: 'user', content: `<notes>\n${text}\n</notes>` }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CARD_SCHEMA } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default'
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (response.stop_reason === 'refusal') return Response.json({ error: 'Declined.' }, { status: 422, headers });
  const json = response.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('');
  let parsed;
  try { parsed = JSON.parse(json); } catch { return Response.json({ error: 'Could not read cards.' }, { status: 502, headers }); }
  const cards = (Array.isArray(parsed?.cards) ? parsed.cards : [])
    .filter((card: { front?: unknown; back?: unknown }) => typeof card?.front === 'string' && typeof card?.back === 'string' && card.front.trim() && card.back.trim())
    .slice(0, 40)
    .map((card: { front: string; back: string }) => ({ front: card.front.trim().slice(0, 220), back: card.back.trim().slice(0, 600) }));
  return Response.json({ cards }, { status: 200, headers });
}

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
// Best-effort per-user limit; it resets whenever the function instance restarts.
const usage = new Map<string, { windowStart: number; count: number }>();

function overLimit(userId: string) {
  const now = Date.now();
  const entry = usage.get(userId);
  if (!entry || now - entry.windowStart > 3600_000) { usage.set(userId, { windowStart: now, count: 1 }); return false; }
  entry.count += 1;
  return entry.count > HOURLY_LIMIT;
}

function cleanMessages(value: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const messages = value.slice(-MAX_MESSAGES).map(item => ({
    role: item?.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: typeof item?.content === 'string' ? item.content.slice(0, MAX_MESSAGE_CHARS) : ''
  })).filter(item => item.content.trim());
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  // Merge consecutive turns from the same role so the conversation alternates.
  return messages.reduce<Anthropic.MessageParam[]>((list, item) => {
    const last = list[list.length - 1];
    if (last && last.role === item.role) last.content = `${last.content}\n\n${item.content}`;
    else list.push({ ...item });
    return list;
  }, []);
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigins.includes(origin)) return new Response('Origin not allowed', { status: 403 });
  const headers = { ...corsHeaders, 'Access-Control-Allow-Origin': origin };
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return Response.json({ error: 'Authentication required.' }, { status: 401, headers });
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return Response.json({ error: 'Session is invalid or expired.' }, { status: 401, headers });
  if (overLimit(user.id)) return Response.json({ error: 'Hourly coaching limit reached.' }, { status: 429, headers });
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return Response.json({ error: 'Coach is not configured.' }, { status: 500, headers });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request body.' }, { status: 400, headers }); }
  if (body?.task === 'flashcards') {
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_NOTE_CHARS) : '';
    if (!text) return Response.json({ error: 'Note text is required.' }, { status: 400, headers });
    try { return await writeFlashcards(text, headers); } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return Response.json({ error: 'Busy. Try again shortly.' }, { status: 429, headers });
      return Response.json({ error: 'Flashcards are unavailable.' }, { status: 502, headers });
    }
  }
  const messages = cleanMessages(body?.messages);
  if (!messages) return Response.json({ error: 'A user message is required.' }, { status: 400, headers });
  const context = typeof body?.context === 'string' ? body.context.slice(0, MAX_CONTEXT_CHARS) : '';
  const system = context ? `${SYSTEM_PROMPT}\n\nThe person's Lassitude progress right now (their own data):\n${context}` : SYSTEM_PROMPT;

  try {
    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      system,
      messages,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (response.stop_reason === 'refusal') return Response.json({ error: 'Coach declined this request.' }, { status: 422, headers });
    const reply = response.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim();
    if (!reply) return Response.json({ error: 'Empty reply.' }, { status: 502, headers });
    return Response.json({ reply }, { status: 200, headers });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: 'Coach is busy. Try again shortly.' }, { status: 429, headers });
    if (error instanceof Anthropic.APIError) return Response.json({ error: 'Coach is unavailable.' }, { status: 502, headers });
    return Response.json({ error: 'Coach is unavailable.' }, { status: 500, headers });
  }
});
