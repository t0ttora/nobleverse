'use client';
import { supabase } from '@/../utils/supabase/client';

export async function ensureProfileClient() {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;
  const usernameBase = (user.email?.split('@')[0] || user.id).toLowerCase();
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle();
  if (existing) return existing;
  const payload = {
    id: user.id,
    username: usernameBase,
    display_name: (user.user_metadata as any)?.full_name || usernameBase,
    role: 'other',
    onboarding_completed: false,
    email: user.email,
    avatar_url: (user.user_metadata as any)?.avatar_url || null,
    banner_url: null,
    bio: null,
    company_name: null,
    website: null,
    location: null,
    phone: null,
    noble_score: null,
    completed_requests: 0,
    completed_shipments: 0,
    average_rating: null,
    details: {},
    last_active_at: new Date().toISOString()
  };
  const { data } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, username')
    .single();
  return data;
}
