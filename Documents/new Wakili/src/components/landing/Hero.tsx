import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMobile } from "../../hooks/useMobile";

export default function Hero() {
  const m = useMobile();
  const [activeIndex, setActiveIndex] = useState(0);
  const [animState, setAnimState] = useState<"visible" | "out" | "in">(
    "visible",
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimState("out");
      setTimeout(() => {
        setActiveIndex((prev) => (prev === 0 ? 1 : 0));
        setAnimState("in");
        setTimeout(() => setAnimState("visible"), 600);
      }, 600);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const gradientSpan = (text: string) => (
    <span
      className="animate-gradient-x"
      style={{
        fontStyle: "italic",
        backgroundImage: "linear-gradient(90deg, #573cff, #a78bfa, #d4a853)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {text}
    </span>
  );

  const headlines = [
    <>
      Your Unfair {gradientSpan("Advantage")}
      <br />
      in Kenyan Law.
    </>,
    <>
      The {gradientSpan("Agentic Layer")}
      <br />
      for Kenyan Law.
    </>,
  ];

  return (
    <section
      style={{
        position: "relative",
        backgroundImage: "url(/gradients/hero.webp)",
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <style>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes slide-out-left {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-80px); opacity: 0; }
        }
        @keyframes slide-in-right {
          0% { transform: translateX(80px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      {/* Hero section with background image */}
      <div
        style={{
          position: "relative",
        }}
      >
        {/* Content container */}
        <div
          className="hero-content"
          style={{
            position: "relative",
            zIndex: 10,
            maxWidth: "1200px",
            margin: "0 auto",
            padding: m ? "140px 20px 100px" : "200px 90px 160px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: m ? "40px" : "60px",
          }}
        >
          {/* Text block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {/* Main headline */}
            <div
              style={{
                overflow: "hidden",
                margin: "0 0 24px",
                minHeight: m ? "11rem" : undefined,
              }}
            >
              <h1
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: "clamp(3.5rem, 7vw, 7rem)",
                  fontWeight: 400,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                  margin: 0,
                  animation:
                    animState === "out"
                      ? "slide-out-left 0.6s ease-in forwards"
                      : animState === "in"
                        ? "slide-in-right 0.6s ease-out forwards"
                        : "none",
                }}
              >
                {headlines[activeIndex]}
              </h1>
            </div>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontSize: "18px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.7)",
                maxWidth: "620px",
                margin: "0 auto 40px",
                lineHeight: 1.6,
              }}
            >
              Specialised AI Agents trained on Kenyan law to help you get work
              done! Loved by 500+ AI native advocates and law firms.
            </p>

            {/* CTA Button */}
            <div id="os-demo" />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <Link
                to="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0px",
                  backgroundColor: "rgba(17,17,17,1)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 400,
                  fontFamily: "'Fragment Mono', monospace",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  borderRadius: "20px",
                  padding: "0px 24px 0px 0px",
                  height: "56px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  textDecoration: "none",
                  transition: "all 0.3s cubic-bezier(0.44, 0, 0.56, 1)",
                  boxShadow:
                    "rgba(0,0,0,0.1) 0px 2px 4px 0px, rgba(0,0,0,0.05) 0px 1px 0px 0px, rgba(255,255,255,0.15) 0px 0px 0px 1px",
                }}
              >
                {/* Purple square icon */}
                <span
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "#573cff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "8px",
                    marginRight: "14px",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
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
                START RESEARCHING
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* See It in Action - YouTube Video (overlaps hero background) */}
      <div
        className="hero-video-wrap"
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "800px",
          margin: "0 auto",
          padding: m ? "0 20px" : "0 90px",
          marginTop: m ? "-40px" : "-80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <h2
          style={{
            fontFamily: "'General Sans', 'Be Vietnam Pro', sans-serif",
            fontSize: "24px",
            fontWeight: 500,
            color: "#1a1a2e",
            letterSpacing: "-0.02em",
            margin: 0,
            animation: "gentle-bounce 2s ease-in-out infinite",
          }}
        >
          See It in Action
        </h2>
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "rgba(0,0,0,0.15) 0px 8px 40px",
          }}
        >
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/JVQviSXowes"
            title="Lawlyfy Demo"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ display: "block" }}
          />
        </div>
      </div>
    </section>
  );
}
