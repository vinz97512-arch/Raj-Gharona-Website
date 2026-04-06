import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// This checks if the keys are missing and gives a clear error in the terminal
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables! Please check your .env.local file.')
}

// Now TypeScript knows for a fact that these are valid strings, and the red line will vanish
export const supabase = createClient(supabaseUrl, supabaseAnonKey)