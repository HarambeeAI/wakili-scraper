"use client";

interface ChatInputProps {
  disabled: boolean;
  agentName?: string;
}

export default function ChatInput({ disabled, agentName = "Helena" }: ChatInputProps) {
  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-2 bg-light rounded-xl px-4 py-3">
        <input
          type="text"
          placeholder={disabled ? `${agentName} is working...` : `Message ${agentName}...`}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-dark placeholder:text-muted outline-none disabled:cursor-not-allowed"
        />
        <button disabled={disabled} className="text-muted hover:text-primary transition-colors disabled:opacity-30">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
