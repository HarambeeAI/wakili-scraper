"use client";

import type { ChatMessageData } from "@/types";
import FileCard from "./FileCard";

interface ChatMessageProps {
  message: ChatMessageData;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  if (message.type === "file_card" && message.file) {
    return <FileCard file={message.file} />;
  }

  return (
    <div className="flex gap-3 py-3">
      {message.role === "agent" && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🤖</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {message.role === "agent" && (
          <p className="text-xs font-semibold text-dark mb-1">Helena</p>
        )}
        <p className="text-sm text-muted-dark leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}
