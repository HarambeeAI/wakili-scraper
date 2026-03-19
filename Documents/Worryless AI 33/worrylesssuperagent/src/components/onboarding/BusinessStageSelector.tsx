import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BusinessStageSelectorProps {
  value: string;
  onSelect: (stage: "starting" | "running" | "scaling") => void;
}

const STAGES = [
  {
    value: "starting" as const,
    label: "Starting",
    description:
      "Just getting started -- building my first product or service",
  },
  {
    value: "running" as const,
    label: "Running",
    description: "Operating -- have customers, need to manage and grow",
  },
  {
    value: "scaling" as const,
    label: "Scaling",
    description: "Growing fast -- multiple team members, higher complexity",
  },
];

export function BusinessStageSelector({
  value,
  onSelect,
}: BusinessStageSelectorProps) {
  return (
    <div className="w-full max-w-[480px] mx-auto">
      <h2 className="text-[28px] font-semibold leading-[1.1]">
        What stage is your business at?
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        We'll build the right AI team and workflow for your stage.
      </p>
      <div role="radiogroup" className="mt-6 space-y-2">
        {STAGES.map((stage) => (
          <button
            key={stage.value}
            role="radio"
            aria-checked={value === stage.value}
            onClick={() => onSelect(stage.value)}
            className={cn(
              "w-full border-2 rounded-lg p-4 text-left transition-colors relative",
              value === stage.value
                ? "border-primary"
                : "border-border hover:border-primary/50",
            )}
          >
            <span className="text-sm font-semibold">{stage.label}</span>
            <p className="text-xs text-muted-foreground mt-1">
              {stage.description}
            </p>
            {value === stage.value && (
              <Check className="absolute top-4 right-4 h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
