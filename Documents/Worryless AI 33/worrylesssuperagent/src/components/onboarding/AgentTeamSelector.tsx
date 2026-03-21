import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, CheckCircle2, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_AGENT_IDS = [
  "chief_of_staff",
  "accountant",
  "marketer",
  "sales_rep",
  "personal_assistant",
];

interface AgentRecommendation {
  agent_type_id: string;
  display_name: string;
  description: string;
  skill_config: string[];
  reasoning?: string;
  first_week_value?: string;
  isDefault: boolean;
  isRecommended: boolean;
}

interface AgentTeamSelectorProps {
  businessName: string;
  industry: string;
  description: string;
  location: string;
  onAccept: (selectedIds: Set<string>) => void;
  isAccepting: boolean;
}

export const AgentTeamSelector = ({
  businessName,
  industry,
  description,
  location,
  onAccept,
  isAccepting,
}: AgentTeamSelectorProps) => {
  const { token } = useAuth();
  const [agents, setAgents] = useState<AgentRecommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      setFetchError(false);

      try {
        const data = await api.post<{
          recommendations?: { agent_type_id: string; reasoning?: string; first_week_value?: string }[];
          allAgents?: { id: string; display_name: string; description: string; skill_config: string[] }[];
        }>("/api/spawn-agent-team", { businessName, industry, description, location }, { token });

        if (cancelled) return;

        const recommendedIds = new Set<string>(
          (data?.recommendations ?? []).map(
            (r: { agent_type_id: string }) => r.agent_type_id,
          ),
        );

        const recommendationMap: Record<
          string,
          { reasoning: string; first_week_value: string }
        > = {};
        for (const r of data?.recommendations ?? []) {
          recommendationMap[r.agent_type_id] = {
            reasoning: r.reasoning ?? "",
            first_week_value: r.first_week_value ?? "",
          };
        }

        const allAgentRows: {
          id: string;
          display_name: string;
          description: string;
          skill_config: string[];
        }[] = data?.allAgents ?? [];

        const merged: AgentRecommendation[] = allAgentRows.map((a) => ({
          agent_type_id: a.id,
          display_name: a.display_name,
          description: a.description,
          skill_config: a.skill_config ?? [],
          isDefault: DEFAULT_AGENT_IDS.includes(a.id),
          isRecommended: recommendedIds.has(a.id),
          reasoning: recommendationMap[a.id]?.reasoning,
          first_week_value: recommendationMap[a.id]?.first_week_value,
        }));

        // Sort: defaults first, then recommended, then rest
        merged.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          if (a.isRecommended && !b.isRecommended) return -1;
          if (!a.isRecommended && b.isRecommended) return 1;
          return a.display_name.localeCompare(b.display_name);
        });

        const preSelected = new Set<string>(
          merged
            .filter((a) => a.isRecommended && !a.isDefault)
            .map((a) => a.agent_type_id),
        );

        if (!cancelled) {
          setAgents(merged);
          setSelectedIds(preSelected);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("spawn-agent-team fetch error:", err);
          setFetchError(true);
          setAgents([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [businessName, industry, description, location, token]);

  const toggleAgent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const defaultAgents = agents.filter((a) => a.isDefault);
  const recommendedAgents = agents.filter(
    (a) => a.isRecommended && !a.isDefault,
  );
  const remainingAgents = agents.filter(
    (a) => !a.isDefault && !a.isRecommended,
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            <span>Step 12 of 12</span>
          </div>
          <h2 className="text-2xl font-semibold">Building your AI team...</h2>
          <p className="text-muted-foreground">
            Finding the best agents for {businessName}
          </p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Users className="h-4 w-4" />
          <span>Step 12 of 12</span>
        </div>
        <h2 className="text-2xl font-semibold">Your AI Team</h2>
        <p className="text-muted-foreground">
          Review your recommended team for {businessName}
        </p>
        {fetchError && (
          <p className="text-sm text-amber-500">
            Could not load personalized recommendations. Your core team is ready
            to go.
          </p>
        )}
      </div>

      <ScrollArea className="h-[420px] pr-3">
        <div className="space-y-5">
          {/* Section 1: Core Team */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Your Core Team (always included)
              </span>
            </div>
            <div className="space-y-2">
              {defaultAgents.map((agent) => (
                <Card
                  key={agent.agent_type_id}
                  className="border-border/50 bg-muted/30"
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {agent.display_name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          Included
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {agent.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 2: Recommended */}
          {recommendedAgents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-500 uppercase tracking-wide">
                  Recommended for {businessName}
                </span>
              </div>
              <div className="space-y-2">
                {recommendedAgents.map((agent) => (
                  <Card
                    key={agent.agent_type_id}
                    className={cn(
                      "border-border cursor-pointer transition-colors",
                      selectedIds.has(agent.agent_type_id)
                        ? "border-primary bg-primary/5"
                        : "hover:border-border/80",
                    )}
                    onClick={() => toggleAgent(agent.agent_type_id)}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(agent.agent_type_id)}
                        onCheckedChange={() => toggleAgent(agent.agent_type_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {agent.display_name}
                          </span>
                          <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                            Recommended
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {agent.description}
                        </p>
                        {agent.reasoning && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {agent.reasoning}
                          </p>
                        )}
                        {agent.first_week_value && (
                          <p className="text-xs text-primary mt-1">
                            First week: {agent.first_week_value}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Rest of catalog */}
          {remainingAgents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Add more to your team
                </span>
              </div>
              <div className="space-y-2">
                {remainingAgents.map((agent) => (
                  <Card
                    key={agent.agent_type_id}
                    className={cn(
                      "border-border cursor-pointer transition-colors",
                      selectedIds.has(agent.agent_type_id)
                        ? "border-primary bg-primary/5"
                        : "hover:border-border/80",
                    )}
                    onClick={() => toggleAgent(agent.agent_type_id)}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(agent.agent_type_id)}
                        onCheckedChange={() => toggleAgent(agent.agent_type_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">
                          {agent.display_name}
                        </span>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {agent.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <Button
        onClick={() => onAccept(selectedIds)}
        disabled={isAccepting}
        className="w-full h-12"
      >
        {isAccepting ? (
          <>
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
            Setting up your team...
          </>
        ) : (
          "Accept Suggested Team"
        )}
      </Button>
    </div>
  );
};
