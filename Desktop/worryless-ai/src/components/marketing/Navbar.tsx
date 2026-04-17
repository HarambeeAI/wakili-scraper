"use client";
import { useState } from "react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-[800px]">
      <div className="nav-glass rounded-full px-4 py-2 flex items-center justify-between border border-white/50">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 no-underline">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-semibold text-[15px] text-dark tracking-tight">
            Worryless AI
          </span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <a
            href="#agents"
            className="text-[14px] font-medium text-muted-dark hover:text-dark transition-colors duration-250"
          >
            Agents
          </a>
          <a
            href="#testimonials"
            className="text-[14px] font-medium text-muted-dark hover:text-dark transition-colors duration-250"
          >
            Customers
          </a>
          <a
            href="#solutions"
            className="text-[14px] font-medium text-muted-dark hover:text-dark transition-colors duration-250"
          >
            About us
          </a>
          <a
            href="#capabilities"
            className="text-[14px] font-medium text-muted-dark hover:text-dark transition-colors duration-250"
          >
            Blog
          </a>
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/login"
            className="text-[14px] font-medium text-muted-dark hover:text-dark transition-colors duration-250"
          >
            Login
          </a>
          <a
            href="/signup"
            className="btn-primary text-white text-[14px] font-medium px-5 py-2 rounded-full no-underline inline-block"
          >
            Get Started
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0a0a0a"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden mt-2 nav-glass rounded-2xl p-4 border border-white/50 flex flex-col gap-3">
          <a
            href="#agents"
            className="text-[15px] text-dark py-2"
            onClick={() => setMobileOpen(false)}
          >
            Agents
          </a>
          <a
            href="#testimonials"
            className="text-[15px] text-dark py-2"
            onClick={() => setMobileOpen(false)}
          >
            Customers
          </a>
          <a
            href="#solutions"
            className="text-[15px] text-dark py-2"
            onClick={() => setMobileOpen(false)}
          >
            About us
          </a>
          <a
            href="#capabilities"
            className="text-[15px] text-dark py-2"
            onClick={() => setMobileOpen(false)}
          >
            Blog
          </a>
          <hr className="border-border" />
          <a href="/login" className="text-[15px] text-dark py-2">
            Login
          </a>
          <a
            href="/signup"
            className="btn-primary text-white text-[15px] font-medium px-5 py-3 rounded-full text-center no-underline"
          >
            Get Started
          </a>
        </div>
      )}
    </nav>
  );
}
