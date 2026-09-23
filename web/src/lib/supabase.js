import { createClient } from '@supabase/supabase-js'

// 빌드 시 환경변수(.env 또는 GitHub Actions 변수)에서 주입
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = () => Boolean(url && anonKey)

export const supabase = isSupabaseConfigured()
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export const SUPABASE_URL = url || ''
export const SUPABASE_ANON_KEY = anonKey || ''
