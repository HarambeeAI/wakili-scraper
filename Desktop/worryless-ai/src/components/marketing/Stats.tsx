const stats = [
  { icon: '⬇️', value: '10x', label: 'Average time saved', sub: 'on marketing tasks' },
  { icon: '⬆️', value: '5x', label: 'More content', sub: 'published per month' },
  { icon: '⬆️', value: '$0K', label: 'Average annual', sub: 'savings vs. hiring' },
  { icon: '⬇️', value: '< 1hr', label: 'Average time from', sub: 'idea to published' },
]

export default function Stats() {
  return (
    <section className="py-16 px-5 bg-white">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="text-center p-6 rounded-2xl bg-lighter border border-border/30"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-none mb-2">
                {stat.value}
              </div>
              <p className="text-[13px] text-muted-dark leading-snug">
                {stat.label}
                <br />
                {stat.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
