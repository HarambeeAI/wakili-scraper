"use client";
import { useState } from "react";

const agents = [
  {
    name: "Angela",
    role: "email marketer",
    color: "#ffe7f8",
    gradient: "linear-gradient(rgb(255,231,248), rgb(255,210,235))",
    emoji: "📧",
    desc: "Emails sent, conversations caught, competitors flagged — all while you sleep.",
  },
  {
    name: "Helena",
    role: "digital marketer",
    color: "#dbf6ff",
    gradient: "linear-gradient(rgb(209,246,255), rgb(194,230,255))",
    emoji: "📊",
    desc: "Strategy, content, ads, analytics — she handles your entire digital presence.",
  },
  {
    name: "Sam",
    role: "SEO/GEO manager",
    color: "#e0ffd4",
    gradient: "linear-gradient(rgb(224,255,212), rgb(199,252,178))",
    emoji: "🔍",
    desc: "Keywords, articles, rankings, and AI search optimization — all on autopilot.",
  },
  {
    name: "Kai",
    role: "social listening manager",
    color: "#f5f1ff",
    gradient: "linear-gradient(rgb(245,241,255), rgb(229,218,255))",
    emoji: "👁️",
    desc: "Monitors mentions, tracks competitors, and catches trends before they peak.",
  },
];

export default function Hero() {
  const [activeAgent, setActiveAgent] = useState(0);
  const agent = agents[activeAgent];

  return (
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-5 text-center">
      <div className="max-w-[900px] mx-auto">
        {/* Main headline */}
        <h1 className="text-[36px] md:text-[60px] lg:text-[80px] font-normal leading-[1.05] tracking-[-0.06em] text-dark mb-5 animate-fadeInUp">
          AI Marketing Agents That Execute Your Entire Strategy 24/7
        </h1>

        <p
          className="text-[17px] md:text-[20px] text-muted-dark leading-relaxed max-w-[650px] mx-auto mb-10 animate-fadeInUp"
          style={{ animationDelay: "0.1s" }}
        >
          The first agentic marketing platform where AI marketers don't just
          advise — they write, publish, optimize, and report. You stay in
          control.
        </p>
      </div>

      {/* Agent Carousel Card */}
      <div
        className="max-w-[700px] mx-auto animate-fadeInUp"
        style={{ animationDelay: "0.2s" }}
      >
        <div
          className="rounded-3xl p-8 md:p-10 text-left relative overflow-hidden transition-all duration-500"
          style={{ background: agent.gradient }}
        >
          {/* Agent emoji */}
          <div className="text-5xl mb-4">{agent.emoji}</div>

          {/* Agent heading */}
          <h2 className="text-[28px] md:text-[36px] font-normal tracking-[-0.04em] text-dark mb-2">
            Meet <span className="text-primary font-medium">{agent.name},</span>
            <br />
            your AI {agent.role}.
          </h2>

          <p className="text-[15px] text-muted-dark leading-relaxed max-w-[450px] mb-6">
            Assemble your team. More output. Zero overhead.
            <br />
            {agent.desc}
          </p>

          <a
            href="#cta"
            className="btn-primary text-white text-[15px] font-medium px-6 py-3 rounded-full no-underline inline-block"
          >
            Get Started
          </a>

          {/* Agent avatar circles (right side) */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-3">
            {agents.map((a, i) => (
              <button
                key={a.name}
                onClick={() => setActiveAgent(i)}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition-all duration-300 cursor-pointer ${
                  i === activeAgent
                    ? "border-primary scale-110 shadow-md bg-white"
                    : "border-transparent bg-white/60 hover:bg-white/80"
                }`}
              >
                {a.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Dots navigation (mobile) */}
        <div className="flex md:hidden justify-center gap-2 mt-4">
          {agents.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveAgent(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                i === activeAgent ? "bg-primary w-6" : "bg-muted/40"
              }`}
            />
          ))}
        </div>

        {/* Nav arrows */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={() =>
              setActiveAgent(
                (prev) => (prev - 1 + agents.length) % agents.length,
              )
            }
            className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center hover:bg-light transition-colors cursor-pointer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setActiveAgent((prev) => (prev + 1) % agents.length)}
            className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center hover:bg-light transition-colors cursor-pointer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
