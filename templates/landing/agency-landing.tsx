/**
 * @meta
 * category: landing
 * name: agency-landing
 * description: Creative agency landing page with full-width hero, services, and client logos
 * tags: [landing, agency, creative, services, portfolio]
 * source: seed
 */
export default function AgencyLanding() {
  return (
    <div style={{ fontFamily: "var(--ds-font-body, 'Inter', sans-serif)", backgroundColor: "var(--ds-surface-background)", color: "var(--ds-text-primary)", margin: 0, padding: 0 }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--ds-spacing-2xl)", height: "72px", position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}>
        <span style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.03em", color: "#fff" }}>Forma Studio</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-xl)" }}>
          <a href="#" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "0.9rem" }}>Work</a>
          <a href="#" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "0.9rem" }}>Services</a>
          <a href="#" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "0.9rem" }}>About</a>
          <a href="#" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "0.9rem" }}>Journal</a>
        </div>
        <a href="#" style={{ backgroundColor: "#fff", color: "var(--ds-text-primary)", padding: "0.6rem 1.5rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontSize: "0.875rem", fontWeight: 700 }}>Get in touch</a>
      </nav>

      {/* Hero — full width with gradient */}
      <section style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)", minHeight: "100vh", display: "flex", alignItems: "center", padding: "0 var(--ds-spacing-2xl)", position: "relative", overflow: "hidden" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-120px", right: "-80px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-100px", left: "30%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "1100px", margin: "0 auto", width: "100%", paddingTop: "72px" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: "var(--ds-spacing-lg)" }}>Award-winning digital studio</p>
          <h1 style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.0, color: "#fff", margin: "0 0 var(--ds-spacing-xl)", maxWidth: "800px" }}>
            We craft<br />
            <span style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundImage: "linear-gradient(90deg, #818cf8, #f472b6)", backgroundClip: "text" }}>digital experiences</span><br />
            that endure.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.15rem", maxWidth: "520px", lineHeight: 1.7, marginBottom: "var(--ds-spacing-xl)" }}>
            Forma Studio partners with ambitious brands to build digital products that connect, convert, and outlast the competition.
          </p>
          <div style={{ display: "flex", gap: "var(--ds-spacing-md)", flexWrap: "wrap" }}>
            <a href="#" style={{ backgroundColor: "#fff", color: "#0a0a0a", padding: "0.9rem 2rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" }}>View our work</a>
            <a href="#" style={{ backgroundColor: "transparent", color: "#fff", padding: "0.9rem 2rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontWeight: 600, fontSize: "0.95rem", border: "1px solid rgba(255,255,255,0.25)" }}>Start a project</a>
          </div>
        </div>
      </section>

      {/* Client logos strip */}
      <section style={{ borderBottom: "1px solid var(--ds-border-subtle)", padding: "var(--ds-spacing-xl) var(--ds-spacing-2xl)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <p style={{ textAlign: "center", color: "var(--ds-text-muted)", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "var(--ds-spacing-lg)" }}>Trusted by forward-thinking brands</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "var(--ds-spacing-xl)" }}>
            {["Meridian", "NovaTech", "Arcadia", "BrandX", "Lumio", "Vertex"].map((name) => (
              <span key={name} style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ds-text-muted)", letterSpacing: "-0.02em", opacity: 0.5 }}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section style={{ padding: "5rem var(--ds-spacing-2xl)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ marginBottom: "var(--ds-spacing-2xl)" }}>
            <p style={{ fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ds-brand-primary)", marginBottom: "var(--ds-spacing-sm)" }}>What we do</p>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>Our services</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--ds-spacing-lg)" }}>
            {[
              { num: "01", title: "Strategy", desc: "We dig into your business, your users, and your market to chart a path that makes sense. Research-led strategy from concept through launch." },
              { num: "02", title: "Design", desc: "Interfaces that delight. Motion that feels right. Identity systems that stand out in a crowded world. We design for humans first, screens second." },
              { num: "03", title: "Development", desc: "Full-stack engineering built for scale. We ship fast, iterate faster, and write code that your team will actually want to maintain." },
              { num: "04", title: "Growth", desc: "Post-launch isn't the finish line. We partner long-term to optimize, experiment, and compound your digital advantage over time." },
            ].map((s) => (
              <div key={s.num} style={{ backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-xl)", display: "flex", flexDirection: "column", gap: "var(--ds-spacing-md)" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--ds-text-muted)" }}>{s.num}</span>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>{s.title}</h3>
                <p style={{ color: "var(--ds-text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                <a href="#" style={{ color: "var(--ds-brand-primary)", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>Learn more →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / values */}
      <section style={{ backgroundColor: "var(--ds-surface-elevated)", borderTop: "1px solid var(--ds-border-subtle)", borderBottom: "1px solid var(--ds-border-subtle)", padding: "5rem var(--ds-spacing-2xl)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ds-brand-primary)", marginBottom: "var(--ds-spacing-sm)" }}>About us</p>
            <h2 style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 var(--ds-spacing-lg)" }}>Small team.<br />Outsized impact.</h2>
            <p style={{ color: "var(--ds-text-secondary)", lineHeight: 1.7, marginBottom: "var(--ds-spacing-md)" }}>
              Founded in 2017, Forma Studio is an independent digital studio of 18 designers, engineers, and strategists. We work with 4–6 clients at a time — by design. You get our full attention, not a fraction of it.
            </p>
            <p style={{ color: "var(--ds-text-secondary)", lineHeight: 1.7 }}>
              Our work has been recognized by Awwwards, CSS Design Awards, and Fast Company. More importantly, our clients keep coming back.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-spacing-md)" }}>
            {[
              { value: "8 yrs", label: "In business" },
              { value: "120+", label: "Projects shipped" },
              { value: "94%", label: "Client retention" },
              { value: "18", label: "Team members" },
            ].map((v) => (
              <div key={v.label} style={{ backgroundColor: "var(--ds-surface-background)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-lg)", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em" }}>{v.value}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--ds-text-secondary)", marginTop: "var(--ds-spacing-xs)" }}>{v.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section style={{ padding: "5rem var(--ds-spacing-2xl)", textAlign: "center" }}>
        <div style={{ maxWidth: "620px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 var(--ds-spacing-md)" }}>Have a project in mind?</h2>
          <p style={{ color: "var(--ds-text-secondary)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "var(--ds-spacing-xl)" }}>We take on a limited number of new projects each quarter. Tell us about what you're building.</p>
          <a href="#" style={{ display: "inline-block", backgroundColor: "var(--ds-text-primary)", color: "var(--ds-surface-background)", padding: "1rem 2.5rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontWeight: 700, fontSize: "1rem" }}>Start a conversation</a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: "var(--ds-surface-elevated)", borderTop: "1px solid var(--ds-border-subtle)", padding: "var(--ds-spacing-xl) var(--ds-spacing-2xl)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--ds-spacing-md)", fontSize: "0.875rem", color: "var(--ds-text-secondary)" }}>
          <span style={{ fontWeight: 800, color: "var(--ds-text-primary)", fontSize: "1rem" }}>Forma Studio</span>
          <div style={{ display: "flex", gap: "var(--ds-spacing-xl)" }}>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Work</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Services</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>About</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Careers</a>
          </div>
          <span>© 2025 Forma Studio LLC</span>
        </div>
      </footer>
    </div>
  );
}
