const agents = [
  {
    name: 'Helena',
    role: 'AI Digital Marketer',
    emoji: '📊',
    gradient: 'linear-gradient(rgb(209,246,255), rgb(194,230,255))',
    borderColor: '#0a4a78',
  },
  {
    name: 'Sam',
    role: 'AI SEO/GEO Manager',
    emoji: '🔍',
    gradient: 'linear-gradient(rgb(224,255,212), rgb(199,252,178))',
    borderColor: '#1a5a31',
  },
  {
    name: 'Kai',
    role: 'AI Social Listening Manager',
    emoji: '👁️',
    gradient: 'linear-gradient(rgb(245,241,255), rgb(229,218,255))',
    borderColor: '#454175',
  },
  {
    name: 'Angela',
    role: 'AI Email Marketer',
    emoji: '📧',
    gradient: 'linear-gradient(rgb(255,231,248), rgb(255,210,235))',
    borderColor: '#8e3750',
  },
]

export default function Agents() {
  return (
    <section id="agents" className="py-20 md:py-28 px-5 bg-white">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[13px] font-medium tracking-[0.1em] uppercase text-primary bg-blue-tint px-4 py-1.5 rounded-full mb-5">
            AI agents
          </span>
          <h2 className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-tight max-w-[700px] mx-auto">
            Meet your new <span className="text-primary">marketing team.</span>
            <br />
            Ready when you are. Running while you sleep.
          </h2>
          <p className="text-[17px] text-muted-dark mt-4 max-w-[550px] mx-auto">
            Pick the specialists you need. They handle everything from posting to reporting — while you focus on growing your business.
          </p>
        </div>

        {/* Agent cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {agents.map((agent) => (
            <a
              key={agent.name}
              href="#cta"
              className="group block rounded-2xl overflow-hidden border border-border/50 hover:border-transparent transition-all duration-400 hover:-translate-y-2 hover:shadow-xl no-underline"
            >
              {/* Card top with gradient */}
              <div
                className="h-48 flex items-center justify-center text-6xl transition-transform duration-500 group-hover:scale-105"
                style={{ background: agent.gradient }}
              >
                {agent.emoji}
              </div>

              {/* Card body */}
              <div className="bg-white p-5">
                <span className="text-[12px] font-medium text-muted-dark uppercase tracking-wider">
                  {agent.role}
                </span>
                <h3 className="text-[24px] font-medium tracking-[-0.03em] text-dark mt-1">
                  {agent.name}
                </h3>
                <div className="flex items-center gap-1 mt-3 text-primary">
                  <span className="text-[14px] font-medium">Learn more</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
