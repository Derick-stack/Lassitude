export const SUPABASE_URL = 'https://tkibyqkudkttsuruasyd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraWJ5cWt1ZGt0dHN1cnVhc3lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDUzNjIsImV4cCI6MjEwODM4MTM2Mn0.Kgc6K93UtFkkmZ8BcWs1uXLe4LTcT0QKHxaZJTEwSNQ';

export const supabaseConfigured = Boolean(
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
);