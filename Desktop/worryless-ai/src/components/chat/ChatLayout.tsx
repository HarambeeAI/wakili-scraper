"use client";

import { useState, useCallback } from "react";
import { useSSE } from "@/hooks/useSSE";
import ChatSidebar from "./ChatSidebar";
import ChatMessages from "./ChatMessages";
import KnowledgePanel from "./KnowledgePanel";
import ChatInput from "./ChatInput";
import type { WizardAnswers } from "@/types/calendar";

interface ChatLayoutProps {
  runId: string | null;
  orgSlug: string;
  orgName: string;
  orgId: string;
  logoUrl: string | null;
}

export default function ChatLayout({
  runId,
  orgSlug,
  orgName,
  orgId,
  logoUrl,
}: ChatLayoutProps) {
  const [calendarRunId, setCalendarRunId] = useState<string | null>(null);

  const handleStartCalendarWizard = useCallback(
    async (organizationId: string) => {
      try {
        const res = await fetch("/api/agent/calendar/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
        });
        const data = await res.json();
        setCalendarRunId(data.runId);
      } catch (err) {
        console.error("Failed to start calendar wizard:", err);
      }
    },
    [],
  );

  const { messages, files, status, isRunning } = useSSE({
    runId,
    calendarRunId,
    onStartCalendarWizard: handleStartCalendarWizard,
  });

  const handleWizardSubmit = useCallback(
    async (answers: WizardAnswers) => {
      if (!calendarRunId) return;
      try {
        await fetch("/api/agent/calendar/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: calendarRunId,
            organizationId: orgId,
            answers,
          }),
        });
      } catch (err) {
        console.error("Failed to submit wizard answers:", err);
      }
    },
    [calendarRunId, orgId],
  );

  const handleCalendarApprove = useCallback(async () => {
    if (!calendarRunId) return;
    try {
      await fetch("/api/agent/calendar/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: calendarRunId,
          organizationId: orgId,
          action: "approve_calendar",
        }),
      });
    } catch (err) {
      console.error("Failed to approve calendar:", err);
    }
  }, [calendarRunId, orgId]);

  return (
    <div className="flex h-screen bg-white">
      <ChatSidebar orgName={orgName} orgSlug={orgSlug} logoUrl={logoUrl} />
      <div className="flex-1 flex flex-col min-w-0 border-x border-border">
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
    </div>
  );
}
