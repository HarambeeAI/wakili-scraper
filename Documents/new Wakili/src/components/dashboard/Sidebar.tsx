import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../shared/Logo";
import { useAuth } from "../../hooks/useAuth";
import { listThreads, deleteThread, type ThreadSummary } from "../../lib/api";

interface SidebarProps {
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  /** Incremented whenever a new message is sent, to trigger refresh */
  refreshKey?: number;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Sidebar({
  activeThreadId,
  onSelectThread,
  onNewThread,
  refreshKey,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchThreads = useCallback(async (query = "") => {
    try {
      const data = await listThreads(query);
      setThreads(data.threads);
    } catch {
      // Silently fail — user may not be authed yet
    }
  }, []);

  // Initial load + refresh when new messages are sent
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads, refreshKey]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!search.trim()) {
      fetchThreads();
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      await fetchThreads(search);
      setIsSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchThreads]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteThread(id);
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeThreadId === id) onNewThread();
    } catch {
      // ignore
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initials = user
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const planLabel = user?.plan === "team" ? "Team Plan" : "Professional";

  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col bg-surface-elevated border-r border-overlay-6 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        collapsed ? "w-[72px]" : "w-[280px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 h-16">
        {!collapsed && <Logo />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-overlay-4 transition-colors text-text-tertiary hover:text-text-secondary"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {collapsed ? (
              <path d="m9 18 6-6-6-6" />
            ) : (
              <path d="m15 18-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-overlay-2 ring-1 ring-overlay-6 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Thread button (collapsed mode) */}
      {collapsed && (
        <div className="px-3 pb-2">
          <button
            onClick={onNewThread}
            className="w-full flex items-center justify-center py-2.5 rounded-xl hover:bg-overlay-4 transition-colors text-text-tertiary hover:text-accent"
            title="New Thread"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      )}

      {/* Thread list */}
      {!collapsed && (
        <div className="px-3 pb-4 flex-1 overflow-y-auto min-h-0">
          <h4 className="text-[10px] uppercase tracking-[0.2em] font-medium text-text-tertiary mb-2 px-1">
            Recent Threads
          </h4>
          <div className="space-y-0.5">
            {threads.length === 0 && (
              <p className="text-[11px] text-text-tertiary px-3 py-4 text-center">
                {search ? "No matching chats" : "No chats yet"}
              </p>
            )}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectThread(t.id)}
                className={`group w-full text-left px-3 py-2.5 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  t.id === activeThreadId
                    ? "bg-overlay-4 ring-1 ring-overlay-6"
                    : "hover:bg-overlay-3"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-text-secondary truncate flex-1">
                    {t.title}
                  </p>
                  <button
                    onClick={(e) => handleDelete(t.id, e)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-overlay-6 text-text-tertiary hover:text-error transition-all"
                    title="Delete"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-text-tertiary mt-0.5">
                  {timeAgo(t.updated_at)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User profile */}
      <div className="p-3 border-t border-overlay-6">
        <div className="relative group">
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-overlay-4 transition-colors cursor-pointer ${collapsed ? "justify-center" : ""}`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/40 to-gold/40 flex items-center justify-center text-xs font-semibold text-text-primary shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-[11px] text-text-tertiary truncate">
                  {planLabel}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleLogout}
                className="shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-overlay-6 text-text-tertiary hover:text-error transition-all"
                title="Sign out"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
