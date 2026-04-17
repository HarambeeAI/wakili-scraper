"use client";

interface StatusIndicatorProps {
  message: string;
}

export default function StatusIndicator({ message }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2 py-2 px-4">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:0.2s]" />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:0.4s]" />
      </div>
      <span className="text-xs text-muted-dark">{message}</span>
    </div>
  );
}
