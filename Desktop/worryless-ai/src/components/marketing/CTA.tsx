export default function CTA() {
  return (
    <section id="cta" className="py-20 md:py-28 px-5">
      <div className="max-w-[800px] mx-auto text-center">
        {/* Gradient border wrapper */}
        <div className="gradient-border rounded-3xl p-[2px]">
          <div className="bg-[#fafafa] rounded-3xl py-16 md:py-20 px-8 md:px-16">
            {/* Logo */}
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-8">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>

            <h2 className="text-[36px] md:text-[48px] font-normal tracking-[-0.05em] text-dark leading-tight mb-4">
              Hire your marketing team.
              <br />
              <span className="text-primary">Starting today.</span>
            </h2>

            <p className="text-[17px] text-muted-dark max-w-[500px] mx-auto mb-8">
              Pick the specialists you need. Brief them once.
              <br />
              They handle 250+ hours of work while you focus on strategy.
            </p>

            <a
              href="#"
              className="btn-primary text-white text-[17px] font-medium px-8 py-4 rounded-full no-underline inline-block"
            >
              Get Started
            </a>

            <p className="text-[13px] text-muted mt-4">
              3-day free trial &bull; Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
