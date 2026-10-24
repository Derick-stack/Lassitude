# Security checklist

Lassitude is a static site (GitHub Pages) with optional Supabase accounts and two Supabase Edge Functions (`delete-account`, `nadir-coach`). This is the result of reviewing it against 20 common website security checks. **Action needed** marks something only the site owner can do in a dashboard.

| # | Check | Status |
|---|---|---|
| 1 | Hide API keys | ✅ The browser only has the Supabase **anon** key, which is designed to be public and is limited by Row Level Security. The Anthropic key and Supabase service-role key live only in Supabase Edge Function secrets. ⚠️ **Action needed:** an old Groq API key (`gsk_…`) is still visible in this public repo's early commits. Revoke it (see below). |
| 2 | Check env variables | ✅ Edge Functions read `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `ALLOWED_ORIGINS` from Supabase secrets. Nothing secret is in `js/config.js`. |
| 3 | Check keys in git | ✅ `.gitignore` now blocks `.env`, `.env.*`, `*.pem` and `*.key`. History scan: the only real secret found is the old Groq key above. |
| 4 | Protect admin routes | ✅ There are no admin pages or admin APIs. |
| 5 | Add auth | ✅ Supabase Auth (email + password, magic link, optional Google). Passwords are never stored by Lassitude. |
| 6 | Check user permissions | ✅ Every table has an `owner_all` policy: users can only read and write rows where `user_id = auth.uid()`. Anonymous access is revoked. Account deletion checks the signed-in user on the server. |
| 7 | Sanitize user inputs | ✅ Edge Functions validate and size-limit every field (message count and length, note length, typed `DELETE` confirmation) and `nadir-coach` now rejects request bodies over 64 KB. (`delete-account` takes only a one-word confirmation from a signed-in user.) Restored backups are re-validated field by field. |
| 8 | Protect against XSS | ✅ The app never uses `innerHTML`; all text is inserted as text nodes. A Content-Security-Policy on every page blocks inline and third-party scripts. Workout-post photos must be embedded images (`data:image/…`). |
| 9 | SQL injection | ✅ No raw SQL from user input. The Supabase client sends parameterized requests. |
| 10 | Check database rules | ✅ RLS is enabled on all 20 tables (see `supabase/schema.sql`). Never disable it. |
| 11 | Add rate limiting | ✅ `nadir-coach` allows 30 requests per user per hour. Supabase Auth rate-limits sign-ups, sign-ins and emails. ℹ️ The coach limit is per function instance; for a hard limit, add a table-backed counter later. |
| 12 | Set spend cap | ⚠️ **Action needed:** in the Claude Console (platform.claude.com), set a monthly spend limit on the key used by `nadir-coach`. Replies are capped at 4,000 output tokens and flashcards at 8,000. |
| 13 | Secure file uploads | ✅ Photos: images only, under 8 MB, re-encoded to a small JPEG in the browser and never uploaded to a server. Backups: JSON only, under 20 MB, previewed with a confirmation and undo. |
| 14 | CSRF protection | ✅ Not applicable to cookies: Supabase sends the session as an `Authorization` header, not a cookie, so other sites can't ride on it. Edge Functions also reject requests from origins not in `ALLOWED_ORIGINS`. |
| 15 | Check CORS settings | ✅ Both functions answer only origins listed in `ALLOWED_ORIGINS`. Keep that list to your real sites, for example `https://derick-stack.github.io` (no paths or trailing slashes). |
| 16 | Enable HTTPS | ⚠️ **Action needed:** GitHub repo → Settings → Pages → tick **Enforce HTTPS**. The CSP also upgrades any stray `http:` request. |
| 17 | Add security headers | ✅ Partly: a CSP and a strict referrer policy are set with `<meta>` tags. ℹ️ GitHub Pages can't send custom headers, so `X-Frame-Options` and HSTS aren't possible there. If you move to Netlify, Vercel or Cloudflare Pages, add those headers in their config. |
| 18 | Secure cookies | ✅ Lassitude sets no cookies. Supabase keeps the session in browser storage; the CSP limits what scripts could read it. |
| 19 | Disable debug mode | ✅ No debug flags or verbose logging. The only console message is a setup hint when accounts aren't configured. |
| 20 | Check prod settings | ⚠️ **Action needed** in Supabase: Authentication → URL Configuration (Site URL and redirect URLs set to your real site only); keep **Confirm email** on; turn on **Leaked password protection** if your plan has it; Edge Function secrets set; `schema.sql` applied. |

## Revoke the old Groq key

1. Sign in at console.groq.com → **API Keys**.
2. Delete the key that starts with `gsk_` and was used for the old NADIR chat.
3. If you still need Groq, create a new key and keep it in a server-side secret, never in the website code.

Deleting the key is what protects you. Rewriting git history would not help, because the repo is public and copies may already exist.
