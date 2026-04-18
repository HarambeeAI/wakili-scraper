"use client";

import { useState } from "react";
import type {
  WizardQuestion,
  WizardAnswers,
  SocialPlatform,
} from "@/types/calendar";

interface QuestionCardProps {
  questions: WizardQuestion[];
  wizardId: string;
  onSubmit: (answers: WizardAnswers) => void;
  disabled?: boolean;
}

const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; bg: string }
> = {
  instagram: { label: "Instagram", bg: "bg-gradient-to-br from-pink-500 to-purple-600" },
  tiktok: { label: "TikTok", bg: "bg-black" },
  linkedin: { label: "LinkedIn", bg: "bg-blue-600" },
  facebook: { label: "Facebook", bg: "bg-blue-500" },
  x: { label: "X", bg: "bg-black" },
  youtube: { label: "YouTube", bg: "bg-red-600" },
};

const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "linkedin", "facebook", "x", "youtube"];

export default function QuestionCard({
  questions,
  wizardId: _wizardId,
  onSubmit,
  disabled = false,
}: QuestionCardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({
    platforms: [],
    frequency: {} as Record<SocialPlatform, string>,
  });
  const [contentGoals, setContentGoals] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const totalSteps = questions.length;
  const currentQuestion = questions[step];
  // step === totalSteps means we're on the review screen
  const isReview = step === totalSteps;

  if (submitted) {
    return (
      <div className="ml-9 max-w-[560px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center gap-2.5">
        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[13.5px] text-muted-dark">
          Preferences submitted &mdash; generating your calendar&hellip;
        </span>
      </div>
    );
  }

  function togglePlatform(platform: SocialPlatform) {
    setAnswers((prev) => {
      const has = prev.platforms.includes(platform);
      const platforms = has
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform];
      const frequency = { ...prev.frequency };
      if (has) delete frequency[platform];
      return { ...prev, platforms, frequency };
    });
  }

  function toggleGoal(goal: string) {
    setContentGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  }

  function setFrequency(platform: SocialPlatform, value: string) {
    setAnswers((prev) => ({
      ...prev,
      frequency: { ...prev.frequency, [platform]: value },
    }));
  }

  function canProceed(): boolean {
    if (!currentQuestion) return true;
    if (currentQuestion.id === "platforms") return answers.platforms.length > 0;
    if (currentQuestion.id === "frequency") {
      return answers.platforms.every((p) => answers.frequency[p]);
    }
    if (currentQuestion.id === "contentGoals") return contentGoals.length > 0;
    return true; // text fields are optional
  }

  function handleNext() {
    if (!canProceed() || disabled) return;
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleSubmit() {
    if (disabled) return;
    setSubmitted(true);
    onSubmit({
      ...answers,
      contentGoals: contentGoals.join(", ") || undefined,
      additionalContext: additionalContext || undefined,
    });
  }

  // --- Review screen ---
  if (isReview) {
    return (
      <div className="ml-9 max-w-[560px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#e3e3e8]">
          <h3 className="text-[14px] font-semibold text-dark leading-tight">
            Review Your Preferences
          </h3>
          <p className="text-[12px] text-muted mt-0.5">
            Here&apos;s what I&apos;ll use to build your calendar
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Platforms */}
          <div>
            <p className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1.5">Platforms</p>
            <div className="flex flex-wrap gap-1.5">
              {answers.platforms.map((p) => {
                const meta = PLATFORM_META[p];
                return (
                  <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border border-[#e3e3e8] bg-light text-dark">
                    <span className={`w-2.5 h-2.5 rounded-[2px] ${meta.bg}`} />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <p className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1.5">Posting Frequency</p>
            <div className="space-y-1">
              {answers.platforms.map((p) => {
                const meta = PLATFORM_META[p];
                return (
                  <div key={p} className="flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-1.5 text-dark">
                      <span className={`w-2.5 h-2.5 rounded-[2px] ${meta.bg}`} />
                      {meta.label}
                    </span>
                    <span className="text-muted-dark font-medium">{answers.frequency[p]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Goals */}
          {contentGoals.length > 0 && (
            <div>
              <p className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1.5">Content Goals</p>
              <div className="flex flex-wrap gap-1.5">
                {contentGoals.map((g) => (
                  <span key={g} className="px-2.5 py-1 rounded-full text-[12px] font-medium border border-[#e3e3e8] bg-light text-dark capitalize">
                    {g.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional context */}
          {additionalContext && (
            <div>
              <p className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1.5">Additional Context</p>
              <p className="text-[12.5px] text-dark leading-relaxed">{additionalContext}</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 flex gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 py-2 rounded-lg text-[13px] font-medium text-muted-dark border border-[#e3e3e8] hover:bg-light transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleSubmit}
            className="flex-[2] py-2 rounded-lg text-[13px] font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Create My Calendar
          </button>
        </div>
      </div>
    );
  }

  // --- Individual question card ---
  return (
    <div className="ml-9 max-w-[560px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Progress */}
      <div className="px-5 pt-4 pb-3 border-b border-[#e3e3e8]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-dark leading-tight">
            Content Calendar Setup
          </h3>
          <span className="text-[11px] text-muted font-medium">
            {step + 1} of {totalSteps}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-[#f0f0f3] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-[13.5px] font-medium text-dark mb-3">
          {currentQuestion.question}
        </p>

        {/* --- Platforms (multi_select with id=platforms) --- */}
        {currentQuestion.id === "platforms" && currentQuestion.options && (
          <div className="flex flex-wrap gap-2">
            {currentQuestion.options.map((opt) => {
              const platform = opt.value as SocialPlatform;
              const meta = PLATFORM_META[platform];
              const selected = answers.platforms.includes(platform);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => togglePlatform(platform)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-medium border transition-all ${
                    selected
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-[#e3e3e8] text-muted-dark hover:border-gray-300 hover:bg-light/50"
                  }`}
                >
                  {meta && (
                    <span className={`w-4 h-4 rounded-[4px] ${meta.bg} flex-shrink-0`} />
                  )}
                  {opt.label}
                  {opt.recommended && (
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-px rounded-full">
                      Recommended
                    </span>
                  )}
                  {selected && (
                    <svg className="w-3.5 h-3.5 text-primary ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* --- Frequency grid --- */}
        {currentQuestion.id === "frequency" &&
          answers.platforms.length > 0 &&
          currentQuestion.frequencyOptions && (
            <div className="space-y-3">
              {answers.platforms.map((platform) => {
                const meta = PLATFORM_META[platform];
                return (
                  <div key={platform}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`w-3 h-3 rounded-[3px] ${meta.bg}`} />
                      <span className="text-[12.5px] text-dark font-medium">
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentQuestion.frequencyOptions!.map((opt) => {
                        const chosen = answers.frequency[platform] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => setFrequency(platform, opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium border transition-all ${
                              chosen
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-[#e3e3e8] text-muted-dark hover:border-gray-300"
                            }`}
                          >
                            {opt.label}
                            {opt.recommended && (
                              <span className="ml-1 text-[9px] text-amber-500 font-semibold">Recommended</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        {/* --- Content goals (multi_select with id=contentGoals) --- */}
        {currentQuestion.id === "contentGoals" && currentQuestion.options && (
          <div className="flex flex-wrap gap-2">
            {currentQuestion.options.map((opt) => {
              const selected = contentGoals.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleGoal(opt.value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium border transition-all ${
                    selected
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-[#e3e3e8] text-muted-dark hover:border-gray-300 hover:bg-light/50"
                  }`}
                >
                  {opt.label}
                  {opt.recommended && (
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-px rounded-full">
                      Recommended
                    </span>
                  )}
                  {selected && (
                    <svg className="w-3.5 h-3.5 text-primary ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* --- Text input (additionalContext) --- */}
        {currentQuestion.type === "text" && (
          <textarea
            disabled={disabled}
            rows={3}
            placeholder="Share any additional context..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            className="w-full rounded-xl border border-[#e3e3e8] bg-light px-3.5 py-2.5 text-[13px] text-dark placeholder:text-muted resize-none focus:outline-none focus:border-primary/40 transition-colors"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="px-5 pb-4 flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-dark border border-[#e3e3e8] hover:bg-light transition-colors"
          >
            Back
          </button>
        )}
        <button
          type="button"
          disabled={!canProceed() || disabled}
          onClick={handleNext}
          className="flex-1 py-2 rounded-lg text-[13px] font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {step === totalSteps - 1 ? "Review" : "Continue"}
        </button>
      </div>
    </div>
  );
}
