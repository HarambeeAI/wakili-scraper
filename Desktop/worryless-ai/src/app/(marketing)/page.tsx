import type { Metadata } from "next";
import StaticLanding from "./StaticLanding";

export const metadata: Metadata = {
  title:
    "Worryless AI: AI Marketing Agents That Execute 24/7 | Angela, Kai, Helena & Sam",
  description:
    "Meet your new marketing team. Worryless AI's AI marketers write, publish, optimize, and report across every channel. Starting from $39/mo. No dashboards. Just results.",
  icons: { icon: "/assets/images/logo/logo.svg" },
  alternates: { canonical: "https://www.worryless.ai/" },
};

export default function HomePage() {
  return <StaticLanding />;
}
