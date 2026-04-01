import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import LogoBar from "../components/landing/LogoBar";
import FeatureShowcase from "../components/landing/FeatureShowcase";
import DemoVideo from "../components/landing/DemoVideo";
import CaseStudies from "../components/landing/CaseStudies";
import Pricing from "../components/landing/Pricing";
import Footer from "../components/landing/Footer";

export default function LandingPage() {
  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden"
      style={{ backgroundColor: "#fcfcfc" }}
    >
      <div className="noise-overlay" />
      <Navbar />
      <Hero />
      <LogoBar />
      <FeatureShowcase />
      <CaseStudies />
      <Pricing />

      {/* Media + Footer wrapper with gradient bleed-through */}
      <div
        style={{
          position: "relative",
          overflowX: "clip" as const,
          overflowY: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "130%",
            minWidth: 1600,
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          <img
            src="/gradients/footer.webp"
            alt=""
            loading="lazy"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              transform: "scaleY(-1)",
            }}
          />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <DemoVideo />
          <Footer />
        </div>
      </div>
    </div>
  );
}
