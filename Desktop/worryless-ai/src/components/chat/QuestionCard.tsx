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
  { label: string; abbr: string; color: string; bg: string }
> = {
  instagram: {
    label: "Instagram",
    abbr: "IG",
    color: "text-pink-600",
    bg: "bg-gradient-to-br from-pink-500 to-purple-600",
  },
  tiktok: {
    label: "TikTok",
    abbr: "TT",
    color: "text-gray-900",
    bg: "bg-black",
  },
  linkedin: {
    label: "LinkedIn",
    abbr: "in",
    color: "text-blue-700",
    bg: "bg-blue-600",
  },
  facebook: {
    label: "Facebook",
    abbr: "fb",
    color: "text-blue-600",
    bg: "bg-blue-500",
  },
  x: {
    label: "X",
    abbr: "X",
    color: "text-gray-900",
    bg: "bg-black",
  },
  youtube: {
    label: "YouTube",
    abbr: "YT",
    color: "text-red-600",
    bg: "bg-red-600",
  },
};

export default function QuestionCard({
  questions,
  wizardId: _wizardId,
  onSubmit,
  disabled = false,
}: QuestionCardProps) {
  const [answers, setAnswers] = useState<WizardAnswers>({
    platforms: [],
    frequency: {} as Record<SocialPlatform, string>,
  });
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="ml-9 max-w-[560px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center gap-2.5">
        <svg
          className="w-5 h-5 text-emerald-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
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

  function setFrequency(platform: SocialPlatform, value: string) {
    setAnswers((prev) => ({
      ...prev,
      frequency: { ...prev.frequency, [platform]: value },
    }));
  }

  function handleSubmit() {
    if (answers.platforms.length === 0 || disabled) return;
    setSubmitted(true);
    onSubmit(answers);
  }

  return (
    <div className="ml-9 max-w-[560px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[#e3e3e8]">
        <h3 className="text-[14px] font-semibold text-dark leading-tight">
          Content Calendar Setup
        </h3>
        <p className="text-[12px] text-muted mt-0.5">
          Help me tailor your calendar perfectly
        </p>
      </div>

      <div className="px-5 py-4 space-y-5">
        {questions.map((q) => (
          <div key={q.id}>
            <p className="text-[13px] font-medium text-dark mb-2">
              {q.question}
            </p>

            {/* multi_select — platform pills */}
            {q.type === "multi_select" && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const meta =
                    PLATFORM_META[opt.value as SocialPlatform] ?? null;
                  const selected = answers.platforms.includes(
                    opt.value as SocialPlatform,
                  );
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        togglePlatform(opt.value as SocialPlatform)
                      }
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-all ${
                        selected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-[#e3e3e8] text-muted-dark hover:border-gray-300"
                      }`}
                    >
                      {meta && (
                        <span
                          className={`w-3 h-3 rounded-[3px] ${meta.bg} flex-shrink-0`}
                        />
                      )}
                      {opt.label}
                      {opt.recommended && (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-px rounded-full ml-1">
                          Recommended
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* frequency_grid */}
            {q.type === "frequency_grid" &&
              answers.platforms.length > 0 &&
              q.frequencyOptions && (
                <div className="space-y-2.5">
                  {answers.platforms.map((platform) => {
                    const meta = PLATFORM_META[platform];
                    return (
                      <div key={platform} className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                          <span
                            className={`w-3 h-3 rounded-[3px] ${meta.bg}`}
                          />
                          <span className="text-[12px] text-dark font-medium truncate">
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {q.frequencyOptions!.map((opt) => {
                            const chosen =
                              answers.frequency[platform] === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  setFrequency(platform, opt.value)
                                }
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                  chosen
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-[#e3e3e8] text-muted-dark hover:border-gray-300"
                                } ${opt.recommended && !chosen ? "ring-1 ring-amber-200" : ""}`}
                              >
                                {opt.label}
                                {opt.recommended && (
                                  <span className="ml-1 text-[8px] text-amber-500">
                                    ★
                                  </span>
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

            {/* text */}
            {q.type === "text" && (
              <textarea
                disabled={disabled}
                rows={3}
                placeholder="Share any additional context..."
                value={
                  ((answers as unknown as Record<string, unknown>)[
                    q.id
                  ] as string) ?? ""
                }
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                className="w-full rounded-lg border border-[#e3e3e8] bg-light px-3 py-2 text-[13px] text-dark placeholder:text-muted resize-none focus:outline-none focus:border-primary/40 transition-colors"
              />
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="px-5 pb-4">
        <button
          type="button"
          disabled={answers.platforms.length === 0 || disabled}
          onClick={handleSubmit}
          className="w-full py-2 rounded-lg text-[13px] font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Create My Calendar
        </button>
      </div>
    </div>
  );
}
