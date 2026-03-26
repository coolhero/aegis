// T034: SSE hook — subscribe to realtime events
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SSEClient, SSEStatus } from '@/lib/sse-client';
import { useAuth } from './use-auth';
import type { RequestCompletedEvent, BudgetAlertEvent } from '@/types/api';

interface SSEMessage {
  type: string;
  data: RequestCompletedEvent | BudgetAlertEvent;
  timestamp: string;
}

export function useSSE() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const [feed, setFeed] = useState<SSEMessage[]>([]);
  const clientRef = useRef<SSEClient | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const message: SSEMessage = {
          type: event.type || 'message',
          data,
          timestamp: new Date().toISOString(),
        };

        setFeed((prev) => [message, ...prev].slice(0, 50)); // Keep last 50

        // Invalidate relevant queries on new data
        if (event.type === 'request_completed') {
          queryClient.invalidateQueries({ queryKey: ['usage'] });
          queryClient.invalidateQueries({ queryKey: ['logs'] });
        } else if (event.type === 'budget_alert') {
          queryClient.invalidateQueries({ queryKey: ['budget'] });
        }
      } catch {
        // Ignore parse errors
      }
    },
    [queryClient],
  );

  useEffect(() => {
    if (!accessToken) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const client = new SSEClient({
      url: `${apiUrl}/events/stream`,
      token: accessToken,
      onMessage: handleMessage,
      onStatusChange: setStatus,
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [accessToken, handleMessage]);

  const reconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current?.connect();
  }, []);

  return {
    status,
    feed,
    reconnect,
    isConnected: status === 'connected',
  };
}
