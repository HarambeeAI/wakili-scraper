import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeWorkspaceContent } from "@/lib/sanitize";
import type { WorkspaceFileType } from "@/lib/buildWorkspacePrompt";

// TODO: regenerate types after Phase 1 migrations applied — see RESEARCH.md Pitfall 4

interface WorkspaceRow {
  content: string;
  [key: string]: unknown;
}

interface AgentTypeRow {
  id: string;
  [key: string]: unknown;
}

interface UseAgentWorkspaceParams {
  userId: string;
  agentTypeId: string;
  fileType: WorkspaceFileType;
}

export function useAgentWorkspace({
  userId,
  agentTypeId,
  fileType,
}: UseAgentWorkspaceParams): {
  content: string;
  setContent: (v: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  handleChange: (v: string) => void;
  handleReset: () => Promise<void>;
} {
  const { token } = useAuth();
  const [content, setContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const contentRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: workspaceRow, isLoading } = useQuery<WorkspaceRow | null>({
    queryKey: ['workspace', agentTypeId, fileType],
    queryFn: () =>
      api.get<WorkspaceRow | null>(`/api/workspaces/${agentTypeId}/${fileType}`, { token }),
    enabled: !!userId && !!token && !!agentTypeId && !!fileType,
  });

  // Sync fetched content into local state
  useEffect(() => {
    const loaded = workspaceRow?.content ?? "";
    setContent(loaded);
    contentRef.current = loaded;
  }, [workspaceRow]);

  const saveMutation = useMutation({
    mutationFn: (valueToSave: string) => {
      const sanitized = sanitizeWorkspaceContent(valueToSave);
      return api.patch(
        `/api/workspaces/${agentTypeId}/${fileType}`,
        { content: sanitized },
        { token },
      );
    },
  });

  const save = useCallback(
    async (valueToSave: string) => {
      setIsSaving(true);
      try {
        await saveMutation.mutateAsync(valueToSave);
      } finally {
        setIsSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentTypeId, fileType, token],
  );

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // fire-and-forget flush using ref value (not stale closure)
        save(contentRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (v: string) => {
      setContent(v);
      contentRef.current = v;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        save(v);
      }, 2000);
    },
    [save],
  );

  const handleReset = useCallback(async () => {
    // Fetch agent type defaults from /api/agent-types
    const agentTypes = await api.get<AgentTypeRow[]>('/api/agent-types', { token });
    const agentType = agentTypes.find((at) => at.id === agentTypeId);
    const columnKey = `default_${fileType.toLowerCase()}_md`;
    const defaultContent = agentType ? ((agentType as Record<string, string>)[columnKey] ?? "") : "";

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setContent(defaultContent);
    contentRef.current = defaultContent;
    await save(defaultContent);
  }, [agentTypeId, fileType, token, save]);

  return {
    content,
    setContent,
    isLoading,
    isSaving,
    handleChange,
    handleReset,
  };
}
