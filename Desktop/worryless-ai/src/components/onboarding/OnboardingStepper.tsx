"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/hooks/useOnboarding";
import Stepper from "@/components/ui/Stepper";
import WebsiteStep from "./WebsiteStep";
import ServicesStep from "./ServicesStep";
import PlatformsStep from "./PlatformsStep";

export default function OnboardingStepper() {
  const router = useRouter();
  const { step, data, updateData, nextStep, prevStep } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFinish() {
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: data.websiteUrl,
          selectedServices: data.selectedServices,
        }),
      });

      if (!res.ok) throw new Error("Failed to start agent");

      const { runId, orgSlug } = await res.json();
      router.push(`/app/${orgSlug}/chat?runId=${runId}`);
    } catch (error) {
      console.error("Onboarding error:", error);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white rounded-2xl section-card p-8">
        <div className="flex justify-center">
          <Stepper currentStep={step} totalSteps={3} />
        </div>

        {step === 1 && (
          <WebsiteStep
            value={data.websiteUrl}
            onChange={(url) => updateData({ websiteUrl: url })}
            onNext={nextStep}
          />
        )}

        {step === 2 && (
          <ServicesStep
            selected={data.selectedServices}
            onChange={(services) => updateData({ selectedServices: services })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {step === 3 && (
          <PlatformsStep
            onFinish={handleFinish}
            onBack={prevStep}
            isLoading={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
