const testimonials = [
  {
    quote: "This is how social moves from a communications channel to an intelligence system for the entire brand.",
    company: 'Upwork',
    location: 'United States',
  },
  {
    quote: "The AI Marketing Agent became our 24/7 sentinel, we achieved 155% of our monthly engagement benchmark in the first 30 days.",
    company: 'Upwork',
    location: 'United States',
  },
  {
    quote: "It uses AI to analyze your store and writes meta video ad scripts for my products, you can't beat that level of automation.",
    company: 'No Errors',
    location: 'United States',
  },
  {
    quote: "Managing our 10M+ subscriber community used to take 10+ hours weekly in manual reporting. The social listening agent cut that to minutes.",
    company: 'Colors Studios',
    location: 'United States',
  },
  {
    quote: "Powerful features, yet user-friendly, perfect for busy store owners who want real automation without the learning curve.",
    company: 'Shop and Save',
    location: 'United States',
  },
  {
    quote: "An amazing insight generator and marketing assistant — from Reddit suggestions to campaign generation, it does it all.",
    company: 'Marte',
    location: 'United States',
  },
  {
    quote: "It feels like having a personal marketing manager helping me build and run a structured sales strategy from scratch.",
    company: 'Uvella',
    location: 'South Korea',
  },
  {
    quote: "Best agent for Shopify merchants, hands down. What I have been able to do with this app would have cost me thousands.",
    company: 'Crazy Farm',
    location: 'United States',
  },
]

export default function Testimonials() {
  // Duplicate for infinite scroll
  const items = [...testimonials, ...testimonials]

  return (
    <section id="testimonials" className="py-20 md:py-28 overflow-hidden">
      <div className="text-center mb-14 px-5">
        <span className="inline-block text-[13px] font-medium tracking-[0.1em] uppercase text-primary bg-blue-tint px-4 py-1.5 rounded-full mb-5">
          Customers
        </span>
        <h2 className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-tight">
          Don't take our word for it
        </h2>
        <p className="text-[17px] text-muted-dark mt-4">
          Here's what our customers think about our AI agents.
        </p>
      </div>

      {/* Scrolling testimonials */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-r from-[#fafafa] to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-l from-[#fafafa] to-transparent z-10 pointer-events-none" />

        <div className="flex animate-testimonial-scroll" style={{ width: `${items.length * 360}px` }}>
          {items.map((t, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[340px] mx-2.5 bg-white rounded-2xl p-6 border border-border/40 section-card"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#FFB800" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                ))}
              </div>

              <p className="text-[14px] text-dark leading-relaxed mb-5 min-h-[80px]">
                "{t.quote}"
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                <div className="w-8 h-8 rounded-full bg-light flex items-center justify-center text-[11px] font-bold text-muted-dark">
                  {t.company[0]}
                </div>
                <div>
                  <span className="text-[13px] font-medium text-dark block">{t.company}</span>
                  <span className="text-[12px] text-muted">{t.location}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
