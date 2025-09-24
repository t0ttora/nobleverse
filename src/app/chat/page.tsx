'use client';
import { useEffect, useMemo, useState } from 'react';
import { RealtimeChat } from '@/components/realtime-chat';
import { supabase } from '@/lib/supabaseClient';

export default function ChatDemoPage() {
  const [nobleId, setNobleId] = useState<string>('guest');
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('username,email,display_name')
        .eq('id', uid)
        .single();
      if (!active) return;
      const u =
        (profile?.username as string) ||
        (profile?.email
          ? (profile.email as string).split('@')[0]
          : (profile?.display_name as string) || 'user');
      setNobleId(u);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Simple shared room name; replace with dynamic route or per-room id
  const roomName = useMemo(() => 'global-chat', []);

  return (
    <div className='h-[calc(100vh-64px)] p-4'>
      <RealtimeChat roomName={roomName} nobleId={nobleId} />
    </div>
  );
}
