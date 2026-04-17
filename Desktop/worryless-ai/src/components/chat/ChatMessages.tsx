"use client";

import { useEffect, useRef } from "react";
import type { ChatMessageData } from "@/types";
import ChatMessage from "./ChatMessage";
import StatusIndicator from "./StatusIndicator";

interface ChatMessagesProps {
  messages: ChatMessageData[];
  status: string | null;
}

export default function ChatMessages({ messages, status }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-dark">Helena</h2>
          <p className="text-xs text-muted">AI Digital Marketer</p>
        </div>
      </div>

      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {status && <StatusIndicator message={status} />}

      <div ref={bottomRef} />
    </div>
  );
}
