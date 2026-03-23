import { Link } from "react-router-dom";
import { useScrollReveal } from "../../hooks/useScrollReveal";

export default function Hero() {
  const ref = useScrollReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      className="relative min-h-[100dvh] flex flex-col items-center justify-center px-4 pt-32 pb-24"
    >
      {/* Radial mesh glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[400px] bg-gold/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 ring-1 ring-overlay-8 bg-overlay-3">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[11px] uppercase tracking-[0.2em] font-medium text-text-secondary">
            AI-Powered Legal Research
          </span>
        </div>

        {/* Main headline */}
        <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.05] tracking-tight text-text-primary mb-6">
          Legal research, <span className="italic text-accent">reimagined</span>
          <br />
          with precision AI
        </h1>

        <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed mb-12">
          Query across statutes, case law, and regulations with intelligent
          citation tracking. Every answer grounded in verifiable sources — click
          any citation to view the exact page.
        </p>

        {/* CTA Group */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="group relative flex items-center gap-3 bg-accent hover:bg-accent/90 text-white font-medium rounded-full pl-7 pr-2 py-2.5 text-base transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] shadow-[0_0_40px_rgba(124,92,252,0.3)]"
          >
            Start Researching — Free
            <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
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

          <a
            href="#how-it-works"
            className="flex items-center gap-2 px-6 py-3 text-sm text-text-secondary hover:text-text-primary rounded-full ring-1 ring-overlay-8 hover:ring-overlay-15 hover:bg-overlay-3 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
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
              <circle cx="12" cy="12" r="10" />
              <polygon
                points="10 8 16 12 10 16 10 8"
                fill="currentColor"
                stroke="none"
              />
            </svg>
            See How It Works
          </a>
        </div>

        {/* Trust bar */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-text-tertiary text-xs uppercase tracking-[0.15em]">
          <span>Trusted by 200+ law firms</span>
          <span className="hidden sm:block w-px h-3 bg-overlay-10" />
          <span>SOC 2 Compliant</span>
          <span className="hidden sm:block w-px h-3 bg-overlay-10" />
          <span>256-bit Encryption</span>
        </div>
      </div>
    </section>
  );
}
