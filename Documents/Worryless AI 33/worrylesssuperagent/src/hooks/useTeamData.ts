import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface TeamAgent {
  agentTypeId: string;
  displayName: string;
  description: string;
  isActive: boolean;
  lastHeartbeatAt: string | null;
  lastHeartbeatOutcome: string | null;
  taskCount7d: number;
}

export function useTeamData(userId: string | undefined): {
  chiefOfStaff: TeamAgent | null;
  otherAgents: TeamAgent[];
  loading: boolean;
} {
  const { token } = useAuth();

  const { data, isLoading: loading } = useQuery<TeamAgent[]>({
    queryKey: ["team-data", userId],
    queryFn: () => api.get<TeamAgent[]>("/api/team-data", { token }),
    enabled: !!userId && !!token,
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const agents = data ?? [];
  const chiefOfStaff =
    agents.find((a) => a.agentTypeId === "chief_of_staff") || null;
  const otherAgents = agents.filter((a) => a.agentTypeId !== "chief_of_staff");

  return { chiefOfStaff, otherAgents, loading };
}
