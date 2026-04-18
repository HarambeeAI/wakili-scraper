"use client";

import { useChatContext } from "@/contexts/ChatContext";
import ChatMessages from "./ChatMessages";
import KnowledgePanel from "./KnowledgePanel";
import ChatInput from "./ChatInput";

interface ChatLayoutProps {
  orgSlug: string;
  orgId: string;
  logoUrl: string | null;
}

export default function ChatLayout({
  orgSlug,
  orgId,
  logoUrl,
}: ChatLayoutProps) {
  const {
    messages,
    files,
    status,
    isRunning,
    handleWizardSubmit,
    handleCalendarApprove,
  } = useChatContext();

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <ChatMessages
          messages={messages}
          status={status}
          onWizardSubmit={handleWizardSubmit}
          onCalendarApprove={handleCalendarApprove}
          orgSlug={orgSlug}
          orgId={orgId}
        />
        <ChatInput disabled={isRunning} />
      </div>
      <KnowledgePanel files={files} logoUrl={logoUrl} />
    </>
  );
}
