const steps = [
  {
    number: '01',
    title: 'Email your specialists.',
    desc: 'Share your brand guidelines, target audience, and goals. They will configure their workflows to match your needs.',
    emoji: '📧',
  },
  {
    number: '02',
    title: 'Approve their work.',
    desc: 'Get updates via email or Slack. Approve posts, review insights, or request changes. You stay in control.',
    emoji: '✅',
  },
  {
    number: '03',
    title: 'They execute 24/7.',
    desc: 'Once approved, specialists publish posts, monitor competitors, track trends, and send reports.',
    emoji: '🚀',
  },
]

export default function HowWeWork() {
  return (
    <section className="py-20 md:py-28 px-5">
      <div className="max-w-[1100px] mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block text-[13px] font-medium tracking-[0.1em] uppercase text-primary bg-blue-tint px-4 py-1.5 rounded-full mb-5">
            How we work
          </span>

          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-3xl">📧</span>
            <span className="text-3xl">✅</span>
            <span className="text-3xl">🚀</span>
          </div>

          <h2 className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-tight">
            <span className="text-muted">work</span>
            <br />
            round-the-clock for you
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white rounded-2xl p-8 section-card border border-border/50 hover:border-primary/20 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-10 h-10 rounded-full bg-light flex items-center justify-center text-[14px] font-semibold text-muted-dark mb-5">
                {step.number}
              </div>
              <h3 className="text-[20px] md:text-[24px] font-medium tracking-[-0.03em] text-dark mb-3">
                {step.title}
              </h3>
              <p className="text-[15px] text-muted-dark leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
