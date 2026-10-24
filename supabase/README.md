# Supabase setup for Lassitude

Guest mode works without Supabase. Account creation and cloud sync stay disabled until the two public values in `js/config.js` are replaced.

## 1. Create the project and tables

1. Create a Supabase project and wait for it to finish provisioning.
2. In the project Dashboard, open **SQL Editor**, create a query, paste all of `supabase/schema.sql`, and run it. The script creates the tables and enables owner-only RLS policies.
3. In **Project Settings → API**, copy the **Project URL** and the **anon/public key**. These are the only Supabase values intended for browser code.
4. In `js/config.js`, replace:
   - `https://YOUR_PROJECT_REF.supabase.co` with the Project URL.
   - `YOUR_SUPABASE_ANON_KEY` with the anon/public key.

Do not put the `service_role` key in `js/config.js`, any HTML/JavaScript file, or Git. Never disable RLS on these tables.

## 2. Configure authentication redirects

In **Authentication → URL Configuration**:

- Set **Site URL** to the deployed site base URL.
- Add redirect URLs for the sign-in/magic-link callback and password recovery page.
- For local development, allow `http://localhost:8000/**`.
- For a GitHub Pages project site, allow `https://YOUR_GITHUB_NAME.github.io/YOUR_REPOSITORY/**`. For a custom domain, allow that domain’s HTTPS URL.

In **Authentication → Providers**, enable Email. Email/password signup, email confirmation, and password reset are handled by Supabase Auth. Google sign-in is optional; if enabled, configure its OAuth client in Supabase and Google Cloud Console first.

## 3. Deploy account deletion

The account page calls the `delete-account` Edge Function. It validates the signed-in user, checks the request origin and typed `DELETE` confirmation, then deletes that user through the Supabase Admin API. Related rows cascade through their foreign keys.

1. Install and authenticate the Supabase CLI, then link this repository to the project.
2. In the Supabase Dashboard’s Edge Function secrets, set:
   - `SUPABASE_URL`: the Project URL from Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY`: the project’s service-role secret from Project Settings → API. Enter it directly into the Supabase secret manager; do not paste it into source, this document, or chat.
   - `ALLOWED_ORIGINS`: comma-separated origins only, such as `http://localhost:8000,https://YOUR_GITHUB_NAME.github.io`. Do not include paths or trailing slashes.
3. From the repository root, deploy with `supabase functions deploy delete-account`.

The service-role secret is used only by the deployed Edge Function. It must never be exposed to the browser.

## 4. Guest data and syncing

The first time a guest with local data signs in, Lassitude shows a confirmation dialog before uploading this browser’s data. Declining keeps the guest data local. After confirmation, the app uploads and loads the account’s rows, then syncs later changes. Each user can access only their own rows through RLS. Passwords are never stored in Lassitude tables or localStorage.

If the user chooses to delete their account, cloud deletion happens first. The browser clears its local Lassitude data only after the Edge Function confirms success.
