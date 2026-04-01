import { useRef } from "react";
import { useMobile } from "../../hooks/useMobile";

const caseStudies = [
  {
    type: "LAW FIRM",
    stats: [
      { value: "73%", label: "Research time cut" },
      { value: "2x", label: "Matters handled" },
    ],
  },
  {
    type: "SOLO ADVOCATE",
    stats: [
      { value: "10hrs", label: "Saved per week" },
      { value: "2x", label: "Cases taken on" },
    ],
  },
  {
    type: "CORPORATE LEGAL",
    stats: [
      { value: "95%", label: "Citation accuracy" },
      { value: "KES 120K+", label: "Monthly savings" },
    ],
  },
  {
    type: "LEGAL AID",
    stats: [
      { value: "2x", label: "Client capacity" },
      { value: "85%", label: "Faster briefs" },
    ],
  },
  {
    type: "GOVERNMENT",
    stats: [
      { value: "5x", label: "Research throughput" },
      { value: "40%", label: "Cost reduction" },
    ],
  },
];

export default function CaseStudies() {
  const m = useMobile();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "right" ? 420 : -420,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="use-cases"
      style={{
        position: "relative" as const,
        overflow: "hidden",
        padding: "100px 0",
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}
    >
      {/* Background gradient image — full bleed, no overlay */}
      <img
        src="/gradients/section2.webp"
        alt=""
        loading="lazy"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "110%",
          objectFit: "cover",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        className="landing-container"
        style={{
          position: "relative" as const,
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          padding: m ? "0 20px" : "0 90px",
        }}
      >
        {/* Header row: title + nav arrows */}
        <div
          className="casestudies-header"
          style={{
            display: "flex",
            flexDirection: m ? "column" : "row",
            justifyContent: "space-between",
            alignItems: m ? "flex-start" : "flex-start",
            gap: m ? 20 : undefined,
            marginBottom: 60,
          }}
        >
          <h2
            className="landing-heading"
            style={{
              fontSize: m ? 32 : 60,
              fontWeight: 500,
              fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
              lineHeight: m ? "38px" : "66px",
              letterSpacing: "-0.6px",
              color: "#000",
              margin: 0,
            }}
          >
            How Lawlyfy helps real teams
          </h2>

          {/* Navigation arrows */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 8 }}>
            <button
              onClick={() => scroll("left")}
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                backgroundColor: "#573cff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
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
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                backgroundColor: "#573cff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
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
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable cards — full width, overflow visible */}
      <div
        ref={scrollRef}
        className="casestudies-scroll"
        style={{
          position: "relative" as const,
          zIndex: 1,
          display: "flex",
          gap: 16,
          overflowX: "auto" as const,
          scrollSnapType: "x mandatory" as const,
          paddingLeft: m
            ? "20px"
            : "max(90px, calc((100vw - 1200px) / 2 + 90px))",
          paddingRight: 40,
          paddingBottom: 8,
          scrollbarWidth: "none" as const,
        }}
      >
        {caseStudies.map((cs, i) => (
          <div
            key={i}
            className="casestudies-card"
            onClick={() => (window.location.href = "/signup")}
            style={{
              flexShrink: 0,
              width: m ? 300 : 400,
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: "8px 8px 32px",
              boxShadow: "rgba(0,0,0,0.06) 0px 81px 48px 0px",
              display: "flex",
              flexDirection: "column" as const,
              scrollSnapAlign: "start" as const,
              cursor: "pointer",
            }}
          >
            {/* Top gray stats area */}
            <div
              style={{
                backgroundColor: "#f0f0f0",
                borderRadius: 16,
                padding: "24px 24px 28px",
                marginBottom: 20,
              }}
            >
              {/* Purple pill label */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#573cff",
                  borderRadius: 30,
                  padding: "6px 16px",
                  marginBottom: 24,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#fff",
                    fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
                    letterSpacing: "-0.12px",
                  }}
                >
                  {cs.type}
                </span>
              </div>

              {/* Two stat columns */}
              <div style={{ display: "flex", gap: 24 }}>
                {cs.stats.map((stat, j) => (
                  <div key={j} style={{ flex: 1 }}>
                    <div
                      className="casestudies-stat-value"
                      style={{
                        fontSize: m ? 36 : 50,
                        fontWeight: 500,
                        fontFamily:
                          "'General Sans', 'Be Vietnam Pro', sans-serif",
                        color: "#000",
                        lineHeight: 1,
                        marginBottom: 4,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        fontFamily:
                          "'General Sans', 'Be Vietnam Pro', sans-serif",
                        color: "#000",
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logo placeholder area */}
            <div
              style={{
                padding: "0 24px",
                marginBottom: 20,
                flex: 1,
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
                  color: "#c0c0c0",
                  letterSpacing: "-0.5px",
                }}
              >
                {cs.type}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hide scrollbar */}
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
