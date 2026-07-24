/**
 * @meta
 * category: ecommerce
 * name: product-page
 * description: Product detail page with gallery, details, and reviews
 * tags: [ecommerce, product, shopping, reviews]
 * source: seed
 */
export default function ProductPage() {
  return (
    <div style={{ fontFamily: "var(--ds-font-body, 'Inter', sans-serif)", backgroundColor: "var(--ds-surface-background)", color: "var(--ds-text-primary)", minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ backgroundColor: "var(--ds-surface-elevated)", borderBottom: "1px solid var(--ds-border-default)", padding: "var(--ds-spacing-sm) var(--ds-spacing-xl)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--ds-brand-primary)" }}>Auralia Store</span>
        <div style={{ display: "flex", gap: "var(--ds-spacing-lg)", fontSize: "0.9rem", color: "var(--ds-text-secondary)" }}>
          <span style={{ cursor: "pointer" }}>Shop</span>
          <span style={{ cursor: "pointer" }}>Deals</span>
          <span style={{ cursor: "pointer" }}>Support</span>
        </div>
        <div style={{ display: "flex", gap: "var(--ds-spacing-md)" }}>
          <span style={{ cursor: "pointer", color: "var(--ds-text-secondary)" }}>Search</span>
          <span style={{ cursor: "pointer", color: "var(--ds-text-secondary)" }}>Cart (2)</span>
        </div>
      </nav>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "var(--ds-spacing-lg) var(--ds-spacing-xl)" }}>
        {/* Breadcrumbs */}
        <nav style={{ marginBottom: "var(--ds-spacing-lg)", fontSize: "0.85rem", color: "var(--ds-text-muted)" }}>
          <span style={{ color: "var(--ds-text-link)", cursor: "pointer" }}>Home</span>
          <span style={{ margin: "0 var(--ds-spacing-xs)" }}>/</span>
          <span style={{ color: "var(--ds-text-link)", cursor: "pointer" }}>Headphones</span>
          <span style={{ margin: "0 var(--ds-spacing-xs)" }}>/</span>
          <span>Aura Pro Wireless Headphones</span>
        </nav>

        {/* Two-column product layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ds-spacing-2xl)", marginBottom: "var(--ds-spacing-2xl)" }}>
          {/* Left: Image Gallery */}
          <div>
            {/* Main image */}
            <div style={{ backgroundColor: "var(--ds-brand-secondary)", borderRadius: "var(--ds-radius-medium)", height: "420px", marginBottom: "var(--ds-spacing-md)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-surface-elevated)", fontSize: "1rem", fontWeight: 500, boxShadow: "var(--ds-shadow-md)" }}>
              Product Image
            </div>
            {/* Thumbnails */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--ds-spacing-sm)" }}>
              {["View 1", "View 2", "View 3", "View 4"].map((label, i) => (
                <div key={i} style={{ backgroundColor: i === 0 ? "var(--ds-brand-primary)" : "var(--ds-border-subtle)", borderRadius: "var(--ds-radius-soft)", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: i === 0 ? "var(--ds-surface-elevated)" : "var(--ds-text-muted)", cursor: "pointer", border: i === 0 ? "2px solid var(--ds-brand-primary)" : "2px solid var(--ds-border-default)" }}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Product Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-spacing-md)" }}>
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--ds-brand-primary)", fontWeight: 600, marginBottom: "var(--ds-spacing-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Auralia Audio</p>
              <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ds-text-primary)", margin: 0, lineHeight: 1.2 }}>Aura Pro Wireless Headphones</h1>
            </div>

            {/* Rating */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-sm)" }}>
              <div style={{ display: "flex", gap: "2px" }}>
                {[1,2,3,4,5].map(star => (
                  <span key={star} style={{ color: star <= 5 ? "var(--ds-status-warning)" : "var(--ds-border-default)", fontSize: "1.1rem" }}>★</span>
                ))}
              </div>
              <span style={{ fontWeight: 600, color: "var(--ds-text-primary)" }}>4.8</span>
              <span style={{ color: "var(--ds-text-link)", cursor: "pointer", fontSize: "0.9rem" }}>128 reviews</span>
            </div>

            {/* Price */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--ds-spacing-sm)" }}>
              <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ds-text-primary)" }}>$349.00</span>
              <span style={{ fontSize: "1.1rem", color: "var(--ds-text-muted)", textDecoration: "line-through" }}>$429.00</span>
              <span style={{ fontSize: "0.85rem", backgroundColor: "var(--ds-status-success)", color: "var(--ds-surface-elevated)", padding: "2px 8px", borderRadius: "var(--ds-radius-full)", fontWeight: 600 }}>Save 19%</span>
            </div>

            {/* Description */}
            <p style={{ color: "var(--ds-text-secondary)", lineHeight: 1.7, margin: 0, fontSize: "0.95rem" }}>
              Experience audio like never before with the Aura Pro. Industry-leading active noise cancellation, 40-hour battery life, and premium drivers deliver exceptional sound quality for music, calls, and everything in between.
            </p>

            {/* Color selector */}
            <div>
              <p style={{ fontWeight: 600, color: "var(--ds-text-primary)", marginBottom: "var(--ds-spacing-sm)", fontSize: "0.9rem" }}>Color: <span style={{ fontWeight: 400, color: "var(--ds-text-secondary)" }}>Midnight</span></p>
              <div style={{ display: "flex", gap: "var(--ds-spacing-sm)" }}>
                {[
                  { label: "Midnight", color: "var(--ds-text-primary)" },
                  { label: "Silver", color: "var(--ds-border-default)" },
                  { label: "Rose", color: "var(--ds-brand-secondary)" }
                ].map((swatch, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "var(--ds-radius-full)", backgroundColor: swatch.color, border: i === 0 ? "3px solid var(--ds-brand-primary)" : "2px solid var(--ds-border-default)", boxShadow: i === 0 ? "var(--ds-shadow-sm)" : "none" }} />
                    <span style={{ fontSize: "0.75rem", color: i === 0 ? "var(--ds-text-primary)" : "var(--ds-text-muted)" }}>{swatch.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Size selector */}
            <div>
              <p style={{ fontWeight: 600, color: "var(--ds-text-primary)", marginBottom: "var(--ds-spacing-sm)", fontSize: "0.9rem" }}>Size</p>
              <div style={{ display: "flex", gap: "var(--ds-spacing-sm)" }}>
                {["Standard", "Large"].map((size, i) => (
                  <button key={i} style={{ padding: "var(--ds-spacing-xs) var(--ds-spacing-lg)", border: i === 0 ? "2px solid var(--ds-brand-primary)" : "2px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-soft)", backgroundColor: i === 0 ? "var(--ds-brand-primary)" : "transparent", color: i === 0 ? "var(--ds-surface-elevated)" : "var(--ds-text-secondary)", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" }}>
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity selector */}
            <div>
              <p style={{ fontWeight: 600, color: "var(--ds-text-primary)", marginBottom: "var(--ds-spacing-sm)", fontSize: "0.9rem" }}>Quantity</p>
              <div style={{ display: "flex", alignItems: "center", gap: "0", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-soft)", width: "fit-content" }}>
                <button style={{ width: "40px", height: "40px", border: "none", backgroundColor: "transparent", cursor: "pointer", fontSize: "1.2rem", color: "var(--ds-text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ width: "48px", textAlign: "center", fontWeight: 600, color: "var(--ds-text-primary)", borderLeft: "1px solid var(--ds-border-default)", borderRight: "1px solid var(--ds-border-default)", lineHeight: "40px" }}>1</span>
                <button style={{ width: "40px", height: "40px", border: "none", backgroundColor: "transparent", cursor: "pointer", fontSize: "1.2rem", color: "var(--ds-text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>

            {/* Add to Cart */}
            <button style={{ width: "100%", padding: "var(--ds-spacing-md)", backgroundColor: "var(--ds-brand-primary)", color: "var(--ds-surface-elevated)", border: "none", borderRadius: "var(--ds-radius-medium)", fontSize: "1rem", fontWeight: 700, cursor: "pointer", boxShadow: "var(--ds-shadow-md)", letterSpacing: "0.02em" }}>
              Add to Cart
            </button>

            {/* Shipping note */}
            <p style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-xs)", color: "var(--ds-status-success)", fontSize: "0.85rem", margin: 0, fontWeight: 500 }}>
              <span>✓</span> Free shipping on orders over $100
            </p>
          </div>
        </div>

        {/* Reviews Section */}
        <section style={{ marginBottom: "var(--ds-spacing-2xl)" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ds-text-primary)", marginBottom: "var(--ds-spacing-lg)", paddingBottom: "var(--ds-spacing-sm)", borderBottom: "1px solid var(--ds-border-default)" }}>
            Customer Reviews (128)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--ds-spacing-lg)" }}>
            {[
              { name: "Sarah M.", stars: 5, date: "March 12, 2026", text: "Absolutely love these headphones. The noise cancellation is incredible — I can finally focus in a busy office. The sound quality is rich and balanced, and the battery lasts all day." },
              { name: "James T.", stars: 5, date: "February 28, 2026", text: "Best headphones I've ever owned. Comfortable for long sessions, pairing is instant, and the build feels premium. Well worth the investment for anyone serious about audio." },
              { name: "Priya K.", stars: 4, date: "February 14, 2026", text: "Great headphones overall. The sound is excellent and they're very comfortable. I knocked one star off because the companion app could be more intuitive, but the hardware itself is flawless." }
            ].map((review, i) => (
              <div key={i} style={{ backgroundColor: "var(--ds-surface-elevated)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-lg)", boxShadow: "var(--ds-shadow-sm)", border: "1px solid var(--ds-border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--ds-spacing-sm)" }}>
                  <span style={{ fontWeight: 700, color: "var(--ds-text-primary)" }}>{review.name}</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--ds-text-muted)" }}>{review.date}</span>
                </div>
                <div style={{ display: "flex", gap: "2px", marginBottom: "var(--ds-spacing-sm)" }}>
                  {[1,2,3,4,5].map(star => (
                    <span key={star} style={{ color: star <= review.stars ? "var(--ds-status-warning)" : "var(--ds-border-default)", fontSize: "0.9rem" }}>★</span>
                  ))}
                </div>
                <p style={{ color: "var(--ds-text-secondary)", lineHeight: 1.6, margin: 0, fontSize: "0.9rem" }}>{review.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Products */}
        <section style={{ marginBottom: "var(--ds-spacing-2xl)" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ds-text-primary)", marginBottom: "var(--ds-spacing-lg)" }}>You Might Also Like</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--ds-spacing-lg)" }}>
            {[
              { name: "Aura Buds Pro", price: "$199.00" },
              { name: "USB-C Charging Cable", price: "$24.99" },
              { name: "Leather Headphone Case", price: "$59.00" },
              { name: "Aura Studio Speaker", price: "$289.00" }
            ].map((product, i) => (
              <div key={i} style={{ backgroundColor: "var(--ds-surface-elevated)", borderRadius: "var(--ds-radius-medium)", overflow: "hidden", boxShadow: "var(--ds-shadow-sm)", border: "1px solid var(--ds-border-subtle)", cursor: "pointer" }}>
                <div style={{ height: "160px", backgroundColor: "var(--ds-border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-muted)", fontSize: "0.8rem" }}>
                  Product Image
                </div>
                <div style={{ padding: "var(--ds-spacing-md)" }}>
                  <p style={{ fontWeight: 600, color: "var(--ds-text-primary)", margin: "0 0 var(--ds-spacing-xs) 0", fontSize: "0.9rem" }}>{product.name}</p>
                  <p style={{ color: "var(--ds-brand-primary)", fontWeight: 700, margin: 0 }}>{product.price}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer style={{ backgroundColor: "var(--ds-surface-elevated)", borderTop: "1px solid var(--ds-border-default)", padding: "var(--ds-spacing-xl)", textAlign: "center", color: "var(--ds-text-muted)", fontSize: "0.85rem" }}>
        <p style={{ margin: "0 0 var(--ds-spacing-sm) 0" }}>
          <span style={{ color: "var(--ds-text-link)", cursor: "pointer", marginRight: "var(--ds-spacing-md)" }}>Privacy Policy</span>
          <span style={{ color: "var(--ds-text-link)", cursor: "pointer", marginRight: "var(--ds-spacing-md)" }}>Terms of Service</span>
          <span style={{ color: "var(--ds-text-link)", cursor: "pointer" }}>Contact Us</span>
        </p>
        <p style={{ margin: 0 }}>© 2026 Auralia Store. All rights reserved.</p>
      </footer>
    </div>
  );
}
