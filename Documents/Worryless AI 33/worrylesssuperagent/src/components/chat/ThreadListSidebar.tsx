import { Bot, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThreadInfo } from "@/hooks/useAgentChat";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ThreadListSidebarProps {
  threads: ThreadInfo[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ThreadListSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
}: ThreadListSidebarProps) {
  return (
    <div className="hidden md:flex md:flex-col w-[240px] bg-sidebar border-r border-border h-full shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Conversations
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewThread}
          aria-label="New Conversation"
          className="h-7 w-7"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        {threads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No past conversations
          </p>
        ) : (
          <div className="p-1">
            {threads.map((t) => (
              <button
                key={t.thread_id}
                className={cn(
                  "w-full flex items-center gap-2 px-3 h-[48px] text-left hover:bg-muted/60 rounded-md transition-colors",
                  activeThreadId === t.thread_id &&
                    "bg-primary/10 text-primary"
                )}
                onClick={() => onSelectThread(t.thread_id)}
              >
                <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">
                  {t.title ?? "Conversation"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(t.created_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
