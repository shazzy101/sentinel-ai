import { createClient } from '@supabase/supabase-js'

// Production defaults — anon key is safe to commit (public read-only JWT)
const PROD_URL = 'https://wuszhfqznudawpsjkgwv.supabase.co'
const PROD_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c3poZnF6bnVkYXdwc2prZ3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3ODAwNDgsImV4cCI6MjA5NjM1NjA0OH0.V5lhFQJr2VRKvNpOIbiYNcEp329Jjy6exFifMfEzdBQ'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PROD_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || PROD_ANON

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
