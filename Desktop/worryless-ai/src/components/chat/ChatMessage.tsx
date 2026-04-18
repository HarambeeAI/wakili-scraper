"use client";

import type { ChatMessageData } from "@/types";
import type { WizardAnswers } from "@/types/calendar";
import FileCard from "./FileCard";
import AgentAvatar from "./AgentAvatar";
import QuestionCard from "./QuestionCard";
import CalendarPreview from "./CalendarPreview";
import ContentPreviewCard from "./ContentPreviewCard";

interface ChatMessageProps {
  message: ChatMessageData;
  onWizardSubmit?: (answers: WizardAnswers) => void;
  onCalendarApprove?: () => void;
  orgSlug?: string;
  orgId?: string;
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br>");
}

export default function ChatMessage({
  message,
  onWizardSubmit,
  onCalendarApprove,
  orgSlug,
  orgId,
}: ChatMessageProps) {
  if (message.type === "question_card" && message.questionData) {
    return (
      <div className="flex gap-3 animate-fadeIn">
        <AgentAvatar size="md" />
        <div className="flex-1 min-w-0">
          <QuestionCard
            questions={message.questionData.questions}
            wizardId={message.questionData.wizardId}
            onSubmit={onWizardSubmit || (() => {})}
            orgSlug={orgSlug}
            orgId={orgId}
          />
        </div>
      </div>
    );
  }

  if (message.type === "calendar_preview" && message.calendarPreviewData) {
    return (
      <div className="flex gap-3 animate-fadeIn">
        <AgentAvatar size="md" />
        <div className="flex-1 min-w-0">
          <CalendarPreview
            posts={message.calendarPreviewData.posts}
            platforms={message.calendarPreviewData.platforms}
            weekCount={message.calendarPreviewData.weekCount}
            onApprove={onCalendarApprove || (() => {})}
          />
        </div>
      </div>
    );
  }

  if (message.type === "content_preview" && message.contentPreviewData) {
    return (
      <div className="flex gap-3 animate-fadeIn">
        <AgentAvatar size="md" />
        <div className="flex-1 min-w-0">
          <ContentPreviewCard
            mediaUrl={message.contentPreviewData.mediaUrl}
            mediaType={message.contentPreviewData.mediaType}
            caption={message.contentPreviewData.caption}
            platform={message.contentPreviewData.platform}
          />
        </div>
      </div>
    );
  }

  if (message.type === "file_card" && message.file) {
    return <FileCard file={message.file} />;
  }

  const isAgent = message.role === "agent";

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {isAgent ? (
          <AgentAvatar size="sm" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">Y</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-dark mb-0.5 leading-none">
          {isAgent ? "Helena" : "You"}
        </p>
        <div
          className="chat-prose text-[14px] text-dark leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: inlineMarkdown(message.content) }}
        />
      </div>
    </div>
  );
}
