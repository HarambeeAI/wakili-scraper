"use client";

import Link from "next/link";
import AgentAvatar from "./AgentAvatar";

interface ChatSidebarProps {
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  activePage?: "chat" | "calendar";
}

export default function ChatSidebar({
  orgName,
  orgSlug,
  logoUrl,
  activePage = "chat",
}: ChatSidebarProps) {
  return (
    <div className="w-[248px] border-r border-border bg-white flex flex-col">
      {/* Org header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={orgName}
                className="w-8 h-8 rounded-lg object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-[11px] font-bold text-white">
                {orgName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-[14px] font-semibold text-dark truncate">
              {orgName}
            </span>
          </div>
          <button className="text-muted hover:text-dark transition-colors">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mb-2 px-1">
          Channels
        </p>
        <Link
          href={`/app/${orgSlug}/chat`}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] mb-1 transition-colors ${
            activePage === "chat"
              ? "text-dark bg-light font-medium"
              : "text-muted-dark hover:bg-light"
          }`}
        >
          <span
            className={activePage === "chat" ? "text-muted-dark" : "text-muted"}
          >
            #
          </span>{" "}
          main
        </Link>
        <a
          href="#"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-dark hover:bg-light transition-colors"
        >
          <span className="text-muted">#</span> performance
        </a>
        <Link
          href={`/app/${orgSlug}/calendar`}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
            activePage === "calendar"
              ? "text-dark bg-light font-medium"
              : "text-muted-dark hover:bg-light"
          }`}
        >
          <span
            className={
              activePage === "calendar" ? "text-muted-dark" : "text-muted"
            }
          >
            #
          </span>{" "}
          calendar
        </Link>

        <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mt-6 mb-2 px-1">
          Direct Messages
        </p>
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-dark hover:bg-light transition-colors cursor-pointer">
          <AgentAvatar size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium">Helena</span>
              <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                + New
              </span>
            </div>
            <span className="text-[10px] text-muted">AI Digital Marketer</span>
          </div>
        </div>

        <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mt-6 mb-2 px-1">
          Chat History
        </p>
        <div className="mb-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-light text-[12px] text-muted">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            Search conversations...
          </div>
        </div>
        <a
          href="#"
          className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-muted-dark hover:text-dark transition-colors truncate rounded-lg hover:bg-light"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          Weekly Automation Suggesti...
        </a>
        <a
          href="#"
          className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-muted-dark hover:text-dark transition-colors truncate rounded-lg hover:bg-light"
        >
          <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
          LinkedIn Page Poster Creatio...
        </a>
        <a
          href="#"
          className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-muted-dark hover:text-dark transition-colors truncate rounded-lg hover:bg-light"
        >
          <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
          Creating an Instagram Reel To...
        </a>
        <a
          href="#"
          className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted-dark hover:text-dark transition-colors mt-1"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
          See all conversations
        </a>
      </nav>

      {/* Bottom links */}
      <div className="border-t border-border px-4 py-3 flex flex-col gap-0.5">
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-dark hover:text-dark hover:bg-light transition-colors"
        >
          <svg
            className="w-[18px] h-[18px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
            />
          </svg>
          Files
        </a>
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-dark hover:text-dark hover:bg-light transition-colors"
        >
          <svg
            className="w-[18px] h-[18px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          Team
        </a>
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-dark hover:text-dark hover:bg-light transition-colors"
        >
          <svg
            className="w-[18px] h-[18px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
            />
          </svg>
          Your Profile
        </a>
      </div>

      {/* Email footer */}
      <div className="border-t border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-bold">S</span>
          </div>
          <span className="text-[12px] text-muted-dark truncate flex-1">
            sureantony@gmail.com
          </span>
          <svg
            className="w-3.5 h-3.5 text-muted flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
