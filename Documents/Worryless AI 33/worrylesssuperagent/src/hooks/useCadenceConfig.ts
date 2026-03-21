import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// TODO: regenerate types after Phase 16 migrations applied — user_agents cadence_config column not in generated types

export interface CadenceConfig {
  daily_enabled: boolean;
  weekly_enabled: boolean;
  monthly_enabled: boolean;
  quarterly_enabled: boolean;
  event_triggers_enabled: boolean;
  event_cooldown_hours: number; // 2 | 4 | 8 | 24
}

interface CadenceResponse {
  cadence_config: CadenceConfig | null;
  heartbeat_enabled: boolean;
}

const DEFAULT_CADENCE_CONFIG: CadenceConfig = {
  daily_enabled: true,
  weekly_enabled: true,
  monthly_enabled: false,
  quarterly_enabled: false,
  event_triggers_enabled: true,
  event_cooldown_hours: 4,
};

export function useCadenceConfig(agentTypeId: string): {
  config: CadenceConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  updateConfig: (patch: Partial<CadenceConfig>) => void;
  heartbeatEnabled: boolean;
} {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<CadenceConfig>>({});

  const { data, isLoading } = useQuery<CadenceResponse>({
    queryKey: ['cadence', agentTypeId],
    queryFn: () =>
      api.get<CadenceResponse>(`/api/user-agents/${agentTypeId}/cadence`, { token }),
    enabled: !!token && !!agentTypeId,
  });

  const raw = data?.cadence_config ?? {};
  const config: CadenceConfig | null = data
    ? {
        daily_enabled: raw.daily_enabled ?? DEFAULT_CADENCE_CONFIG.daily_enabled,
        weekly_enabled: raw.weekly_enabled ?? DEFAULT_CADENCE_CONFIG.weekly_enabled,
        monthly_enabled: raw.monthly_enabled ?? DEFAULT_CADENCE_CONFIG.monthly_enabled,
        quarterly_enabled: raw.quarterly_enabled ?? DEFAULT_CADENCE_CONFIG.quarterly_enabled,
        event_triggers_enabled: raw.event_triggers_enabled ?? DEFAULT_CADENCE_CONFIG.event_triggers_enabled,
        event_cooldown_hours: raw.event_cooldown_hours ?? DEFAULT_CADENCE_CONFIG.event_cooldown_hours,
      }
    : null;

  const heartbeatEnabled = data?.heartbeat_enabled ?? true;

  const mutation = useMutation({
    mutationFn: (patch: Partial<CadenceConfig>) =>
      api.patch(`/api/user-agents/${agentTypeId}/cadence`, { cadence_config: patch }, { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadence', agentTypeId] });
    },
    onError: () => {
      toast.error('Failed to save cadence settings. Try again.');
    },
  });

  const updateConfig = useCallback(
    (patch: Partial<CadenceConfig>) => {
      // Merge patch into pending
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };

      // Optimistic update via query cache
      queryClient.setQueryData<CadenceResponse>(['cadence', agentTypeId], (old) => {
        if (!old) return old;
        const merged = { ...(old.cadence_config ?? {}), ...pendingPatchRef.current };
        return { ...old, cadence_config: merged as CadenceConfig };
      });

      // Debounced save (500ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const toSave = pendingPatchRef.current;
        pendingPatchRef.current = {};
        mutation.mutate(toSave);
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentTypeId, token],
  );

  return {
    config,
    isLoading,
    isSaving: mutation.isPending,
    updateConfig,
    heartbeatEnabled,
  };
}
