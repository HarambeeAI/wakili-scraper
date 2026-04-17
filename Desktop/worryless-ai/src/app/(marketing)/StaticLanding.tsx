"use client";

import { useEffect, useRef } from "react";
import "./landing.css";
import { landingHTML } from "./landing-html";

export default function StaticLanding() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptsRan = useRef(false);

  useEffect(() => {
    if (scriptsRan.current) return;
    scriptsRan.current = true;

    // Load scripts from public/ as <script> tags to avoid
    // template literal escaping issues with TypeScript bundler
    const script1 = document.createElement("script");
    script1.src = "/landing-scripts-1.js";
    script1.defer = true;

    const script2 = document.createElement("script");
    script2.src = "/landing-scripts-2.js";
    script2.defer = true;

    // Script 2 depends on script 1 (heroTypewriter must exist first)
    script1.onload = () => {
      document.body.appendChild(script2);
    };
    document.body.appendChild(script1);

    return () => {
      try {
        document.body.removeChild(script1);
        document.body.removeChild(script2);
      } catch {
        // already removed
      }
    };
  }, []);

  return (
    <div ref={containerRef} dangerouslySetInnerHTML={{ __html: landingHTML }} />
  );
}
