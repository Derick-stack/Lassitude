import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigins.includes(origin)) return new Response('Origin not allowed', { status: 403 });
  const headers = { ...corsHeaders, 'Access-Control-Allow-Origin': origin };
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return Response.json({ error: 'Authentication required.' }, { status: 401, headers });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request body.' }, { status: 400, headers }); }
  if (body?.confirmation !== 'DELETE') return Response.json({ error: 'Typed confirmation is required.' }, { status: 400, headers });

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceRoleKey) return Response.json({ error: 'Deletion function is not configured.' }, { status: 500, headers });

  const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return Response.json({ error: 'Session is invalid or expired.' }, { status: 401, headers });

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return Response.json({ error: 'Account deletion failed.' }, { status: 500, headers });
  return Response.json({ deleted: true }, { status: 200, headers });
});
