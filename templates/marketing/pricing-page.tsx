/**
 * @meta
 * category: marketing
 * name: pricing-page
 * description: Pricing page with three tier cards and FAQ
 * tags: [marketing, pricing, plans, comparison]
 * source: seed
 */
export default function PricingPage() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      description: "Perfect for individuals and side projects",
      popular: false,
      features: [
        "5 projects",
        "1GB storage",
        "Community support",
        "Basic analytics",
        "Public repos only",
      ],
      cta: "Get started free",
      ctaStyle: "outline",
    },
    {
      name: "Pro",
      price: "$29",
      period: "/mo",
      description: "Everything you need for growing teams",
      popular: true,
      features: [
        "Unlimited projects",
        "100GB storage",
        "Priority support",
        "Advanced analytics",
        "Custom domains",
        "API access",
        "Private repos",
      ],
      cta: "Start free trial",
      ctaStyle: "filled",
    },
    {
      name: "Enterprise",
      price: "$99",
      period: "/mo",
      description: "Advanced features for large organizations",
      popular: false,
      features: [
        "Everything in Pro",
        "Unlimited storage",
        "Dedicated support",
        "SSO & SAML",
        "Custom integrations",
        "SLA guarantee",
        "Audit logs",
      ],
      cta: "Contact sales",
      ctaStyle: "outline",
    },
  ];

  const faqs = [
    {
      q: "How does billing work?",
      a: "You are billed monthly or annually depending on the plan you choose. Annual plans save you up to 20% compared to monthly billing. Your card is charged automatically at the start of each billing cycle.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes, you can cancel your subscription at any time from your account settings. There are no cancellation fees. Your access continues until the end of the current billing period.",
    },
    {
      q: "How do I upgrade or downgrade my plan?",
      a: "You can change your plan at any time from your billing settings. Upgrades take effect immediately with prorated charges. Downgrades take effect at the start of your next billing cycle.",
    },
    {
      q: "Do you offer custom enterprise pricing?",
      a: "Yes, we work with larger organizations to create tailored plans that fit your specific needs and scale. Contact our sales team to discuss volume discounts, dedicated infrastructure, and custom contract terms.",
    },
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
          <a href="#" style={{ color: "var(--ds-brand-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>Pricing</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Docs</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Blog</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-md)" }}>
          <a href="#" style={{ color: "var(--ds-text-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>Sign in</a>
          <a href="#" style={{ backgroundColor: "var(--ds-brand-primary)", color: "var(--ds-surface-elevated)", padding: "0.5rem 1.25rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Get started</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "var(--ds-spacing-2xl) var(--ds-spacing-2xl) var(--ds-spacing-xl)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--ds-spacing-xs)", backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-subtle)", borderRadius: "var(--ds-radius-full)", padding: "0.25rem 1rem", fontSize: "0.8rem", color: "var(--ds-brand-primary)", fontWeight: 600, marginBottom: "var(--ds-spacing-lg)" }}>
          No hidden fees
        </div>
        <h1 style={{ fontSize: "3rem", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: "var(--ds-spacing-md)", lineHeight: 1.1 }}>
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: "1.125rem", color: "var(--ds-text-secondary)", maxWidth: "520px", margin: "0 auto var(--ds-spacing-xl)", lineHeight: 1.6 }}>
          Choose the plan that fits your team. Upgrade or downgrade at any time — no questions asked.
        </p>

        {/* Toggle (visual only — monthly shown) */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--ds-spacing-md)", backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-full)", padding: "0.25rem" }}>
          <button style={{ backgroundColor: "var(--ds-brand-primary)", color: "var(--ds-surface-elevated)", border: "none", borderRadius: "var(--ds-radius-full)", padding: "0.4rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>Monthly</button>
          <button style={{ backgroundColor: "transparent", color: "var(--ds-text-secondary)", border: "none", borderRadius: "var(--ds-radius-full)", padding: "0.4rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}>
            Annual <span style={{ fontSize: "0.75rem", color: "var(--ds-status-success)", fontWeight: 600 }}>Save 20%</span>
          </button>
        </div>
      </section>

      {/* Pricing Cards */}
      <section style={{ display: "flex", gap: "var(--ds-spacing-lg)", padding: "var(--ds-spacing-lg) var(--ds-spacing-2xl) var(--ds-spacing-2xl)", maxWidth: "1100px", margin: "0 auto", alignItems: "stretch" }}>
        {tiers.map((tier) => (
          <div key={tier.name} style={{ flex: 1, position: "relative", backgroundColor: tier.popular ? "var(--ds-brand-primary)" : "var(--ds-surface-elevated)", border: tier.popular ? "2px solid var(--ds-brand-primary)" : "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-xl)", boxShadow: tier.popular ? "var(--ds-shadow-lg)" : "var(--ds-shadow-sm)", display: "flex", flexDirection: "column" }}>
            {tier.popular && (
              <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", backgroundColor: "var(--ds-brand-accent)", color: "var(--ds-surface-elevated)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.25rem 0.875rem", borderRadius: "var(--ds-radius-full)" }}>
                Most popular
              </div>
            )}

            <div style={{ marginBottom: "var(--ds-spacing-md)" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: tier.popular ? "rgba(255,255,255,0.8)" : "var(--ds-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--ds-spacing-xs)" }}>{tier.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "var(--ds-spacing-xs)" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.04em", color: tier.popular ? "var(--ds-surface-elevated)" : "var(--ds-text-primary)" }}>{tier.price}</span>
                <span style={{ fontSize: "1rem", color: tier.popular ? "rgba(255,255,255,0.7)" : "var(--ds-text-muted)" }}>{tier.period}</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: tier.popular ? "rgba(255,255,255,0.75)" : "var(--ds-text-secondary)", margin: 0, lineHeight: 1.5 }}>{tier.description}</p>
            </div>

            <ul style={{ listStyle: "none", margin: "0 0 var(--ds-spacing-xl)", padding: 0, flex: 1 }}>
              {tier.features.map((feature) => (
                <li key={feature} style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-sm)", fontSize: "0.9rem", color: tier.popular ? "rgba(255,255,255,0.9)" : "var(--ds-text-primary)", padding: "0.35rem 0", borderBottom: `1px solid ${tier.popular ? "rgba(255,255,255,0.1)" : "var(--ds-border-subtle)"}` }}>
                  <span style={{ color: tier.popular ? "var(--ds-surface-elevated)" : "var(--ds-status-success)", fontWeight: 700, fontSize: "1rem" }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <a href="#" style={{
              display: "block", textAlign: "center", textDecoration: "none", fontWeight: 600, fontSize: "0.95rem", padding: "0.75rem 1.5rem", borderRadius: "var(--ds-radius-full)",
              backgroundColor: tier.popular ? "var(--ds-surface-elevated)" : "transparent",
              color: tier.popular ? "var(--ds-brand-primary)" : "var(--ds-text-primary)",
              border: tier.popular ? "none" : "2px solid var(--ds-border-default)",
            }}>
              {tier.cta}
            </a>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: "720px", margin: "0 auto", padding: "var(--ds-spacing-2xl)" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center", marginBottom: "var(--ds-spacing-xl)" }}>Frequently asked questions</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-spacing-md)" }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-lg)" }}>
              <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "var(--ds-spacing-sm)" }}>{faq.q}</div>
              <p style={{ fontSize: "0.9rem", color: "var(--ds-text-secondary)", margin: 0, lineHeight: 1.7 }}>{faq.a}</p>
            </div>
          ))}
        </div>
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
          <a href="#" style={{ color: "var(--ds-text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>Security</a>
          <a href="#" style={{ color: "var(--ds-text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>Contact</a>
        </div>
        <span style={{ color: "var(--ds-text-muted)", fontSize: "0.85rem" }}>© 2025 CloudSync, Inc. All rights reserved.</span>
      </footer>

    </div>
  );
}
