import { useState } from "react";
import { initializePayment } from "../../lib/api";

export interface SubscriptionBlock {
  show: boolean;
  error: "trial_limit_reached" | "subscription_inactive" | "payment_pending" | "";
  type?: "chat" | "draft";
  message: string;
  trialChatsRemaining?: number;
  trialDraftsRemaining?: number;
}

export const EMPTY_BLOCK: SubscriptionBlock = {
  show: false,
  error: "",
  message: "",
};

interface SubscriptionGateProps {
  block: SubscriptionBlock;
  onClose: () => void;
}

const SCENARIO_CONFIG = {
  trial_limit_reached: {
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    iconBg: "bg-accent/10",
    title: "Free Trial Limit Reached",
    cta: "Subscribe Now",
    dismiss: "Maybe Later",
    accentBar: "from-accent via-purple-400 to-accent",
    features: [
      "Unlimited legal research queries",
      "Unlimited document drafting",
      "Export to PDF & DOCX",
      "Deep multi-source research mode",
    ],
  },
  subscription_inactive: {
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-amber-600"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Subscription Expired",
    cta: "Renew Subscription",
    dismiss: "Dismiss",
    accentBar: "from-amber-400 via-orange-400 to-amber-400",
    features: [
      "Resume unlimited research & drafting",
      "Keep access to all your documents",
      "Export drafts to PDF & DOCX",
      "Priority AI responses",
    ],
  },
  payment_pending: {
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-500"
      >
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" />
        <path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M4.93 19.07l2.83-2.83" />
        <path d="M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    title: "Payment Processing",
    cta: "Check Status",
    dismiss: "Dismiss",
    accentBar: "from-blue-400 via-indigo-400 to-blue-400",
    features: [],
  },
} as const;

export default function SubscriptionGate({
  block,
  onClose,
}: SubscriptionGateProps) {
  const [loading, setLoading] = useState(false);

  if (!block.show || !block.error) return null;

  const config = SCENARIO_CONFIG[block.error] || SCENARIO_CONFIG.subscription_inactive;

  async function handleCta() {
    if (block.error === "payment_pending") {
      // Refresh auth state
      window.location.reload();
      return;
    }

    setLoading(true);
    try {
      const data = await initializePayment({
        plan: "professional",
        seats: 1,
        callback_url: `${window.location.origin}/payment/callback`,
      });
      window.location.href = data.authorization_url;
    } catch {
      window.location.href = "/#pricing";
    } finally {
      setLoading(false);
    }
  }

  const isTrialLimit = block.error === "trial_limit_reached";
  const exhaustedType = block.type === "draft" ? "document drafts" : "research queries";
  const otherType = block.type === "draft" ? "research queries" : "document drafts";
  const otherRemaining =
    block.type === "draft"
      ? block.trialChatsRemaining
      : block.trialDraftsRemaining;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl mx-4 overflow-hidden animate-[fadeInScale_250ms_ease-out]"
        style={{ maxWidth: 440 }}
      >
        {/* Accent bar */}
        <div className={`h-1 bg-gradient-to-r ${config.accentBar}`} />

        <div className="px-6 pt-6 pb-5">
          {/* Icon */}
          <div
            className={`flex items-center justify-center w-13 h-13 rounded-xl ${config.iconBg} mb-4 mx-auto`}
            style={{ width: 52, height: 52 }}
          >
            {config.icon}
          </div>

          {/* Title */}
          <h3
            className="text-center text-lg font-bold text-gray-900 dark:text-white mb-2"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            {config.title}
          </h3>

          {/* Message */}
          <p className="text-center text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-1">
            {block.message}
          </p>

          {/* Remaining usage indicator for trial users */}
          {isTrialLimit && otherRemaining !== undefined && otherRemaining > 0 && (
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mb-4">
              You still have{" "}
              <span className="font-semibold text-gray-600 dark:text-gray-300">
                {otherRemaining} free {otherType}
              </span>{" "}
              remaining
            </p>
          )}

          {isTrialLimit && otherRemaining !== undefined && otherRemaining <= 0 && (
            <p className="text-center text-[11px] text-amber-500 font-medium mb-4">
              All free {exhaustedType} and {otherType} have been used
            </p>
          )}

          {!isTrialLimit && <div className="mb-4" />}

          {/* Features list */}
          {config.features.length > 0 && (
            <div className="space-y-2.5 mb-6">
              {config.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-emerald-500"
                    >
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-[12.5px] text-gray-600 dark:text-gray-300">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Payment pending — different layout */}
          {block.error === "payment_pending" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 mb-6">
              <div className="animate-spin">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-blue-500"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
              </div>
              <p className="text-[12px] text-blue-700 dark:text-blue-300">
                Your payment is being processed. This usually takes a few
                minutes.
              </p>
            </div>
          )}

          {/* Primary CTA */}
          <button
            onClick={handleCta}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-accent text-white text-[13px] font-semibold hover:bg-accent/90 disabled:opacity-50 transition-all shadow-sm hover:shadow-md mb-2"
          >
            {loading ? "Redirecting..." : config.cta}
          </button>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {config.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
