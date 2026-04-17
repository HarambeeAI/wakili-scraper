import Script from "next/script";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Worryless AI Agentic Marketing Platform",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Marketing Automation",
  description:
    "Agentic marketing platform with autonomous AI marketers for email marketing, social media management, content creation, and paid advertising.",
  url: "https://www.worryless.ai/",
  featureList: [
    "AI Email Marketing Agent",
    "AI Social Media Manager",
    "AI Digital Marketing Specialist",
    "50+ Marketing Workflow Automation",
    "24/7 Autonomous Execution",
  ],
  offers: {
    "@type": "Offer",
    price: "39",
    priceCurrency: "USD",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "12",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
