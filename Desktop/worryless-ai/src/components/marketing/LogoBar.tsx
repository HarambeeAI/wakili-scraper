const logos = [
  { name: 'Uber', svg: <svg viewBox="0 0 100 30" className="h-5 md:h-6 w-auto opacity-40 hover:opacity-60 transition-opacity"><text x="0" y="22" fontFamily="Inter Tight, sans-serif" fontWeight="700" fontSize="22" fill="#0a0a0a">Uber</text></svg> },
  { name: 'Tesla', svg: <svg viewBox="0 0 100 30" className="h-5 md:h-6 w-auto opacity-40 hover:opacity-60 transition-opacity"><text x="0" y="22" fontFamily="Inter Tight, sans-serif" fontWeight="700" fontSize="22" fill="#0a0a0a">Tesla</text></svg> },
  { name: 'Google', svg: <svg viewBox="0 0 120 30" className="h-5 md:h-6 w-auto opacity-40 hover:opacity-60 transition-opacity"><text x="0" y="22" fontFamily="Inter Tight, sans-serif" fontWeight="700" fontSize="22" fill="#0a0a0a">Google</text></svg> },
  { name: 'Microsoft', svg: <svg viewBox="0 0 160 30" className="h-5 md:h-6 w-auto opacity-40 hover:opacity-60 transition-opacity"><text x="0" y="22" fontFamily="Inter Tight, sans-serif" fontWeight="700" fontSize="22" fill="#0a0a0a">Microsoft</text></svg> },
  { name: 'Meta', svg: <svg viewBox="0 0 100 30" className="h-5 md:h-6 w-auto opacity-40 hover:opacity-60 transition-opacity"><text x="0" y="22" fontFamily="Inter Tight, sans-serif" fontWeight="700" fontSize="22" fill="#0a0a0a">Meta</text></svg> },
  { name: 'Scale', svg: <svg viewBox="0 0 100 30" className="h-5 md:h-6 w-auto opacity-40 hover:opacity-60 transition-opacity"><text x="0" y="22" fontFamily="Inter Tight, sans-serif" fontWeight="700" fontSize="22" fill="#0a0a0a">Scale</text></svg> },
]

export default function LogoBar() {
  return (
    <section className="py-10 px-5">
      <div className="max-w-[1100px] mx-auto text-center">
        <p className="text-[12px] font-medium tracking-[0.15em] uppercase text-muted mb-6">
          BUILT BY THE TEAM FROM
        </p>
        <div className="flex items-center justify-center gap-8 md:gap-14 flex-wrap">
          {logos.map((logo) => (
            <div key={logo.name}>{logo.svg}</div>
          ))}
        </div>

        <p className="text-[17px] md:text-[20px] text-muted-dark leading-relaxed max-w-[600px] mx-auto mt-10">
          We execute campaigns, create content, analyze performance, and deliver insights. You get expert execution — without the overhead.
        </p>
      </div>
    </section>
  )
}
