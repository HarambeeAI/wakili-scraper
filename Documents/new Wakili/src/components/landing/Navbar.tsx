import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../shared/Logo";
import ThemeToggle from "../shared/ThemeToggle";
import { useThemeContext } from "../../hooks/ThemeContext";

const links = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useThemeContext();

  return (
    <>
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-40 w-max max-w-[calc(100vw-2rem)]">
        <div className="rounded-full bg-surface-elevated/80 backdrop-blur-2xl ring-1 ring-overlay-6 shadow-[0_8px_32px_var(--nav-shadow)] px-2 py-2 flex items-center gap-1">
          <div className="pl-3 pr-4">
            <Logo />
          </div>

          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-full hover:bg-overlay-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2 pl-2">
            <ThemeToggle
              theme={theme}
              onToggle={toggle}
              className="w-8 h-8 rounded-full ring-0"
            />
            <Link
              to="/login"
              className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary rounded-full hover:bg-overlay-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="group relative flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium rounded-full pl-5 pr-1.5 py-1.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Start Free Trial
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17L17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </span>
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-overlay-4 transition-colors"
            aria-label="Menu"
          >
            <div className="relative w-5 h-4 flex flex-col justify-between">
              <span
                className={`block h-px w-5 bg-text-primary transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] origin-center ${open ? "rotate-45 translate-y-[7.5px]" : ""}`}
              />
              <span
                className={`block h-px w-5 bg-text-primary transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? "opacity-0 scale-x-0" : ""}`}
              />
              <span
                className={`block h-px w-5 bg-text-primary transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] origin-center ${open ? "-rotate-45 -translate-y-[7.5px]" : ""}`}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-30 backdrop-blur-3xl bg-surface/90 flex flex-col items-center justify-center gap-6 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {links.map((l, i) => (
          <a
            key={l.label}
            href={l.href}
            onClick={() => setOpen(false)}
            className="text-3xl font-light text-text-primary transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              transitionDelay: open ? `${100 + i * 60}ms` : "0ms",
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(3rem)",
            }}
          >
            {l.label}
          </a>
        ))}
        <Link
          to="/signup"
          className="mt-4 group flex items-center gap-2 bg-accent text-white text-lg font-medium rounded-full pl-6 pr-2 py-2 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            transitionDelay: open ? "280ms" : "0ms",
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0)" : "translateY(3rem)",
          }}
        >
          Start Free Trial
          <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </span>
        </Link>
      </div>
    </>
  );
}
