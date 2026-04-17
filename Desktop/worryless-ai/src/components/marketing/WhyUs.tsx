"use client";
import { useState } from "react";

type Tab = "ai" | "agency" | "contractor";

const rows = [
  {
    label: "Available 24/7",
    ai: "Never",
    agency: "Business hours",
    contractor: "15 to 20 days",
  },
  {
    label: "PTO & sick days",
    ai: "Never",
    agency: "Holidays",
    contractor: "Required",
  },
  {
    label: "Health insurance & benefits",
    ai: "Not needed",
    agency: "—",
    contractor: "Required",
  },
  {
    label: "Training & onboarding",
    ai: "5 minutes",
    agency: "1 - 2 weeks",
    contractor: "2 - 4 weeks",
  },
  {
    label: "Turnover & replacement",
    ai: "Never leaves",
    agency: "Contract dependant",
    contractor: "High risk",
  },
  {
    label: "Expertise across platforms",
    ai: "All platforms",
    agency: "Team-based",
    contractor: "Limited",
  },
  {
    label: "Response time",
    ai: "Minutes",
    agency: "1 - 2 hours",
    contractor: "Hours",
  },
  {
    label: "Scalability",
    ai: "Instant",
    agency: "Higher retainer",
    contractor: "Hire more",
  },
];

const pricing = {
  ai: {
    price: "$39",
    suffix: "/mo",
    prefix: "from",
    tagline: "You approve, we execute",
  },
  agency: {
    price: "$5,000 - 15,000",
    suffix: "",
    prefix: "",
    tagline: "Strategy first",
  },
  contractor: {
    price: "$4,000 - 8,000",
    suffix: "",
    prefix: "",
    tagline: "Hands-on execution",
  },
};

const tabLabels: Record<Tab, string> = {
  ai: "AI marketers",
  agency: "Agencies",
  contractor: "Human Contractors",
};

export default function WhyUs() {
  const [activeTab, setActiveTab] = useState<Tab>("ai");

  const getValue = (row: (typeof rows)[0]) => {
    switch (activeTab) {
      case "ai":
        return row.ai;
      case "agency":
        return row.agency;
      case "contractor":
        return row.contractor;
    }
  };

  return (
    <section className="py-20 md:py-28 px-5">
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[13px] font-medium tracking-[0.1em] uppercase text-primary bg-blue-tint px-4 py-1.5 rounded-full mb-5">
            Why us?
          </span>
          <h2 className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-tight max-w-[700px] mx-auto">
            Scale your marketing at{" "}
            <span className="text-primary">a fraction of the cost.</span>
            <br />
            Always on, always shipping.
          </h2>
        </div>

        {/* Comparison card */}
        <div className="bg-white rounded-3xl section-card border border-border/50 overflow-hidden">
          {/* Sub header */}
          <div className="p-8 md:p-10 border-b border-border/50">
            <h3 className="text-[24px] md:text-[32px] font-normal tracking-[-0.04em] text-dark mb-2">
              AI marketers cost{" "}
              <span className="text-primary font-medium">
                90% less than contractors.
              </span>
              <br />
              And they never ask for time off.
            </h3>
            <p className="text-[15px] text-muted-dark max-w-[550px]">
              Get expert-level execution across every channel — without the
              overhead of building a full in-house team.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex border-b border-border/50">
            {(Object.keys(tabLabels) as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 text-[14px] font-medium transition-all duration-300 cursor-pointer border-b-2 ${
                  activeTab === tab
                    ? "text-primary border-primary bg-blue-tint/30"
                    : "text-muted-dark border-transparent hover:text-dark hover:bg-light/50"
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          {/* Table rows */}
          <div className="divide-y divide-border/30">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-8 md:px-10 py-4 hover:bg-light/30 transition-colors"
              >
                <span className="text-[14px] text-muted-dark">{row.label}</span>
                <span
                  className={`text-[14px] font-medium ${
                    activeTab === "ai" ? "text-primary" : "text-dark"
                  }`}
                >
                  {getValue(row)}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing footer */}
          <div className="p-8 md:p-10 bg-light/30 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[12px] text-muted-dark">
                {tabLabels[activeTab]}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                {pricing[activeTab].prefix && (
                  <span className="text-[13px] text-muted">
                    {pricing[activeTab].prefix}
                  </span>
                )}
                <span className="text-[32px] md:text-[40px] font-normal tracking-[-0.04em] text-dark">
                  {pricing[activeTab].price}
                </span>
                {pricing[activeTab].suffix && (
                  <span className="text-[15px] text-muted-dark">
                    {pricing[activeTab].suffix}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[14px] text-muted-dark">
              {pricing[activeTab].tagline}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
