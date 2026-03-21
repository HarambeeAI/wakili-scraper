import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// TODO: regenerate types after Phase 1 migrations applied — user_agents heartbeat columns not in generated types

export interface HeartbeatConfig {
  heartbeat_enabled: boolean;
  heartbeat_interval_hours: 1 | 2 | 4 | 8;
  heartbeat_active_hours_start: string; // "HH:MM"
  heartbeat_active_hours_end: string;   // "HH:MM"
}

export function useHeartbeatConfig(agentTypeId: string): {
  config: HeartbeatConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  updateConfig: (patch: Partial<HeartbeatConfig>) => Promise<void>;
} {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: config = null, isLoading } = useQuery<HeartbeatConfig | null>({
    queryKey: ['heartbeat', agentTypeId],
    queryFn: () =>
      api.get<HeartbeatConfig>(`/api/user-agents/${agentTypeId}/heartbeat`, { token }),
    enabled: !!token && !!agentTypeId,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<HeartbeatConfig>) =>
      api.patch(`/api/user-agents/${agentTypeId}/heartbeat`, patch, { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heartbeat', agentTypeId] });
    },
  });

  const updateConfig = useCallback(
    async (patch: Partial<HeartbeatConfig>) => {
      await mutation.mutateAsync(patch);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentTypeId, token],
  );

  return {
    config,
    isLoading,
    isSaving: mutation.isPending,
    updateConfig,
  };
}
