import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// On app startup: clear stale sessions from a different Supabase project.
// This handles the case where the APK was rebuilt pointing to a new project
// but the user still has a cached JWT from the old project in localStorage.
const PROJECT_REF_KEY = 'solto_supabase_project_ref';
const currentRef = supabaseUrl?.match(/\/\/([^.]+)/)?.[1] || '';

try {
  const savedRef = localStorage.getItem(PROJECT_REF_KEY);
  if (savedRef && savedRef !== currentRef) {
    console.warn('⚠️ Supabase project changed — clearing stale session');
    supabase.auth.signOut();
  }
  localStorage.setItem(PROJECT_REF_KEY, currentRef);
} catch (e) {
  // localStorage may not be available in some contexts
}
