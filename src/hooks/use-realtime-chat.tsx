'use client';

import { supabase } from '@/lib/supabaseClient';
import { useCallback, useEffect, useState } from 'react';

interface UseRealtimeChatProps {
  roomName: string;
  username: string;
  userId: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  user: {
    id: string;
    name: string;
    avatar_url?: string;
    email?: string;
  };
  createdAt: string;
}

const EVENT_MESSAGE_TYPE = 'message';

export function useRealtimeChat({
  roomName,
  username,
  userId
}: UseRealtimeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channel, setChannel] = useState<ReturnType<
    typeof supabase.channel
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // reset connection state on room change to avoid sending to stale channel
    setIsConnected(false);
    setMessages([]);
    setChannel(null);
    const newChannel = supabase.channel(roomName);

    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        const incoming = payload.payload as ChatMessage;
        setMessages((current) =>
          current.some((m) => m.id === incoming.id)
            ? current
            : [...current, incoming]
        );
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        }
      });

    setChannel(newChannel);

    return () => {
      setIsConnected(false);
      supabase.removeChannel(newChannel);
    };
  }, [roomName]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        content,
        user: {
          id: userId,
          name: username
        },
        createdAt: new Date().toISOString()
      };

      // Update local state immediately for the sender
      setMessages((current) =>
        current.some((m) => m.id === message.id)
          ? current
          : [...current, message]
      );

      await channel.send({
        type: 'broadcast',
        event: EVENT_MESSAGE_TYPE,
        payload: message
      });
    },
    [channel, isConnected, username, userId]
  );

  return { messages, sendMessage, isConnected };
}
