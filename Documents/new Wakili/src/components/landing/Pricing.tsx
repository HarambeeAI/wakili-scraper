import { Link } from "react-router-dom";
import { useScrollReveal } from "../../hooks/useScrollReveal";

const plans = [
  {
    name: "Starter",
    price: "49",
    description: "For solo practitioners and small practices",
    features: [
      "100 AI research queries/month",
      "Basic citation tracking",
      "5 research workspaces",
      "Single jurisdiction",
      "Email support",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Professional",
    price: "149",
    description: "For growing firms and legal teams",
    features: [
      "Unlimited AI queries",
      "Advanced citation with page-level links",
      "Unlimited workspaces",
      "Multi-jurisdiction access",
      "Knowledge graph explorer",
      "Team collaboration",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large firms and corporate legal departments",
    features: [
      "Everything in Professional",
      "Custom document ingestion",
      "Private knowledge graph",
      "API access",
      "SSO & advanced security",
      "Dedicated account manager",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function Pricing() {
  const ref = useScrollReveal<HTMLElement>();

  return (
    <section ref={ref} id="pricing" className="px-4 py-24 md:py-40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 md:mb-24">
          <div className="inline-flex rounded-full px-3 py-1 mb-6 ring-1 ring-overlay-8 bg-overlay-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-text-secondary">
              Pricing
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight text-text-primary mb-4">
            Invest in <span className="italic text-accent">precision</span>
          </h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            14-day free trial on all plans. No credit card required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <div key={i} className="group">
              <div
                className={`h-full rounded-[2rem] p-1.5 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  p.highlight
                    ? "bg-accent/10 ring-1 ring-accent/30 hover:ring-accent/50"
                    : "bg-overlay-2 ring-1 ring-overlay-6 hover:ring-overlay-10"
                }`}
              >
                <div className="h-full rounded-[calc(2rem-0.375rem)] bg-surface-card p-8 md:p-10 shadow-[var(--tw-inset-shadow)] flex flex-col">
                  {p.highlight && (
                    <div className="inline-flex self-start rounded-full px-3 py-1 mb-4 bg-accent/10 ring-1 ring-accent/20">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-accent">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-text-primary tracking-tight">
                    {p.name}
                  </h3>
                  <div className="mt-4 mb-2">
                    {p.price === "Custom" ? (
                      <span className="text-4xl font-semibold text-text-primary tracking-tight">
                        Custom
                      </span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-semibold text-text-primary tracking-tight">
                          ${p.price}
                        </span>
                        <span className="text-text-tertiary text-sm">
                          /month
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-text-secondary text-sm mb-8">
                    {p.description}
                  </p>

                  <ul className="space-y-3 mb-10 flex-1">
                    {p.features.map((f, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-3 text-sm text-text-secondary"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-success mt-0.5 shrink-0"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    className={`group/btn flex items-center justify-center gap-2 rounded-full py-3 px-6 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                      p.highlight
                        ? "bg-accent hover:bg-accent/90 text-white shadow-[0_0_30px_rgba(124,92,252,0.2)]"
                        : "ring-1 ring-overlay-10 text-text-primary hover:bg-overlay-4"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
