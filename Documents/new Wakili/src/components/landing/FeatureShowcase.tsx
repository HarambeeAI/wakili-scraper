import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useMobile } from "../../hooks/useMobile";

const features = [
  {
    tag: "RESEARCH",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    heading: "Deep Research Agent that thinks like a lawyer",
    bullets: [
      "Researches like your best associate — breaks complex tasks into actionable steps, gathers context, chases every thread, & comes back with the full picture.",
      "Context across every Kenyan court (Supreme Court to Magistrates), plus Acts of Parliament, subsidiary legislation, Gazette notices, and so much more",
      "Live progress stream — watch the agent reason, search, and synthesize step by step",
    ],
    cta: "Try Deep Research",
    ctaLink: "/signup",
    gradient: "/gradients/section1.webp",
    mockup: (
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "rgba(0,0,0,0.15) 0px 1px 25px",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #573cff, #7c5cff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: "#1a1a2e",
            }}
          >
            Deep Research Agent
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#fff",
              background: "#22c55e",
              borderRadius: 20,
              padding: "2px 10px",
              fontWeight: 600,
            }}
          >
            Live
          </span>
        </div>
        <div
          style={{
            background: "#f8f7ff",
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#573cff",
              fontWeight: 600,
              marginBottom: 6,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            Query
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#333",
              fontFamily: "'Be Vietnam Pro', sans-serif",
              lineHeight: 1.5,
            }}
          >
            What are the legal grounds for challenging a land title in Kenya
            under the Land Registration Act?
          </div>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}
        >
          {[
            "Analyzing Land Registration Act 2012...",
            "Searching case law: Ndungu v Registrar...",
            "Cross-referencing Constitution Art. 40...",
          ].map((step, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: i < 2 ? "#573cff" : "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i < 2 && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: i < 2 ? "#333" : "#999",
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                }}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: "DRAFT",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    heading:
      "Co-Drafter Agent that prepares legal documents & presentations in minutes",
    bullets: [
      "Co-draft memos, briefs, demand letters, NDAs, pleadings and so much more with AI assistance",
      "Export to PDF, Powerpoint, or DOCX with one click — ready to file or send",
      "In-app document preview with real-time editing and formatting",
    ],
    cta: "See Drafting in Action",
    ctaLink: "/signup",
    gradient: "/gradients/section2.webp",
    mockup: (
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "rgba(0,0,0,0.15) 0px 1px 25px",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #573cff, #7c5cff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: "#1a1a2e",
            }}
          >
            Document Drafting
          </span>
        </div>
        <div
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1a1a2e",
              marginBottom: 4,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            Legal Memorandum
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#999",
              marginBottom: 12,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            Employment Dispute — Wrongful Termination
          </div>
          <div style={{ height: 1, background: "#e5e7eb", marginBottom: 12 }} />
          <div
            style={{
              fontSize: 12,
              color: "#555",
              lineHeight: 1.7,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            <strong>ISSUE:</strong> Whether the termination of the claimant's
            employment contract violated Section 45 of the Employment Act,
            2007...
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <div
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 8,
              background: "#573cff",
              color: "#fff",
              fontWeight: 600,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            Export PDF
          </div>
          <div
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              color: "#555",
              fontWeight: 600,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            Export DOCX
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: "CITE",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    heading: "Every claim backed by verifiable citations",
    bullets: [
      "Numbered inline citations link every legal assertion to its source",
      "Click any citation to jump directly to the statute or case excerpt",
      "95% citation accuracy — verified against the Kenya Law database",
    ],
    cta: "Explore Citations",
    ctaLink: "/signup",
    gradient: "/gradients/section1.webp",
    mockup: (
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "rgba(0,0,0,0.15) 0px 1px 25px",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #573cff, #7c5cff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: "#1a1a2e",
            }}
          >
            Citation Viewer
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#573cff",
              background: "#f0edff",
              borderRadius: 20,
              padding: "2px 10px",
              fontWeight: 600,
            }}
          >
            98% Accuracy
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#444",
            lineHeight: 1.8,
            fontFamily: "'Be Vietnam Pro', sans-serif",
            marginBottom: 14,
          }}
        >
          The right to fair labour practices is guaranteed under{" "}
          <span
            style={{
              color: "#573cff",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationStyle: "dotted" as const,
              textUnderlineOffset: "3px",
            }}
          >
            Article 41 of the Constitution [1]
          </span>{" "}
          and further elaborated in{" "}
          <span
            style={{
              color: "#573cff",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationStyle: "dotted" as const,
              textUnderlineOffset: "3px",
            }}
          >
            Section 5 of the Employment Act [2]
          </span>
          .
        </div>
        <div style={{ background: "#f8f7ff", borderRadius: 10, padding: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: "#573cff",
              fontWeight: 700,
              marginBottom: 6,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            Sources
          </div>
          {[
            "[1] Constitution of Kenya, 2010 — Article 41",
            "[2] Employment Act, 2007 — Section 5",
          ].map((src, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: "#555",
                padding: "4px 0",
                fontFamily: "'Be Vietnam Pro', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#573cff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {src}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: "ANALYZE",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <circle cx="4" cy="6" r="2" />
        <circle cx="20" cy="6" r="2" />
        <circle cx="4" cy="18" r="2" />
        <circle cx="20" cy="18" r="2" />
        <line x1="6" y1="7" x2="10" y2="10" />
        <line x1="18" y1="7" x2="14" y2="10" />
        <line x1="6" y1="17" x2="10" y2="14" />
        <line x1="18" y1="17" x2="14" y2="14" />
      </svg>
    ),
    heading: "Knowledge graph that surfaces hidden precedents",
    bullets: [
      "Maps relationships between cases, statutes, and constitutional provisions",
      "Surfaces missed precedents and related rulings other tools overlook",
      "Purpose-built for Kenyan law — Indexes every tier of Kenyan courts, Acts of Parliament, subsidiary legislation, and Kenya Gazette notices",
    ],
    cta: "Discover the Graph",
    ctaLink: "/signup",
    gradient: "/gradients/section2.webp",
    mockup: (
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "rgba(0,0,0,0.15) 0px 1px 25px",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #573cff, #7c5cff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <circle cx="4" cy="6" r="2" />
              <circle cx="20" cy="6" r="2" />
              <circle cx="4" cy="18" r="2" />
              <circle cx="20" cy="18" r="2" />
              <line x1="6" y1="7" x2="10" y2="10" />
              <line x1="18" y1="7" x2="14" y2="10" />
              <line x1="6" y1="17" x2="10" y2="14" />
              <line x1="18" y1="17" x2="14" y2="14" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: "#1a1a2e",
            }}
          >
            Knowledge Graph
          </span>
        </div>
        <div
          style={{
            position: "relative" as const,
            background: "#fafaff",
            borderRadius: 12,
            padding: 20,
            minHeight: 140,
          }}
        >
          {/* Central node */}
          <div
            style={{
              position: "absolute" as const,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #573cff, #7c5cff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: "#fff",
                fontWeight: 700,
                textAlign: "center" as const,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                lineHeight: 1.2,
              }}
            >
              Land Act
              <br />
              2012
            </span>
          </div>
          {/* Connected nodes */}
          {[
            {
              label: "Art. 40",
              top: "10%",
              left: "15%",
              bg: "#f0edff",
              color: "#573cff",
            },
            {
              label: "Ndungu v KRA",
              top: "8%",
              left: "70%",
              bg: "#fef3c7",
              color: "#92400e",
            },
            {
              label: "S. 26 LRA",
              top: "75%",
              left: "10%",
              bg: "#f0edff",
              color: "#573cff",
            },
            {
              label: "Ochieng HC",
              top: "78%",
              left: "72%",
              bg: "#dcfce7",
              color: "#166534",
            },
          ].map((node, i) => (
            <div
              key={i}
              style={{
                position: "absolute" as const,
                top: node.top,
                left: node.left,
                background: node.bg,
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 10,
                fontWeight: 600,
                color: node.color,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                whiteSpace: "nowrap" as const,
              }}
            >
              {node.label}
            </div>
          ))}
          {/* Connection lines */}
          <svg
            style={{
              position: "absolute" as const,
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 1,
            }}
            viewBox="0 0 260 140"
          >
            <line
              x1="65"
              y1="25"
              x2="120"
              y2="60"
              stroke="#573cff"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            <line
              x1="200"
              y1="22"
              x2="150"
              y2="60"
              stroke="#573cff"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            <line
              x1="55"
              y1="115"
              x2="120"
              y2="80"
              stroke="#573cff"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            <line
              x1="210"
              y1="118"
              x2="150"
              y2="80"
              stroke="#573cff"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
          </svg>
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span
            style={{
              fontSize: 12,
              color: "#555",
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            3 missed precedents discovered
          </span>
        </div>
      </div>
    ),
  },
];

export default function FeatureShowcase() {
  const m = useMobile();
  const rotatingWords = useMemo(
    () => ["Research Assistant", "Co-Drafter", "Co-Strategist", "Co-Counsel"],
    [],
  );
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState(rotatingWords[0]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const word = rotatingWords[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      if (displayed.length < word.length) {
        timeout = setTimeout(
          () => setDisplayed(word.slice(0, displayed.length + 1)),
          100,
        );
      } else {
        timeout = setTimeout(() => setIsDeleting(true), 2000);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 60);
      } else {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % rotatingWords.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, wordIndex, rotatingWords]);

  return (
    <section
      id="features"
      style={{
        padding: "100px 0",
        background: "#fff",
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}
    >
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      {/* Section Header */}
      <div
        className="landing-container"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: m ? "0 20px" : "0 90px",
          textAlign: "center" as const,
          marginBottom: 80,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
            color: "#573cff",
            marginBottom: 12,
            letterSpacing: "0.56px",
          }}
        >
          The #1 AI Legal Platform
        </div>
        <h2
          className="feature-section-heading"
          style={{
            fontSize: m ? 32 : 60,
            fontWeight: 500,
            fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
            color: "#000",
            margin: "0 0 16px 0",
            lineHeight: m ? "38px" : "66px",
            letterSpacing: "-0.6px",
          }}
        >
          Legal{" "}
          <span
            className="animate-gradient-x"
            style={{
              fontStyle: "italic",
              backgroundImage:
                "linear-gradient(90deg, #573cff, #a78bfa, #d4a853)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {displayed}
            <span
              style={{
                display: "inline-block",
                width: "2px",
                height: "0.8em",
                backgroundColor: "#573cff",
                marginLeft: "2px",
                verticalAlign: "baseline",
                animation: "cursor-blink 1s step-end infinite",
              }}
            />
          </span>
          <br />
          for AI-Native Law Firms
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "#68708c",
            maxWidth: 600,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Powerful agentic capabilities redefining how legal experts research,
          draft, cite, and analyze the law.
        </p>
      </div>

      {/* Feature Blocks */}
      <div
        className="landing-container"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: m ? "0 20px" : "0 90px",
          display: "flex",
          flexDirection: "column" as const,
          gap: 100,
        }}
      >
        {features.map((feature, index) => {
          const isReversed = index % 2 !== 0;
          return (
            <div
              key={index}
              className={isReversed ? "feature-block-reverse" : "feature-block"}
              style={{
                display: "flex",
                flexDirection: m
                  ? ("column" as const)
                  : isReversed
                    ? ("row-reverse" as const)
                    : ("row" as const),
                alignItems: "center",
                gap: m ? 32 : 60,
              }}
            >
              {/* Text Side */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row" as const,
                    gap: 14,
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 4,
                      backgroundColor: "#573cff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily:
                        "'General Sans', 'Be Vietnam Pro', sans-serif",
                      color: "#573cff",
                      letterSpacing: "0.56px",
                    }}
                  >
                    {feature.tag}
                  </span>
                </div>
                <h3
                  className="feature-heading"
                  style={{
                    fontSize: m ? 28 : 40,
                    fontWeight: 500,
                    fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
                    color: "#000",
                    lineHeight: m ? "34px" : "40px",
                    margin: "0 0 24px 0",
                    letterSpacing: "-0.8px",
                  }}
                >
                  {feature.heading}
                </h3>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 28px 0",
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 12,
                  }}
                >
                  {feature.bullets.map((bullet, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 15,
                        color: "#68708c",
                        lineHeight: 1.6,
                        display: "flex",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: "#573cff",
                          fontWeight: 700,
                          flexShrink: 0,
                          lineHeight: 1.6,
                        }}
                      >
                        &bull;
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
                {/* CTA Button - dark style matching creatify */}
                <Link
                  to={feature.ctaLink}
                  className="feature-cta-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0,
                    backgroundColor: "rgb(0, 0, 0)",
                    color: "#fff",
                    textDecoration: "none",
                    borderRadius: 8,
                    height: m ? 56 : 72,
                    padding: "0px 15px 0px 0px",
                    position: "relative" as const,
                    overflow: "hidden",
                  }}
                >
                  {/* Purple square icon */}
                  <span
                    className="feature-cta-icon"
                    style={{
                      width: m ? 48 : 64,
                      height: m ? 48 : 64,
                      borderRadius: 4,
                      backgroundColor: "#573cff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: 4,
                      marginRight: 10,
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 15,
                      fontWeight: 500,
                      letterSpacing: "0.6px",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {feature.cta.toUpperCase()}
                  </span>
                </Link>
              </div>

              {/* Visual Side */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    borderRadius: 24,
                    overflow: "hidden",
                    position: "relative" as const,
                    padding: 32,
                    backgroundImage: `url(${feature.gradient})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    minHeight: 360,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {feature.mockup}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
