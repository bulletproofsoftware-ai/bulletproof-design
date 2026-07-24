/**
 * @meta
 * category: landing
 * name: saas-landing
 * description: SaaS product landing page with hero, features grid, social proof, and CTA
 * tags: [landing, saas, hero, features, cta, pricing]
 * source: seed
 */
export default function SaasLanding() {
  return (
    <div style={{ fontFamily: "var(--ds-font-body, 'Inter', sans-serif)", backgroundColor: "var(--ds-surface-background)", color: "var(--ds-text-primary)", margin: 0, padding: 0 }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--ds-spacing-2xl)", height: "64px", backgroundColor: "var(--ds-surface-elevated)", borderBottom: "1px solid var(--ds-border-subtle)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-sm)" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "var(--ds-radius-soft)", backgroundColor: "var(--ds-brand-primary)" }} />
          <span style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>CloudSync</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-xl)" }}>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Product</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Pricing</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Docs</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Blog</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-md)" }}>
          <a href="#" style={{ color: "var(--ds-text-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>Sign in</a>
          <a href="#" style={{ backgroundColor: "var(--ds-brand-primary)", color: "#fff", padding: "0.5rem 1.25rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Start free trial</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "var(--ds-spacing-2xl) var(--ds-spacing-2xl)", paddingTop: "5rem", paddingBottom: "5rem", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--ds-spacing-xs)", backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-full)", padding: "0.35rem 1rem", marginBottom: "var(--ds-spacing-lg)", fontSize: "0.8rem", color: "var(--ds-text-secondary)" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--ds-status-success)", display: "inline-block" }} />
          New: Real-time conflict resolution is here
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 3.75rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, margin: "0 0 var(--ds-spacing-lg)" }}>
          Ship faster with<br />
          <span style={{ color: "var(--ds-brand-primary)" }}>CloudSync</span>
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--ds-text-secondary)", maxWidth: "580px", margin: "0 auto var(--ds-spacing-xl)", lineHeight: 1.6 }}>
          Keep your entire team in sync. Real-time collaboration, instant deployments, and zero-config setup so you can focus on building great products.
        </p>
        <div style={{ display: "flex", gap: "var(--ds-spacing-md)", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#" style={{ backgroundColor: "var(--ds-brand-primary)", color: "#fff", padding: "0.85rem 2rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontSize: "1rem", fontWeight: 600, boxShadow: "var(--ds-shadow-md)" }}>Get started free</a>
          <a href="#" style={{ backgroundColor: "var(--ds-surface-elevated)", color: "var(--ds-text-primary)", padding: "0.85rem 2rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontSize: "1rem", fontWeight: 600, border: "1px solid var(--ds-border-default)" }}>Watch demo →</a>
        </div>
        <p style={{ marginTop: "var(--ds-spacing-md)", fontSize: "0.82rem", color: "var(--ds-text-muted)" }}>No credit card required · Free for up to 5 users · Cancel anytime</p>

        {/* Hero image placeholder */}
        <div style={{ marginTop: "var(--ds-spacing-2xl)", borderRadius: "var(--ds-radius-medium)", backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", height: "360px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--ds-shadow-lg)" }}>
          <span style={{ color: "var(--ds-text-muted)", fontSize: "0.875rem" }}>Product screenshot</span>
        </div>
      </section>

      {/* Social proof stats */}
      <section style={{ borderTop: "1px solid var(--ds-border-subtle)", borderBottom: "1px solid var(--ds-border-subtle)", backgroundColor: "var(--ds-surface-elevated)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "var(--ds-spacing-xl) var(--ds-spacing-2xl)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-spacing-xl)", textAlign: "center" }}>
          {[
            { value: "10,000+", label: "Teams shipping daily" },
            { value: "99.9%", label: "Uptime SLA" },
            { value: "4.9 / 5", label: "Average rating" },
          ].map((stat) => (
            <div key={stat.label}>
              <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ds-brand-primary)" }}>{stat.value}</div>
              <div style={{ fontSize: "0.875rem", color: "var(--ds-text-secondary)", marginTop: "var(--ds-spacing-xs)" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "5rem var(--ds-spacing-2xl)", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--ds-spacing-2xl)" }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ds-brand-primary)", marginBottom: "var(--ds-spacing-sm)" }}>Features</p>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 var(--ds-spacing-md)" }}>Everything your team needs</h2>
          <p style={{ color: "var(--ds-text-secondary)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.6 }}>Built for modern development teams that move fast and need their tooling to keep up.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-spacing-lg)" }}>
          {[
            { icon: "⚡", title: "Instant sync", desc: "Changes propagate to every teammate in under 50ms. No manual refreshes, no merge conflicts." },
            { icon: "🔒", title: "Enterprise security", desc: "SOC 2 Type II certified. End-to-end encryption, SSO, and granular permission controls." },
            { icon: "🔗", title: "100+ integrations", desc: "Connect GitHub, Jira, Slack, Linear, Figma, and everything else your team already uses." },
            { icon: "📊", title: "Actionable analytics", desc: "Understand team velocity, deployment frequency, and cycle times with built-in dashboards." },
            { icon: "🚀", title: "One-click deploys", desc: "Push to production from your workflow with zero downtime deployments and instant rollbacks." },
            { icon: "🌍", title: "Global edge network", desc: "Data centers on 6 continents ensure your team gets sub-100ms latency anywhere on Earth." },
          ].map((f) => (
            <div key={f.title} style={{ backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-xl)" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "var(--ds-spacing-md)" }}>{f.icon}</div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 var(--ds-spacing-sm)" }}>{f.title}</h3>
              <p style={{ color: "var(--ds-text-secondary)", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: "var(--ds-brand-primary)", padding: "5rem var(--ds-spacing-2xl)", textAlign: "center" }}>
        <h2 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 var(--ds-spacing-md)" }}>Ready to ship faster?</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem", marginBottom: "var(--ds-spacing-xl)", maxWidth: "460px", margin: "0 auto var(--ds-spacing-xl)" }}>Join 10,000+ teams already using CloudSync to move faster without breaking things.</p>
        <a href="#" style={{ display: "inline-block", backgroundColor: "#fff", color: "var(--ds-brand-primary)", padding: "0.9rem 2.25rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontWeight: 700, fontSize: "1rem" }}>Start your free trial</a>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: "var(--ds-surface-elevated)", borderTop: "1px solid var(--ds-border-subtle)", padding: "var(--ds-spacing-2xl)", color: "var(--ds-text-secondary)", fontSize: "0.875rem" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--ds-spacing-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-sm)" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "var(--ds-radius-soft)", backgroundColor: "var(--ds-brand-primary)" }} />
            <span style={{ fontWeight: 700, color: "var(--ds-text-primary)" }}>CloudSync</span>
          </div>
          <div style={{ display: "flex", gap: "var(--ds-spacing-xl)" }}>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Privacy</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Terms</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Security</a>
            <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none" }}>Status</a>
          </div>
          <span>© 2025 CloudSync, Inc.</span>
        </div>
      </footer>
    </div>
  );
}
