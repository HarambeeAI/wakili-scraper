"use client";

interface ChatSidebarProps {
  orgName: string;
  logoUrl: string | null;
}

export default function ChatSidebar({ orgName, logoUrl }: ChatSidebarProps) {
  return (
    <div className="w-60 border-r border-border bg-white flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={orgName} className="w-7 h-7 rounded" />
          ) : (
            <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {orgName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-dark truncate">{orgName}</span>
        </div>
      </div>

      <nav className="flex-1 p-3">
        <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mb-2 px-2">Channels</p>
        <a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-dark bg-light font-medium">
          <span className="text-muted-dark">#</span> main
        </a>

        <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mt-6 mb-2 px-2">Direct Messages</p>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-dark">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px]">🤖</span>
          </div>
          <span>Helena</span>
          <span className="text-[10px] text-primary ml-auto">AI Digital Marketer</span>
        </div>
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded-full bg-muted/20" />
          <span className="text-xs text-muted-dark truncate">Your Profile</span>
        </div>
      </div>
    </div>
  );
}
