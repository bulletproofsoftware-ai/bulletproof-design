/**
 * @meta
 * category: marketing
 * name: blog-listing
 * description: Blog post listing page with featured post, category filters, and pagination
 * tags: [marketing, blog, articles, listing, pagination]
 * source: seed
 */
export default function BlogListing() {
  const categories = ["All", "Engineering", "Product", "Design", "Company"];

  const featuredPost = {
    title: "Introducing CloudSync 3.0: Real-time Everything",
    excerpt: "Today we're launching the biggest update in CloudSync's history. Version 3.0 brings true real-time collaboration, a redesigned editor, instant file sync, and a brand-new API that makes building on top of CloudSync easier than ever before.",
    date: "March 28, 2025",
    author: "Alex Rivera",
    authorInitials: "AR",
    category: "Product",
    readTime: "8 min read",
    color: "var(--ds-brand-primary)",
  };

  const posts = [
    {
      title: "Building Scalable APIs with GraphQL Federation",
      excerpt: "How we migrated from a REST monolith to a federated GraphQL architecture — and what we learned along the way.",
      date: "March 20, 2025",
      author: "Jordan Kim",
      authorInitials: "JK",
      category: "Engineering",
      readTime: "12 min read",
      color: "var(--ds-brand-secondary)",
    },
    {
      title: "Design Systems at Scale: Lessons from Building Ours",
      excerpt: "After two years and three major iterations, here's everything we wish we'd known before starting our design system from scratch.",
      date: "March 14, 2025",
      author: "Marcus Chen",
      authorInitials: "MC",
      category: "Design",
      readTime: "10 min read",
      color: "var(--ds-brand-accent)",
    },
    {
      title: "Our Journey to SOC 2 Type II Certification",
      excerpt: "Security compliance doesn't have to be painful. Here's the 90-day roadmap we followed to achieve SOC 2 Type II without burning out the team.",
      date: "March 7, 2025",
      author: "Priya Patel",
      authorInitials: "PP",
      category: "Company",
      readTime: "7 min read",
      color: "var(--ds-text-secondary)",
    },
    {
      title: "Why We Rebuilt Our Search Infrastructure from Scratch",
      excerpt: "Sub-100ms search across millions of files isn't easy. We replaced Elasticsearch with a custom Rust-based engine and cut costs by 60%.",
      date: "Feb 27, 2025",
      author: "Jordan Kim",
      authorInitials: "JK",
      category: "Engineering",
      readTime: "15 min read",
      color: "var(--ds-brand-primary)",
    },
    {
      title: "How We Redesigned Onboarding and Doubled Activation",
      excerpt: "A deep dive into the user research, experiments, and design decisions that took our 7-day activation rate from 34% to 71%.",
      date: "Feb 19, 2025",
      author: "Sam Okafor",
      authorInitials: "SO",
      category: "Product",
      readTime: "9 min read",
      color: "var(--ds-brand-secondary)",
    },
    {
      title: "The Case for Slow Hiring: Building a Team That Lasts",
      excerpt: "We turned down 200 candidates to hire 8 people last year. Here's why we believe hiring slowly is one of the best investments a startup can make.",
      date: "Feb 11, 2025",
      author: "Leila Hassan",
      authorInitials: "LH",
      category: "Company",
      readTime: "6 min read",
      color: "var(--ds-brand-accent)",
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
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Pricing</a>
          <a href="#" style={{ color: "var(--ds-text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Docs</a>
          <a href="#" style={{ color: "var(--ds-brand-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>Blog</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-md)" }}>
          <a href="#" style={{ color: "var(--ds-text-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>Sign in</a>
          <a href="#" style={{ backgroundColor: "var(--ds-brand-primary)", color: "var(--ds-surface-elevated)", padding: "0.5rem 1.25rem", borderRadius: "var(--ds-radius-full)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Get started</a>
        </div>
      </nav>

      {/* Page Header */}
      <section style={{ padding: "var(--ds-spacing-2xl) var(--ds-spacing-2xl) var(--ds-spacing-lg)", maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "2.75rem", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: "var(--ds-spacing-sm)" }}>Blog</h1>
        <p style={{ fontSize: "1.1rem", color: "var(--ds-text-secondary)", margin: "0 0 var(--ds-spacing-xl)" }}>Insights, tutorials, and updates from the CloudSync team</p>

        {/* Category chips */}
        <div style={{ display: "flex", gap: "var(--ds-spacing-sm)", flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button key={cat} style={{
              padding: "0.4rem 1rem", borderRadius: "var(--ds-radius-full)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", border: "1px solid",
              backgroundColor: cat === "All" ? "var(--ds-brand-primary)" : "transparent",
              color: cat === "All" ? "var(--ds-surface-elevated)" : "var(--ds-text-secondary)",
              borderColor: cat === "All" ? "var(--ds-brand-primary)" : "var(--ds-border-default)",
            }}>
              {cat}
            </button>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 var(--ds-spacing-2xl) var(--ds-spacing-2xl)" }}>

        {/* Featured Post */}
        <div style={{ backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", overflow: "hidden", marginBottom: "var(--ds-spacing-2xl)", boxShadow: "var(--ds-shadow-md)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {/* Image placeholder */}
          <div style={{ backgroundColor: featuredPost.color, minHeight: "320px", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.9 }}>
            <div style={{ textAlign: "center", color: "var(--ds-surface-elevated)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🚀</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, opacity: 0.8 }}>{featuredPost.category}</div>
            </div>
          </div>
          {/* Content */}
          <div style={{ padding: "var(--ds-spacing-2xl)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-sm)", marginBottom: "var(--ds-spacing-md)" }}>
              <span style={{ backgroundColor: "var(--ds-brand-primary)", color: "var(--ds-surface-elevated)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0.2rem 0.6rem", borderRadius: "var(--ds-radius-full)" }}>Featured</span>
              <span style={{ fontSize: "0.8rem", color: "var(--ds-text-muted)" }}>{featuredPost.readTime}</span>
            </div>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.25, marginBottom: "var(--ds-spacing-md)" }}>{featuredPost.title}</h2>
            <p style={{ fontSize: "0.95rem", color: "var(--ds-text-secondary)", lineHeight: 1.7, marginBottom: "var(--ds-spacing-lg)" }}>{featuredPost.excerpt}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-sm)" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "var(--ds-radius-full)", backgroundColor: "var(--ds-brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--ds-surface-elevated)" }}>
                  {featuredPost.authorInitials}
                </div>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{featuredPost.author}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ds-text-muted)" }}>{featuredPost.date}</div>
                </div>
              </div>
              <a href="#" style={{ color: "var(--ds-brand-primary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Read more →</a>
            </div>
          </div>
        </div>

        {/* Post Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-spacing-lg)" }}>
          {posts.map((post) => (
            <article key={post.title} style={{ backgroundColor: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-medium)", overflow: "hidden", boxShadow: "var(--ds-shadow-sm)", display: "flex", flexDirection: "column" }}>
              {/* Image placeholder */}
              <div style={{ backgroundColor: post.color, height: "160px", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ds-surface-elevated)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.9 }}>{post.category}</span>
              </div>
              {/* Content */}
              <div style={{ padding: "var(--ds-spacing-lg)", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--ds-text-muted)", marginBottom: "var(--ds-spacing-sm)" }}>{post.readTime}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.35, marginBottom: "var(--ds-spacing-sm)", flex: 1 }}>{post.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--ds-text-secondary)", lineHeight: 1.6, marginBottom: "var(--ds-spacing-md)" }}>{post.excerpt}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--ds-border-subtle)", paddingTop: "var(--ds-spacing-md)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-xs)" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "var(--ds-radius-full)", backgroundColor: post.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, color: "var(--ds-surface-elevated)", opacity: 0.9 }}>
                      {post.authorInitials}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.775rem", fontWeight: 600 }}>{post.author}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--ds-text-muted)" }}>{post.date}</div>
                    </div>
                  </div>
                  <a href="#" style={{ color: "var(--ds-text-link)", textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 }}>Read →</a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--ds-spacing-xs)", marginTop: "var(--ds-spacing-2xl)" }}>
          {["← Previous", "1", "2", "3", "Next →"].map((page, i) => (
            <a key={i} href="#" style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: "40px", height: "40px", padding: "0 var(--ds-spacing-md)",
              borderRadius: "var(--ds-radius-soft)",
              fontSize: "0.875rem", fontWeight: page === "1" ? 700 : 500,
              textDecoration: "none",
              backgroundColor: page === "1" ? "var(--ds-brand-primary)" : "var(--ds-surface-elevated)",
              color: page === "1" ? "var(--ds-surface-elevated)" : "var(--ds-text-secondary)",
              border: `1px solid ${page === "1" ? "var(--ds-brand-primary)" : "var(--ds-border-default)"}`,
            }}>
              {page}
            </a>
          ))}
        </div>
      </div>

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
