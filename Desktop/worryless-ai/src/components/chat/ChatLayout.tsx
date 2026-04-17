"use client";

import { useSSE } from "@/hooks/useSSE";
import ChatSidebar from "./ChatSidebar";
import ChatMessages from "./ChatMessages";
import KnowledgePanel from "./KnowledgePanel";
import ChatInput from "./ChatInput";

interface ChatLayoutProps {
  runId: string | null;
  orgName: string;
  logoUrl: string | null;
}

export default function ChatLayout({ runId, orgName, logoUrl }: ChatLayoutProps) {
  const { messages, files, status, isRunning } = useSSE({ runId });

  return (
    <div className="flex h-screen bg-[#fafafa]">
      <ChatSidebar orgName={orgName} logoUrl={logoUrl} />
      <div className="flex-1 flex flex-col">
        <ChatMessages messages={messages} status={status} />
        <ChatInput disabled={isRunning} />
      </div>
      <KnowledgePanel files={files} logoUrl={logoUrl} />
    </div>
  );
}
