'use client';
import * as React from 'react';
import type { ContactListItem } from '@/lib/contacts';
import { ContactCard } from './contact-card';
import { ContactPanel } from './contact-panel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/../utils/supabase/client';
import { toast } from 'sonner';

export interface ContactsGridProps {
  people: ContactListItem[];
  onContact?: (userId: string) => void;
  onMessage?: (userId: string) => void;
}

export function ContactsGrid({
  people,
  onContact,
  onMessage
}: ContactsGridProps) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<ContactListItem | null>(null);
  const [relationship, setRelationship] = React.useState<
    'connected' | 'pending_out' | 'pending_in' | 'none'
  >('none');

  async function computeRelationship(person: ContactListItem) {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return 'none' as const;
    const [{ data: contacts }, { data: outReq }, { data: inReq }] =
      await Promise.all([
        supabase
          .from('contacts')
          .select('id')
          .eq('user_id', me)
          .eq('contact_id', person.id)
          .limit(1),
        supabase
          .from('contact_requests')
          .select('id')
          .eq('requester_id', me)
          .eq('receiver_id', person.id)
          .eq('status', 'pending')
          .limit(1),
        supabase
          .from('contact_requests')
          .select('id')
          .eq('requester_id', person.id)
          .eq('receiver_id', me)
          .eq('status', 'pending')
          .limit(1)
      ]);
    // Prefer pending status over contacts row to reflect true state
    if (outReq && outReq.length) return 'pending_out' as const;
    if (inReq && inReq.length) return 'pending_in' as const;
    if (contacts && contacts.length) return 'connected' as const;
    return 'none' as const;
  }

  return (
    <div className='relative'>
      <ScrollArea className='h-[calc(100vh-220px)] w-full pr-2'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
          {people.map((p) => (
            <ContactCard
              key={p.id}
              person={p}
              onOpen={async (x) => {
                setActive(x);
                setOpen(true);
                const rel = await computeRelationship(x);
                setRelationship(rel);
              }}
            />
          ))}
        </div>
      </ScrollArea>
      <ContactPanel
        open={open}
        onOpenChange={setOpen}
        person={active}
        relationship={relationship}
        onContact={async (id) => {
          setRelationship('pending_out');
          await onContact?.(id);
        }}
        onMessage={onMessage}
        onAccept={async () => {
          if (!active) return;
          const { data: auth } = await supabase.auth.getUser();
          const me = auth.user?.id;
          if (!me) return;
          // Find pending_in request
          const { data: req } = await supabase
            .from('contact_requests')
            .select('id')
            .eq('requester_id', active.id)
            .eq('receiver_id', me)
            .eq('status', 'pending')
            .maybeSingle();
          if (!req) return;
          const up = await supabase
            .from('contact_requests')
            .update({ status: 'accepted' })
            .eq('id', req.id);
          if (!up.error) {
            await supabase
              .from('contacts')
              .upsert(
                { user_id: me, contact_id: active.id },
                { onConflict: 'user_id,contact_id' }
              );
            await supabase
              .from('contacts')
              .upsert(
                { user_id: active.id, contact_id: me },
                { onConflict: 'user_id,contact_id' }
              );
            // Archive any related incoming contact_request notifications for me from this user
            const { data: notifs } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', me)
              .eq('actor_id', active.id)
              .eq('type', 'contact_request')
              .is('archived_at', null);
            const ids = (notifs || []).map((n: any) => n.id);
            if (ids.length) {
              await supabase
                .from('notifications')
                .update({
                  archived_at: new Date().toISOString(),
                  read_at: new Date().toISOString()
                })
                .in('id', ids);
            }
            // Notify the requester that their request was accepted
            const { data: authUser } = await supabase.auth.getUser();
            const display = (authUser.user?.user_metadata?.full_name ||
              authUser.user?.user_metadata?.name ||
              (authUser.user?.email || '').split('@')[0] ||
              'Someone') as string;
            await supabase.from('notifications').insert({
              user_id: active.id,
              actor_id: me,
              type: 'contact_accept',
              title: `${display} accepted your connection request.`,
              category: 'inbox',
              data: { kind: 'contact_accept', accepter_id: me }
            });
            toast.success('Contact added');
            setRelationship('connected');
          } else {
            toast.error('Failed to accept');
          }
        }}
      />
    </div>
  );
}
