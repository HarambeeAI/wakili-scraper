"use client";

import { useState } from "react";
import type { OnboardingData, Service } from "@/types";

const ALL_SERVICES: Service[] = [
  "social_media",
  "seo",
  "content_writing",
  "email_marketing",
  "paid_ads",
];

export function useOnboarding() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    websiteUrl: "",
    selectedServices: [...ALL_SERVICES],
    connectedPlatforms: [],
  });

  function updateData(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function nextStep() {
    setStep((s) => Math.min(s + 1, 3));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1));
  }

  return { step, data, updateData, nextStep, prevStep };
}
