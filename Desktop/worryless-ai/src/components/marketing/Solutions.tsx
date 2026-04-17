const features = [
  {
    emoji: '🎨',
    title: 'They learn your brand voice.',
    desc: 'Tell them about your brand once. Every email, post, and article matches your tone automatically.',
    bg: '#ebfaff',
  },
  {
    emoji: '⚡',
    title: 'They execute, not just advise.',
    desc: "Specialists write, publish, and optimize your campaigns automatically. You get results, not chatbot suggestions.",
    bg: '#e0ffd4',
  },
  {
    emoji: '📈',
    title: 'Scale your team on demand.',
    desc: 'Add specialists for email, content, social, research, and more. Each one works independently across your channels.',
    bg: '#f5f1ff',
  },
  {
    emoji: '🔌',
    title: 'Zero engineering work needed.',
    desc: 'Connect Klaviyo, Shopify, Google Analytics, and more. They start working immediately. No code, no IT ticket.',
    bg: '#fff1d9',
  },
]

export default function Solutions() {
  return (
    <section id="solutions" className="py-20 md:py-28 px-5">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[13px] font-medium tracking-[0.1em] uppercase text-primary bg-blue-tint px-4 py-1.5 rounded-full mb-5">
            Solutions
          </span>
          <h2 className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-tight max-w-[700px] mx-auto">
            For startups, global enterprises,
            <br />
            and <span className="text-primary">everyone</span> in between
          </h2>
          <p className="text-[17px] text-muted-dark mt-4 max-w-[600px] mx-auto">
            Simple defaults, direct integrations, and advanced customization means our specialists will scale with you.
          </p>
        </div>

        {/* Feature cards grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl p-8 md:p-10 border border-border/30 hover:border-primary/15 transition-all duration-400 hover:-translate-y-1"
              style={{ backgroundColor: feature.bg }}
            >
              <div className="text-4xl mb-5">{feature.emoji}</div>
              <h3 className="text-[24px] md:text-[28px] font-medium tracking-[-0.03em] text-dark mb-3">
                {feature.title}
              </h3>
              <p className="text-[15px] text-muted-dark leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
