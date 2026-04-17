"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface WebsiteStepProps {
  value: string;
  onChange: (url: string) => void;
  onNext: () => void;
}

export default function WebsiteStep({ value, onChange, onNext }: WebsiteStepProps) {
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const url = value.startsWith("http") ? value : `https://${value}`;
      new URL(url);
      onChange(url);
      onNext();
    } catch {
      setError("Please enter a valid URL");
    }
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-dark mb-2">What&apos;s your website?</h1>
      <p className="text-muted-dark text-sm mb-8">We&apos;ll analyze your brand, market, and competition</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input id="website" type="text" placeholder="https://yourcompany.com" value={value} onChange={(e) => onChange(e.target.value)} error={error} className="text-center" required />
        <Button type="submit" className="w-full">Continue</Button>
      </form>
    </div>
  );
}
