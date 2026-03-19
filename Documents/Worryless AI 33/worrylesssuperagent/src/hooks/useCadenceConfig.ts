import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const [config, setConfig] = useState<CadenceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to latest config for use inside debounced closure
  const configRef = useRef<CadenceConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data } = await (supabase as any)
        .from('user_agents')
        .select('cadence_config, heartbeat_enabled')
        .eq('user_id', user.id)
        .eq('agent_type_id', agentTypeId)
        .single();

      if (!cancelled && data) {
        const raw = data.cadence_config ?? {};
        const loaded: CadenceConfig = {
          daily_enabled: raw.daily_enabled ?? DEFAULT_CADENCE_CONFIG.daily_enabled,
          weekly_enabled: raw.weekly_enabled ?? DEFAULT_CADENCE_CONFIG.weekly_enabled,
          monthly_enabled: raw.monthly_enabled ?? DEFAULT_CADENCE_CONFIG.monthly_enabled,
          quarterly_enabled: raw.quarterly_enabled ?? DEFAULT_CADENCE_CONFIG.quarterly_enabled,
          event_triggers_enabled: raw.event_triggers_enabled ?? DEFAULT_CADENCE_CONFIG.event_triggers_enabled,
          event_cooldown_hours: raw.event_cooldown_hours ?? DEFAULT_CADENCE_CONFIG.event_cooldown_hours,
        };
        setConfig(loaded);
        configRef.current = loaded;
        setHeartbeatEnabled(data.heartbeat_enabled ?? true);
      }
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [agentTypeId]);

  const updateConfig = useCallback((patch: Partial<CadenceConfig>) => {
    // Optimistic update
    setConfig(prev => {
      const next = prev ? { ...prev, ...patch } : prev;
      configRef.current = next;
      return next;
    });

    // Debounced save (500ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const currentConfig = configRef.current;
        const { error } = await (supabase as any)
          .from('user_agents')
          .update({ cadence_config: currentConfig })
          .eq('user_id', user.id)
          .eq('agent_type_id', agentTypeId);

        if (error) throw error;
      } catch {
        toast.error('Failed to save cadence settings. Try again.');
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [agentTypeId]);

  return { config, isLoading, isSaving, updateConfig, heartbeatEnabled };
}
