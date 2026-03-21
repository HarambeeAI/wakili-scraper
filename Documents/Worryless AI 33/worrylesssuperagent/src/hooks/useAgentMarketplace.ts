import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface CatalogAgent {
  id: string;
  display_name: string;
  description: string;
  skill_config: unknown;
}

interface UserAgentRow {
  agent_type_id: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface UseAgentMarketplaceProps {
  userId: string;
  onAgentChange: () => void;
}

interface UseAgentMarketplaceReturn {
  catalog: CatalogAgent[];
  activeIds: Set<string>;
  activateAgent: (agentTypeId: string) => Promise<void>;
  deactivateAgent: (agentTypeId: string) => Promise<void>;
  isLoading: boolean;
  isLoadingId: string | null;
}

export function useAgentMarketplace({
  userId,
  onAgentChange,
}: UseAgentMarketplaceProps): UseAgentMarketplaceReturn {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Store onAgentChange in a ref to avoid stale closure in async callbacks
  const onAgentChangeRef = useRef(onAgentChange);
  useEffect(() => {
    onAgentChangeRef.current = onAgentChange;
  }, [onAgentChange]);

  const { data: catalogData = [], isLoading: catalogLoading } = useQuery<CatalogAgent[]>({
    queryKey: ['agent-types'],
    queryFn: () => api.get<CatalogAgent[]>('/api/agent-types', { token }),
    enabled: !!userId && !!token,
  });

  const { data: userAgentsData = [], isLoading: userAgentsLoading } = useQuery<UserAgentRow[]>({
    queryKey: ['user-agents', userId],
    queryFn: () => api.get<UserAgentRow[]>('/api/user-agents', { token }),
    enabled: !!userId && !!token,
  });

  const isLoading = catalogLoading || userAgentsLoading;
  const catalog = catalogData;
  const activeIds = new Set(
    userAgentsData.filter((a) => a.is_active).map((a) => a.agent_type_id),
  );

  const activateMutation = useMutation({
    mutationFn: async (agentTypeId: string) => {
      // Check if user agent already exists (may just be inactive)
      const existing = userAgentsData.find((a) => a.agent_type_id === agentTypeId);
      if (existing) {
        // Re-activate with PATCH
        return api.patch(`/api/user-agents/${agentTypeId}`, { is_active: true }, { token });
      }
      // Create new via POST
      return api.post('/api/user-agents', { agent_type_id: agentTypeId, is_active: true }, { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-agents', userId] });
      toast.success('Agent added to your team');
      onAgentChangeRef.current();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('23505') || msg.includes('duplicate')) {
        toast.error('Agent already in your team');
      } else {
        toast.error('Failed to add agent');
      }
      console.error('[useAgentMarketplace] activateAgent error:', err);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (agentTypeId: string) =>
      api.patch(`/api/user-agents/${agentTypeId}`, { is_active: false }, { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-agents', userId] });
      toast.success('Agent removed from team');
      onAgentChangeRef.current();
    },
    onError: (err: unknown) => {
      toast.error('Failed to remove agent');
      console.error('[useAgentMarketplace] deactivateAgent error:', err);
    },
  });

  const activateAgent = useCallback(
    async (agentTypeId: string) => {
      await activateMutation.mutateAsync(agentTypeId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, token],
  );

  const deactivateAgent = useCallback(
    async (agentTypeId: string) => {
      await deactivateMutation.mutateAsync(agentTypeId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, token],
  );

  // Determine isLoadingId from active mutations
  const isLoadingId =
    activateMutation.isPending
      ? (activateMutation.variables as string) ?? null
      : deactivateMutation.isPending
        ? (deactivateMutation.variables as string) ?? null
        : null;

  return {
    catalog,
    activeIds,
    activateAgent,
    deactivateAgent,
    isLoading,
    isLoadingId,
  };
}
