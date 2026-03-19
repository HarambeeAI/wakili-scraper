import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCadenceConfig } from "@/hooks/useCadenceConfig";

interface CadenceConfigSectionProps {
  agentTypeId: string;
}

export function CadenceConfigSection({ agentTypeId }: CadenceConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { config, isLoading, isSaving, updateConfig, heartbeatEnabled } = useCadenceConfig(agentTypeId);

  return (
    <div className="border-t">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 transition-colors">
          <span>Cadence Configuration</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="flex flex-col gap-2 p-4 pt-0">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : (
              <>
                {/* Cadence Tiers group */}
                <div className={!heartbeatEnabled ? "opacity-50 pointer-events-none" : ""}>
                  {/* Daily */}
                  <div className="flex items-center justify-between gap-3 min-h-[44px]">
                    <div className="flex flex-col">
                      <Label
                        htmlFor={`cad-daily-${agentTypeId}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Daily checks
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Cashflow, overdue invoices, pipeline review
                      </span>
                    </div>
                    <Switch
                      id={`cad-daily-${agentTypeId}`}
                      checked={config?.daily_enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ daily_enabled: checked })}
                    />
                  </div>

                  {/* Weekly */}
                  <div className="flex items-center justify-between gap-3 min-h-[44px]">
                    <div className="flex flex-col">
                      <Label
                        htmlFor={`cad-weekly-${agentTypeId}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Weekly checks
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        P&L summary, content performance, pipeline progression
                      </span>
                    </div>
                    <Switch
                      id={`cad-weekly-${agentTypeId}`}
                      checked={config?.weekly_enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ weekly_enabled: checked })}
                    />
                  </div>

                  {/* Monthly */}
                  <div className="flex items-center justify-between gap-3 min-h-[44px]">
                    <div className="flex flex-col">
                      <Label
                        htmlFor={`cad-monthly-${agentTypeId}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Monthly checks
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Full P&L report, conversion analysis, marketing review
                      </span>
                    </div>
                    <Switch
                      id={`cad-monthly-${agentTypeId}`}
                      checked={config?.monthly_enabled ?? false}
                      onCheckedChange={(checked) => updateConfig({ monthly_enabled: checked })}
                    />
                  </div>

                  {/* Quarterly */}
                  <div className="flex items-center justify-between gap-3 min-h-[44px]">
                    <div className="flex flex-col">
                      <Label
                        htmlFor={`cad-quarterly-${agentTypeId}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Quarterly checks
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Business review, strategic assessment, compliance
                      </span>
                    </div>
                    <Switch
                      id={`cad-quarterly-${agentTypeId}`}
                      checked={config?.quarterly_enabled ?? false}
                      onCheckedChange={(checked) => updateConfig({ quarterly_enabled: checked })}
                    />
                  </div>

                  {!heartbeatEnabled && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Enable heartbeat checks above to configure cadence.
                    </p>
                  )}
                </div>

                <Separator className="my-2" />

                {/* Event Triggers group */}
                <div className="flex items-center justify-between gap-3 min-h-[44px]">
                  <div className="flex flex-col">
                    <Label
                      htmlFor={`cad-events-${agentTypeId}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Event-triggered alerts
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Immediate alerts for viral posts, overdue invoices, stale deals
                    </span>
                  </div>
                  <Switch
                    id={`cad-events-${agentTypeId}`}
                    checked={config?.event_triggers_enabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ event_triggers_enabled: checked })}
                  />
                </div>

                {/* Cooldown selector — only visible when event triggers enabled */}
                {config?.event_triggers_enabled && (
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`cad-cooldown-${agentTypeId}`}
                      className="text-sm font-normal"
                    >
                      Alert cooldown
                    </Label>
                    <Select
                      value={String(config?.event_cooldown_hours ?? 4)}
                      onValueChange={(v) => updateConfig({ event_cooldown_hours: Number(v) })}
                    >
                      <SelectTrigger id={`cad-cooldown-${agentTypeId}`}>
                        <SelectValue placeholder="Select cooldown" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 hours</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="8">8 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Saving indicator */}
                {isSaving && (
                  <p className="text-xs text-muted-foreground">Saving...</p>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
