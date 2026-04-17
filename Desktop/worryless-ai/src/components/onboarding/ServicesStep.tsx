"use client";

import type { Service } from "@/types";
import Button from "@/components/ui/Button";

interface ServicesStepProps {
  selected: Service[];
  onChange: (services: Service[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const SERVICES: { id: Service; label: string; icon: string }[] = [
  { id: "social_media", label: "Social Media", icon: "\uD83D\uDCF1" },
  { id: "seo", label: "SEO", icon: "\uD83D\uDD0D" },
  { id: "content_writing", label: "Content Writing", icon: "\u270D\uFE0F" },
  { id: "email_marketing", label: "Email Marketing", icon: "\uD83D\uDCE7" },
  { id: "paid_ads", label: "Paid Ads", icon: "\uD83D\uDCE3" },
];

export default function ServicesStep({ selected, onChange, onNext, onBack }: ServicesStepProps) {
  function toggleService(id: Service) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-dark mb-2">What do you need help with?</h1>
      <p className="text-muted-dark text-sm mb-8">Select all that apply. This helps Helena focus on what matters most.</p>

      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3">
        {SERVICES.map((service) => {
          const isSelected = selected.includes(service.id);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleService(service.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 text-dark"
                  : "border-border bg-white text-muted-dark hover:border-muted"
              }`}
            >
              <span className="text-2xl">{service.icon}</span>
              <span className="text-sm font-medium">{service.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={onNext} disabled={selected.length === 0} className="flex-1">Continue</Button>
      </div>
    </div>
  );
}
