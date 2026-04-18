"use client";

import { useEffect, useRef } from "react";
import type { ChatMessageData } from "@/types";
import type { WizardAnswers } from "@/types/calendar";
import ChatMessage from "./ChatMessage";
import StatusIndicator from "./StatusIndicator";
import AgentAvatar from "./AgentAvatar";

interface ChatMessagesProps {
  messages: ChatMessageData[];
  status: string | null;
  onWizardSubmit?: (answers: WizardAnswers) => void;
  onCalendarApprove?: () => void;
  orgSlug?: string;
  orgId?: string;
}

export default function ChatMessages({
  messages,
  status,
  onWizardSubmit,
  onCalendarApprove,
  orgSlug,
  orgId,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* Agent identity header */}
      <div className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-[760px] mx-auto px-10 py-4">
          <div className="flex items-center gap-2.5">
            <AgentAvatar size="lg" />
            <h2 className="text-sm font-semibold text-dark leading-tight">
              Helena
            </h2>
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="flex justify-center py-3">
        <span className="text-[11px] text-muted bg-[#f0f0f3] px-3 py-1 rounded-full">
          {today}
        </span>
      </div>

      {/* Messages stream */}
      <div className="max-w-[760px] mx-auto px-10 pb-8 flex flex-col gap-6">
        {messages.length === 0 && !status && (
          <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
            <p className="text-sm text-muted text-center max-w-sm leading-relaxed">
              Helena is getting ready to analyze your brand and build your
              marketing strategy.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onWizardSubmit={onWizardSubmit}
            onCalendarApprove={onCalendarApprove}
            orgSlug={orgSlug}
            orgId={orgId}
          />
        ))}

        {status && <StatusIndicator message={status} />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
