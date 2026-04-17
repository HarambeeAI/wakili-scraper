"use client";

import Button from "@/components/ui/Button";

interface PlatformsStepProps {
  onFinish: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const PLATFORMS = [
  { id: "google_analytics", label: "Google Analytics", icon: "\uD83D\uDCCA" },
  { id: "instagram", label: "Instagram", icon: "\uD83D\uDCF7" },
  { id: "facebook", label: "Facebook", icon: "\uD83D\uDC4D" },
  { id: "linkedin", label: "LinkedIn", icon: "\uD83D\uDCBC" },
  { id: "twitter", label: "X / Twitter", icon: "\uD83D\uDCAC" },
];

export default function PlatformsStep({ onFinish, onBack, isLoading }: PlatformsStepProps) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-dark mb-2">Connect your platforms</h1>
      <p className="text-muted-dark text-sm mb-8">Optional — you can always connect these later</p>

      <div className="space-y-3 mb-8">
        {PLATFORMS.map((platform) => (
          <div key={platform.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-white">
            <div className="flex items-center gap-3">
              <span className="text-xl">{platform.icon}</span>
              <span className="text-sm font-medium text-dark">{platform.label}</span>
            </div>
            <button type="button" className="text-xs font-medium text-primary hover:underline">
              Connect now
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={onFinish} isLoading={isLoading} className="flex-1">Start Analysis</Button>
      </div>

      <button type="button" onClick={onFinish} disabled={isLoading} className="mt-4 text-sm text-muted-dark hover:text-dark transition-colors">
        Skip for now
      </button>
    </div>
  );
}
