/**
 * @meta
 * category: marketing
 * name: about-page
 * description: About/company page with mission, values, timeline, and team
 * tags: [marketing, about, team, company, mission]
 * source: seed
 */
export default function AboutPage() {
  const values = [
    {
      icon: "💡",
      title: "Innovation",
      description: "We push the boundaries of what's possible, constantly questioning the status quo to build tools that genuinely change how teams work.",
    },
    {
      icon: "🔍",
      title: "Transparency",
      description: "We believe trust is earned through openness. Our roadmap, pricing, and decision-making are visible to everyone — inside and outside the company.",
    },
    {
      icon: "🌐",
      title: "Community",
      description: "We grow alongside our users. Every product decision starts with listening — to feedback, to pain points, and to the ideas our community brings us.",
    },
    {
      icon: "⭐",
      title: "Excellence",
      description: "Good enough is never good enough. We obsess over details — from pixel-perfect design to millisecond response times — because your work deserves it.",
    },
  ];

  const milestones = [
    {
      year: "2020",
      title: "Founded in San Francisco",
      description: "Three engineers left their jobs to build the collaboration tool they always wished existed. CloudSync was born in a two-bedroom apartment.",
    },
    {
      year: "2021",
      title: "Series A — $12M raised",
      description: "With 1,200 paying customers and 40% month-over-month growth, we closed our Series A led by Benchmark Capital and expanded to 25 employees.",
    },
    {
      year: "2023",
      title: "10,000 customers worldwide",
      description: "We crossed 10K customers across 60+ countries, launched our mobile apps, and introduced the CloudSync API — now used by over 500 developers.",
    },
    {
      year: "2024",
      title: "Global expansion",
      description: "We opened offices in London and Singapore, launched CloudSync in 12 new languages, and onboarded our first Fortune 500 enterprise customers.",
    },
  ];

  const team = [
    { name: "Alex Rivera", title: "Co-founder & CEO", color: "var(--ds-brand-primary)" },
    { name: "Jordan Kim", title: "Co-founder & CTO", color: "var(--ds-brand-secondary)" },
    { name: "Sam Okafor", title: "Co-founder & CPO", color: "var(--ds-brand-accent)" },
    { name: "Priya Patel", title: "VP of Engineering", color: "var(--ds-text-secondary)" },
    { name: "Marcus Chen", title: "Head of Design", color: "var(--ds-brand-primary)" },
    { name: "Leila Hassan", title: "VP of Marketing", color: "var(--ds-brand-secondary)" },
  ];

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
          <a href="#" style={{ color: "var(--ds-brand-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>About</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-md)" }}>
          <a href="#" style={{ color: "var(--ds-text-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>Sign in</a>
          <a href="#" style={{ backgroundColor: "var(--ds-brand-primary)", color: "var(--ds-surface-elevated)", padding: "0.5rem 1.25rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Get started</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "var(--ds-spacing-2xl) var(--ds-spacing-2xl)", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--ds-spacing-xs)", backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-subtle)", borderRadius: "var(--ds-radius-full)", padding: "0.25rem 1rem", fontSize: "0.8rem", color: "var(--ds-brand-primary)", fontWeight: 600, marginBottom: "var(--ds-spacing-lg)" }}>
          Our story
        </div>
        <h1 style={{ fontSize: "3.25rem", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: "var(--ds-spacing-lg)", lineHeight: 1.1 }}>
          Building the future of<br />digital collaboration
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--ds-text-secondary)", lineHeight: 1.7, margin: 0 }}>
          We started CloudSync because we were tired of switching between a dozen tools just to get work done. Today, over 10,000 teams around the world use our platform to ship faster, communicate better, and build things that matter. We're just getting started.
        </p>
      </section>

      {/* Stats bar */}
      <section style={{ backgroundColor: "var(--ds-surface-elevated)", borderTop: "1px solid var(--ds-border-subtle)", borderBottom: "1px solid var(--ds-border-subtle)", padding: "var(--ds-spacing-xl) var(--ds-spacing-2xl)" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--ds-spacing-2xl)", flexWrap: "wrap" }}>
          {[
            { value: "10,000+", label: "Customers worldwide" },
            { value: "60+", label: "Countries served" },
            { value: "99.99%", label: "Uptime SLA" },
            { value: "85", label: "Team members" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.04em", color: "var(--ds-brand-primary)" }}>{stat.value}</div>
              <div style={{ fontSize: "0.875rem", color: "var(--ds-text-secondary)", marginTop: "2px" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: "var(--ds-spacing-2xl)", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--ds-spacing-xl)" }}>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "var(--ds-spacing-sm)" }}>What we believe in</h2>
          <p style={{ color: "var(--ds-text-secondary)", fontSize: "1rem", margin: 0 }}>The principles that guide every decision we make</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-spacing-lg)" }}>
          {values.map((value) => (
            <div key={value.title} style={{ backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-xl)", boxShadow: "var(--ds-shadow-sm)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "var(--ds-spacing-md)" }}>{value.icon}</div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "var(--ds-spacing-sm)" }}>{value.title}</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--ds-text-secondary)", lineHeight: 1.7, margin: 0 }}>{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding: "var(--ds-spacing-2xl)", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--ds-spacing-xl)" }}>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "var(--ds-spacing-sm)" }}>Our journey</h2>
          <p style={{ color: "var(--ds-text-secondary)", fontSize: "1rem", margin: 0 }}>From a two-bedroom apartment to a global company</p>
        </div>
        <div style={{ position: "relative" }}>
          {/* Vertical line */}
          <div style={{ position: "absolute", left: "80px", top: "24px", bottom: "24px", width: "2px", backgroundColor: "var(--ds-border-default)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-spacing-xl)" }}>
            {milestones.map((m) => (
              <div key={m.year} style={{ display: "flex", gap: "var(--ds-spacing-xl)", alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: "80px", textAlign: "right", paddingRight: "var(--ds-spacing-lg)", position: "relative" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--ds-brand-primary)" }}>{m.year}</span>
                  {/* Dot */}
                  <div style={{ position: "absolute", right: "-6px", top: "2px", width: "12px", height: "12px", borderRadius: "var(--ds-radius-full)", backgroundColor: "var(--ds-brand-primary)", border: "2px solid var(--ds-surface-background)" }} />
                </div>
                <div style={{ flex: 1, backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-lg)", boxShadow: "var(--ds-shadow-sm)" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "var(--ds-spacing-xs)" }}>{m.title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--ds-text-secondary)", margin: 0, lineHeight: 1.65 }}>{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section style={{ padding: "var(--ds-spacing-2xl)", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--ds-spacing-xl)" }}>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "var(--ds-spacing-sm)" }}>Meet the team</h2>
          <p style={{ color: "var(--ds-text-secondary)", fontSize: "1rem", margin: 0 }}>The people building CloudSync every day</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-spacing-lg)" }}>
          {team.map((member) => (
            <div key={member.name} style={{ backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-xl)", textAlign: "center", boxShadow: "var(--ds-shadow-sm)" }}>
              {/* Avatar placeholder */}
              <div style={{ width: "72px", height: "72px", borderRadius: "var(--ds-radius-full)", backgroundColor: member.color, margin: "0 auto var(--ds-spacing-md)", opacity: 0.85, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700, color: "var(--ds-surface-elevated)" }}>
                {member.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "4px" }}>{member.name}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--ds-text-secondary)" }}>{member.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: "var(--ds-brand-primary)", padding: "var(--ds-spacing-2xl)", textAlign: "center", margin: "var(--ds-spacing-xl) 0 0" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ds-surface-elevated)", letterSpacing: "-0.03em", marginBottom: "var(--ds-spacing-md)" }}>Join our team</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem", marginBottom: "var(--ds-spacing-xl)", lineHeight: 1.6 }}>
          We're hiring across engineering, design, and product. Come build something meaningful.
        </p>
        <a href="#" style={{ display: "inline-block", backgroundColor: "var(--ds-surface-elevated)", color: "var(--ds-brand-primary)", padding: "0.875rem 2.5rem", borderRadius: "var(--ds-radius-full)", fontWeight: 700, fontSize: "1rem", textDecoration: "none" }}>
          View open roles →
        </a>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--ds-border-subtle)", padding: "var(--ds-spacing-xl) var(--ds-spacing-2xl)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--ds-spacing-md)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-sm)" }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "var(--ds-radius-soft)", backgroundColor: "var(--ds-brand-primary)" }} />
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>CloudSync</span>
        </div>
        <div style={{ display: "flex", gap: "var(--ds-spacing-xl)" }}>
          <a href="#" style={{ color: "var(--ds-text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>Privacy</a>
          <a href="#" style={{ color: "var(--ds-text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>Terms</a>
          <a href="#" style={{ color: "var(--ds-text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>Careers</a>
          <a href="#" style={{ color: "var(--ds-text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>Contact</a>
        </div>
        <span style={{ color: "var(--ds-text-muted)", fontSize: "0.85rem" }}>© 2025 CloudSync, Inc. All rights reserved.</span>
      </footer>

    </div>
  );
}
