/**
 * @meta
 * category: landing
 * name: portfolio-landing
 * description: Minimal portfolio and personal page with project grid and about section
 * tags: [landing, portfolio, personal, minimal, projects]
 * source: seed
 */
export default function PortfolioLanding() {
  return (
    <div style={{ fontFamily: "var(--ds-font-body, 'Inter', sans-serif)", backgroundColor: "var(--ds-surface-background)", color: "var(--ds-text-primary)", margin: 0, padding: 0 }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--ds-spacing-2xl)", height: "60px", borderBottom: "1px solid var(--ds-border-subtle)" }}>
        <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em" }}>Alex Chen</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-xl)" }}>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}>Work</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}>About</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}>Writing</a>
          <a href="#" style={{ color: "var(--ds-brand-primary)", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600 }}>Resume ↗</a>
        </div>
      </nav>

      {/* Intro */}
      <section style={{ padding: "5rem var(--ds-spacing-2xl) 4rem", maxWidth: "780px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-md)", marginBottom: "var(--ds-spacing-lg)" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", backgroundColor: "var(--ds-brand-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>👋</div>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--ds-status-success)" }} />
          <span style={{ fontSize: "0.85rem", color: "var(--ds-text-secondary)" }}>Available for new projects</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 var(--ds-spacing-lg)" }}>
          Hi, I'm <span style={{ color: "var(--ds-brand-primary)" }}>Alex Chen</span>
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--ds-text-secondary)", lineHeight: 1.7, margin: "0 0 var(--ds-spacing-xl)", maxWidth: "620px" }}>
          Product designer & front-end developer. I help startups ship well-considered software — from early wireframes to production-ready interfaces.
        </p>
        <div style={{ display: "flex", gap: "var(--ds-spacing-md)", flexWrap: "wrap" }}>
          <a href="#" style={{ backgroundColor: "var(--ds-brand-primary)", color: "#fff", padding: "0.75rem 1.75rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>See my work</a>
          <a href="mailto:alex@example.com" style={{ backgroundColor: "var(--ds-surface-elevated)", color: "var(--ds-text-primary)", padding: "0.75rem 1.75rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem", border: "1px solid var(--ds-border-default)" }}>Say hello</a>
        </div>
      </section>

      {/* Projects grid */}
      <section style={{ padding: "0 var(--ds-spacing-2xl) 5rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--ds-spacing-xl)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Selected work</h2>
          <a href="#" style={{ color: "var(--ds-text-link)", textDecoration: "none", fontSize: "0.875rem" }}>View all →</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-spacing-lg)" }}>
          {[
            { color: "#6366f1", tag: "Product Design", title: "Meridian OS", desc: "End-to-end redesign of a B2B SaaS dashboard serving 50k users. Reduced support tickets by 34%." },
            { color: "#ec4899", tag: "Branding + Web", title: "Swell Coffee Co.", desc: "Brand identity, packaging, and e-commerce site for a specialty coffee roaster. 3× revenue growth." },
            { color: "#10b981", tag: "Mobile App", title: "Tempo Finance", desc: "Personal budgeting app for iOS. Reached #4 in Finance on the App Store within two weeks of launch." },
            { color: "#f59e0b", tag: "Design System", title: "Atlas DS", desc: "Component library and documentation site for a series-B fintech. Covers 200+ components." },
            { color: "#3b82f6", tag: "Full-Stack", title: "Relay CMS", desc: "Headless CMS with live-preview and multi-locale support. Built with Next.js, Postgres, and tRPC." },
            { color: "#8b5cf6", tag: "Motion Design", title: "Orbit Onboarding", desc: "Animated onboarding sequence for a productivity app. 22% lift in activation rate." },
          ].map((p) => (
            <a href="#" key={p.title} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <div style={{ borderRadius: "var(--ds-radius-medium)", overflow: "hidden", border: "1px solid var(--ds-border-default)", backgroundColor: "var(--ds-surface-elevated)", transition: "box-shadow 0.15s" }}>
                <div style={{ height: "200px", backgroundColor: p.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>{p.title}</span>
                </div>
                <div style={{ padding: "var(--ds-spacing-lg)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ds-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{p.tag}</span>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "var(--ds-spacing-xs) 0 var(--ds-spacing-sm)", letterSpacing: "-0.01em" }}>{p.title}</h3>
                  <p style={{ color: "var(--ds-text-secondary)", fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* About */}
      <section style={{ backgroundColor: "var(--ds-surface-elevated)", borderTop: "1px solid var(--ds-border-subtle)", borderBottom: "1px solid var(--ds-border-subtle)", padding: "5rem var(--ds-spacing-2xl)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: "5rem", alignItems: "start" }}>
          <div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 var(--ds-spacing-xl)" }}>About me</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-spacing-sm)" }}>
              {[
                { label: "Based in", value: "San Francisco, CA" },
                { label: "Experience", value: "7 years" },
                { label: "Tools", value: "Figma, VS Code, React" },
                { label: "Education", value: "BFA, RISD" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-spacing-sm) 0", borderBottom: "1px solid var(--ds-border-subtle)" }}>
                  <span style={{ color: "var(--ds-text-muted)", fontSize: "0.85rem" }}>{item.label}</span>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "var(--ds-text-secondary)", marginBottom: "var(--ds-spacing-lg)" }}>
              I'm a product designer and front-end developer with seven years of experience helping startups and scale-ups ship software that people actually want to use. I've worked embedded in product teams, led design at two startups, and freelanced for clients across fintech, health, and consumer products.
            </p>
            <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "var(--ds-text-secondary)", marginBottom: "var(--ds-spacing-lg)" }}>
              My approach sits at the intersection of craft and strategy. I think deeply about systems — not just individual screens — and I care as much about why we're building something as how it looks. I write production-grade React and CSS, which means fewer handoff gaps and faster iteration.
            </p>
            <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "var(--ds-text-secondary)" }}>
              When I'm not designing or coding, I'm probably cycling around Marin County, reading about type history, or experimenting with generative art.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "var(--ds-spacing-xl) var(--ds-spacing-2xl)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--ds-spacing-md)", fontSize: "0.875rem", color: "var(--ds-text-secondary)" }}>
          <span>© 2025 Alex Chen</span>
          <div style={{ display: "flex", gap: "var(--ds-spacing-lg)" }}>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Twitter</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>GitHub</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Dribbble</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>LinkedIn</a>
            <a href="mailto:alex@example.com" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
