import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Campaign {
  id: string
  name: string
  instructions: string
  created_at: string
  approval_completed: boolean
  approval_completed_at: string | null
}

export interface Post {
  id: string
  campaign_id: string
  filename: string
  url: string
  approved: boolean | null
  comments: string | null
  created_at: string
} 