# Optional: AI replies for the NADIR coach

NADIR works without this step: it coaches offline from the visitor's own progress. With the `nadir-coach` Edge Function deployed, signed-in users get replies from Claude instead (guests always use the offline coach, so the API key is never spent on anonymous traffic). If the function fails, NADIR quietly falls back to its offline replies.

1. Create an API key at https://platform.claude.com (Settings → API keys) and set a monthly spend limit there.
2. In the Supabase Dashboard's Edge Function secrets, add `ANTHROPIC_API_KEY` with that key. Like the service-role key, enter it only in the secret manager, never in source or chat. `ALLOWED_ORIGINS` (set up for `delete-account` in `supabase/README.md`) is reused; `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided to Edge Functions automatically.
3. Deploy with `supabase functions deploy nadir-coach`.

The function checks the user's session, allows up to 30 messages per user per hour, sends at most the last 12 messages plus a short summary of that user's progress, and asks for replies under 120 words. It uses `claude-opus-5-5` at low effort; for lower cost, change `model` in `supabase/functions/nadir-coach/index.ts` to `claude-haiku-5-5`.
