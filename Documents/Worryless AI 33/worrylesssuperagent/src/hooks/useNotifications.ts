import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// TODO: regenerate types after Phase 1 migrations applied — notifications table not in generated types

export interface Notification {
  id: string;
  user_id: string;
  agent_type_id: string;
  severity: 'urgent' | 'headsup' | 'digest';
  message: string;
  is_read: boolean;
  link_type: string;
  created_at: string;
}

const LEGACY_VIEW_MAP: Record<string, string> = {
  chief_of_staff: 'chat',
  personal_assistant: 'assistant',
  accountant: 'accountant',
  marketer: 'marketer',
  sales_rep: 'sales',
};

export function useNotifications(userId: string | undefined): {
  unreadCount: number;
  notifications: Notification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  resolveView: (agentTypeId: string) => string;
} {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', userId],
    queryFn: () => api.get<Notification[]>('/api/notifications', { token }),
    enabled: !!userId && !!token,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/notifications/${id}`, { is_read: true }, { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      api.post('/api/notifications/mark-all-read', {}, { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const markRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, userId],
  );

  const markAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  const resolveView = useCallback((agentTypeId: string): string => {
    return LEGACY_VIEW_MAP[agentTypeId] ?? `agent:${agentTypeId}`;
  }, []);

  return { unreadCount, notifications, markRead, markAllRead, resolveView };
}
