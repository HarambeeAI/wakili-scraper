interface DeepResearchToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export default function DeepResearchToggle({
  enabled,
  onToggle,
}: DeepResearchToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={
        enabled ? "Deep research enabled — multi-step analysis" : "Enable deep research"
      }
      className={`shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-lg transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] mb-0.5 ${
        enabled
          ? "bg-gold/15 text-gold ring-1 ring-gold/25"
          : "text-text-tertiary hover:text-text-secondary hover:bg-overlay-4"
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v4" />
        <path d="m6.34 6.34 2.83 2.83" />
        <path d="M2 12h4" />
        <path d="m6.34 17.66 2.83-2.83" />
        <path d="M12 18v4" />
        <path d="m17.66 17.66-2.83-2.83" />
        <path d="M18 12h4" />
        <path d="m17.66 6.34-2.83 2.83" />
        <circle cx="12" cy="12" r="4" />
      </svg>
      {enabled && (
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          Deep
        </span>
      )}
    </button>
  );
}
