"use client";

import { usePathname } from "next/navigation";
import { ChatProvider } from "@/contexts/ChatContext";
import ChatSidebar from "@/components/chat/ChatSidebar";

interface AppShellProps {
  runId: string | null;
  orgSlug: string;
  orgName: string;
  orgId: string;
  logoUrl: string | null;
  children: React.ReactNode;
}

export default function AppShell({
  runId,
  orgSlug,
  orgName,
  orgId,
  logoUrl,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const activePage = pathname.includes("/calendar") ? "calendar" : "chat";

  return (
    <ChatProvider runId={runId} orgId={orgId}>
      <div className="flex h-screen bg-white">
        <ChatSidebar
          orgName={orgName}
          orgSlug={orgSlug}
          logoUrl={logoUrl}
          activePage={activePage}
        />
        <div className="flex-1 flex flex-col min-w-0 border-l border-border">
          {children}
        </div>
      </div>
    </ChatProvider>
  );
}
