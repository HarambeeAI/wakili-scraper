import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import LogoBar from "@/components/marketing/LogoBar";
import HowWeWork from "@/components/marketing/HowWeWork";
import Capabilities from "@/components/marketing/Capabilities";
import WhyUs from "@/components/marketing/WhyUs";
import Agents from "@/components/marketing/Agents";
import Solutions from "@/components/marketing/Solutions";
import Stats from "@/components/marketing/Stats";
import Testimonials from "@/components/marketing/Testimonials";
import CTA from "@/components/marketing/CTA";
import Footer from "@/components/marketing/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Navbar />
      <Hero />
      <LogoBar />
      <HowWeWork />
      <Capabilities />
      <WhyUs />
      <Agents />
      <Solutions />
      <Stats />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}
