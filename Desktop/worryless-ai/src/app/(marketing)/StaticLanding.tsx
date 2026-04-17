"use client";

import { useEffect, useRef } from "react";
import "./landing.css";
import { landingHTML } from "./landing-html";
import { landingScripts } from "./landing-scripts";

export default function StaticLanding() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptsRan = useRef(false);

  useEffect(() => {
    if (scriptsRan.current) return;
    scriptsRan.current = true;

    // Execute the inline scripts after the HTML is rendered
    const script = document.createElement("script");
    script.textContent = landingScripts;
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      try {
        document.body.removeChild(script);
      } catch {
        // already removed
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: landingHTML }}
    />
  );
}
