const capabilities = [
  { icon: '🔑', label: 'Keyword', sub: 'research' },
  { icon: '💬', label: 'Comment', sub: 'responses' },
  { icon: '📊', label: 'Performance', sub: 'dashboards' },
  { icon: '🎯', label: 'Google Ads', sub: 'setup' },
  { icon: '🔍', label: 'Competitor', sub: 'analysis' },
  { icon: '🟠', label: 'Reddit', sub: 'monitoring' },
  { icon: '🔗', label: 'Internal', sub: 'linking' },
  { icon: '✍️', label: 'Ad copy', sub: 'writing' },
  { icon: '👥', label: 'Audience', sub: 'tracking' },
  { icon: '📝', label: 'Blog', sub: 'writing' },
  { icon: '📱', label: 'Meta ads', sub: 'creation' },
  { icon: '🐦', label: 'Twitter (X)', sub: 'engagement' },
  { icon: '📧', label: 'Email', sub: 'sequences' },
  { icon: '🏷️', label: 'Meta tag', sub: 'generation' },
  { icon: '💰', label: 'ROI', sub: 'tracking' },
  { icon: '📈', label: 'Trend', sub: 'detection' },
  { icon: '🧪', label: 'A/B', sub: 'testing' },
  { icon: '🕳️', label: 'Content gap', sub: 'analysis' },
  { icon: '🤝', label: 'Influencer', sub: 'outreach' },
  { icon: '🌍', label: 'GEO', sub: 'optimization' },
  { icon: '📉', label: 'Growth', sub: 'forecasting' },
  { icon: '🛡️', label: 'Community', sub: 'moderation' },
  { icon: '📰', label: 'Newsletter', sub: 'creation' },
  { icon: '🔄', label: 'Content', sub: 'refresh' },
  { icon: '📸', label: 'UGC', sub: 'curation' },
  { icon: '🎯', label: 'Retargeting', sub: 'campaigns' },
  { icon: '📤', label: 'Content', sub: 'publishing' },
  { icon: '📋', label: 'Monthly', sub: 'reports' },
  { icon: '🛍️', label: 'Product', sub: 'page copy' },
  { icon: '🖥️', label: 'Landing page', sub: 'copy' },
  { icon: '🔔', label: 'Optimization', sub: 'alerts' },
  { icon: '📱', label: 'Social post', sub: 'creation' },
]

export default function Capabilities() {
  return (
    <section id="capabilities" className="py-20 md:py-28 px-5 bg-white">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[13px] font-medium tracking-[0.1em] uppercase text-primary bg-blue-tint px-4 py-1.5 rounded-full mb-5">
            Capabilities
          </span>
          <h2 className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-tight max-w-[700px] mx-auto">
            +50 core AI marketing workflows
            <br />
            <span className="text-primary">thoughtfully crafted</span> from human expertise
          </h2>
          <p className="text-[17px] text-muted-dark mt-4">
            Readily available for your execution support
          </p>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {capabilities.map((cap, i) => (
            <div
              key={i}
              className="bg-light/60 hover:bg-white border border-border/40 hover:border-primary/20 rounded-xl p-4 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm cursor-default"
            >
              <div className="text-2xl mb-2">{cap.icon}</div>
              <span className="text-[13px] font-medium text-dark leading-tight">
                {cap.label}
              </span>
              <span className="text-[12px] text-muted-dark">{cap.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
