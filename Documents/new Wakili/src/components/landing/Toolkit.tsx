import { Link } from "react-router-dom";
import { useMobile } from "../../hooks/useMobile";

const tools = [
  {
    title: "Deep Research",
    desc: "Multi-step AI agent that breaks down complex legal questions.",
  },
  {
    title: "Document Drafting",
    desc: "Generate polished memos, opinions, and briefs as PDF or DOCX.",
  },
  {
    title: "Clickable Citations",
    desc: "Every claim links to its source judgment or statute.",
  },
  {
    title: "Knowledge Graph",
    desc: "Traverse case-statute relationships to surface hidden precedents.",
  },
  {
    title: "Conversational Memory",
    desc: "Ask follow-ups naturally — Lawlyfy remembers your full thread.",
  },
  {
    title: "Case Law Database",
    desc: "15,000+ Kenyan judgments from Supreme Court to Magistrate's Courts.",
  },
  {
    title: "Statute Browser",
    desc: "Browse the Constitution, Acts of Parliament, and subsidiary legislation.",
  },
  {
    title: "Team Collaboration",
    desc: "Share research threads, citations, and documents across your firm.",
  },
];

export default function Toolkit() {
  const m = useMobile();
  return (
    <section
      style={{
        padding: "100px 0",
        backgroundColor: "#fcfcfc",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        position: "relative" as const,
        overflow: "hidden",
      }}
    >
      {/* Background gradient decoration */}
      <img
        src="/gradients/section2.webp"
        alt=""
        loading="lazy"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          maxWidth: 1400,
          opacity: 0.12,
          pointerEvents: "none",
        }}
      />

      <div
        className="landing-container"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: m ? "0 20px" : "0 90px",
          position: "relative" as const,
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: "center" as const, marginBottom: 60 }}>
          <h2
            className="landing-heading"
            style={{
              fontSize: m ? 32 : 60,
              fontWeight: 500,
              fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
              lineHeight: m ? "38px" : "66px",
              letterSpacing: "-0.6px",
              color: "#000",
              margin: "0 0 16px",
            }}
          >
            The complete toolkit for
            <br />
            modern legal practice
          </h2>
        </div>

        <div
          className="toolkit-grid"
          style={{
            display: "grid",
            gridTemplateColumns: m ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          {tools.map((tool, i) => (
            <Link
              key={i}
              to="/signup"
              style={{
                backgroundColor: "#fff",
                borderRadius: 20,
                padding: "24px 24px",
                boxShadow: "rgba(0,0,0,0.15) 0px 1px 25px",
                textDecoration: "none",
                display: "flex",
                flexDirection: "column" as const,
                gap: 10,
                transition: "transform 0.3s cubic-bezier(0.44, 0, 0.56, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
                  color: "#000",
                  margin: 0,
                }}
              >
                {tool.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#68708c",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {tool.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
