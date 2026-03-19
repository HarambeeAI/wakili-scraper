import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Loader2,
  Paperclip,
  Sparkles,
  Calculator,
  Megaphone,
  UserCheck,
  UserCircle,
  Bot,
  Users,
  Newspaper,
  ShoppingCart,
  BarChart3,
  Settings,
  Scale,
  Headset,
} from "lucide-react";
import { useAgentChat } from "@/hooks/useAgentChat";
import { GenerativeUIRenderer } from "@/components/chat/GenerativeUIRenderer";
import { HITLApprovalCard } from "@/components/chat/HITLApprovalCard";
import { ToolIndicator } from "@/components/chat/ToolIndicator";
import { StreamingCursor } from "@/components/chat/StreamingCursor";
import { ThreadListSidebar } from "@/components/chat/ThreadListSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Agent metadata ────────────────────────────────────────────────────────────

const AGENT_META: Record<string, { name: string }> = {
  chief_of_staff: { name: "Chief of Staff" },
  accountant: { name: "Accountant" },
  marketer: { name: "Marketer" },
  sales_rep: { name: "Sales Rep" },
  personal_assistant: { name: "Personal Assistant" },
  customer_support: { name: "Customer Support" },
  legal: { name: "Legal" },
  hr: { name: "HR" },
  pr: { name: "PR" },
  procurement: { name: "Procurement" },
  data_analyst: { name: "Data Analyst" },
  operations: { name: "Operations" },
};

function getAgentIcon(agentType: string) {
  const cls = "h-4 w-4";
  switch (agentType) {
    case "chief_of_staff":
      return <Sparkles className={cls} />;
    case "accountant":
      return <Calculator className={cls} />;
    case "marketer":
      return <Megaphone className={cls} />;
    case "sales_rep":
      return <UserCheck className={cls} />;
    case "personal_assistant":
      return <UserCircle className={cls} />;
    case "customer_support":
      return <Headset className={cls} />;
    case "legal":
      return <Scale className={cls} />;
    case "hr":
      return <Users className={cls} />;
    case "pr":
      return <Newspaper className={cls} />;
    case "procurement":
      return <ShoppingCart className={cls} />;
    case "data_analyst":
      return <BarChart3 className={cls} />;
    case "operations":
      return <Settings className={cls} />;
    default:
      return <Bot className={cls} />;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgentChatViewProps {
  agentType: string;
  userId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentChatView({ agentType, userId }: AgentChatViewProps) {
  const {
    messages,
    threads,
    activeThreadId,
    setActiveThreadId,
    isStreaming,
    activeToolName,
    approveHITL,
    sendMessage,
    startNewThread,
  } = useAgentChat({ userId, agentType });

  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input after send completes
  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const agentMeta = AGENT_META[agentType];
  const agentName = agentMeta?.name ?? "Agent";

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <ThreadListSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
        onNewThread={startNewThread}
      />

      {/* Main chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Agent header bar -- 56px */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border shrink-0">
          {getAgentIcon(agentType)}
          <h2 className="text-xl font-semibold">{agentName}</h2>
          <span className="h-2 w-2 rounded-full bg-green-500" />
        </div>

        {/* Message scroll area */}
        <ScrollArea className="flex-1 px-4 py-2">
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            className="h-full"
          >
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-center min-h-[300px]">
                <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold">Start a conversation</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Ask anything -- your Chief of Staff will route your request to
                  the right specialist.
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-4 py-3",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-none max-w-[72%]"
                          : "bg-muted text-foreground rounded-bl-none max-w-[80%]"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-1">
                          {getAgentIcon(agentType)}
                          <span className="text-xs font-semibold text-muted-foreground">
                            {agentName}
                          </span>
                        </div>
                      )}
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.isStreaming && <StreamingCursor />}
                      {msg.uiComponents && msg.uiComponents.length > 0 && (
                        <GenerativeUIRenderer components={msg.uiComponents} />
                      )}
                      {msg.pendingApproval && (
                        <HITLApprovalCard
                          approval={msg.pendingApproval}
                          onApprove={() =>
                            approveHITL(activeThreadId!, true)
                          }
                          onReject={() =>
                            approveHITL(activeThreadId!, false)
                          }
                          onDiscuss={() => {
                            inputRef.current?.focus();
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
                {/* Loading skeleton when streaming but no assistant message yet */}
                {isStreaming &&
                  messages.length > 0 &&
                  messages[messages.length - 1].role === "user" && (
                    <div className="flex justify-start">
                      <Skeleton className="h-12 w-[60%] rounded-lg" />
                    </div>
                  )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Tool indicator above input */}
        {isStreaming && activeToolName && (
          <div className="px-4 py-1">
            <ToolIndicator toolName={activeToolName} />
          </div>
        )}

        {/* Input bar -- 64px min-height */}
        <div className="border-t px-4 py-3 flex items-center gap-2 min-h-[64px] shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Attach file"
            disabled={isStreaming}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask your AI team anything..."
            className="flex-1 min-h-[44px] max-h-[120px] resize-none"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleSend}
            disabled={isStreaming || !inputValue.trim()}
            aria-label="Send message"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
