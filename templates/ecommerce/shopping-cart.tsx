/**
 * @meta
 * category: ecommerce
 * name: shopping-cart
 * description: Shopping cart page with item list, quantity controls, and order summary
 * tags: [ecommerce, cart, checkout, shopping]
 * source: seed
 */
export default function ShoppingCart() {
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
          <span style={{ cursor: "pointer", color: "var(--ds-brand-primary)", fontWeight: 600 }}>Cart (3)</span>
        </div>
      </nav>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "var(--ds-spacing-xl)" }}>
        {/* Heading */}
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--ds-text-primary)", marginBottom: "var(--ds-spacing-xl)" }}>
          Shopping Cart <span style={{ fontWeight: 400, color: "var(--ds-text-secondary)", fontSize: "1.2rem" }}>(3 items)</span>
        </h1>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "var(--ds-spacing-xl)", alignItems: "start" }}>
          {/* Left: Item List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-spacing-md)" }}>
            {[
              { name: "Aura Pro Wireless Headphones", detail: "Color: Midnight", price: "$349.00", qty: 1, total: "$349.00" },
              { name: "USB-C Charging Cable", detail: "Length: 2m", price: "$24.99", qty: 2, total: "$49.98" },
              { name: "Leather Headphone Case", detail: "Color: Black", price: "$59.00", qty: 1, total: "$59.00" }
            ].map((item, i) => (
              <div key={i} style={{ backgroundColor: "var(--ds-surface-elevated)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-lg)", display: "grid", gridTemplateColumns: "100px 1fr auto", gap: "var(--ds-spacing-lg)", alignItems: "center", boxShadow: "var(--ds-shadow-sm)", border: "1px solid var(--ds-border-subtle)" }}>
                {/* Image placeholder */}
                <div style={{ height: "100px", backgroundColor: "var(--ds-border-subtle)", borderRadius: "var(--ds-radius-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-muted)", fontSize: "0.7rem", textAlign: "center" }}>
                  Product<br/>Image
                </div>

                {/* Product details */}
                <div>
                  <p style={{ fontWeight: 600, color: "var(--ds-text-primary)", margin: "0 0 4px 0", fontSize: "1rem" }}>{item.name}</p>
                  <p style={{ color: "var(--ds-text-muted)", margin: "0 0 var(--ds-spacing-sm) 0", fontSize: "0.85rem" }}>{item.detail}</p>
                  <p style={{ color: "var(--ds-text-secondary)", margin: "0 0 var(--ds-spacing-md) 0", fontSize: "0.9rem" }}>{item.price} each</p>

                  {/* Quantity selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0", border: "1px solid var(--ds-border-default)", borderRadius: "var(--ds-radius-soft)", width: "fit-content" }}>
                    <button style={{ width: "34px", height: "34px", border: "none", backgroundColor: "transparent", cursor: "pointer", fontSize: "1.1rem", color: "var(--ds-text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ width: "40px", textAlign: "center", fontWeight: 600, color: "var(--ds-text-primary)", borderLeft: "1px solid var(--ds-border-default)", borderRight: "1px solid var(--ds-border-default)", lineHeight: "34px", fontSize: "0.9rem" }}>{item.qty}</span>
                    <button style={{ width: "34px", height: "34px", border: "none", backgroundColor: "transparent", cursor: "pointer", fontSize: "1.1rem", color: "var(--ds-text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>

                {/* Price and remove */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--ds-spacing-sm)" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--ds-text-primary)" }}>{item.total}</span>
                  <span style={{ color: "var(--ds-status-error)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>Remove</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Order Summary */}
          <div style={{ backgroundColor: "var(--ds-surface-elevated)", borderRadius: "var(--ds-radius-medium)", padding: "var(--ds-spacing-xl)", boxShadow: "var(--ds-shadow-md)", border: "1px solid var(--ds-border-subtle)", position: "sticky", top: "var(--ds-spacing-lg)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ds-text-primary)", marginTop: 0, marginBottom: "var(--ds-spacing-lg)", paddingBottom: "var(--ds-spacing-md)", borderBottom: "1px solid var(--ds-border-default)" }}>
              Order Summary
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-spacing-md)", marginBottom: "var(--ds-spacing-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ds-text-secondary)", fontSize: "0.95rem" }}>
                <span>Subtotal (4 items)</span>
                <span>$456.99</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ds-text-secondary)", fontSize: "0.95rem" }}>
                <span>Shipping</span>
                <span style={{ color: "var(--ds-status-success)", fontWeight: 600 }}>Free</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ds-text-secondary)", fontSize: "0.95rem" }}>
                <span>Estimated Tax</span>
                <span>$36.56</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "var(--ds-spacing-md)", borderTop: "2px solid var(--ds-border-default)", marginBottom: "var(--ds-spacing-lg)" }}>
              <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--ds-text-primary)" }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--ds-text-primary)" }}>$493.55</span>
            </div>

            {/* Proceed to Checkout */}
            <button style={{ width: "100%", padding: "var(--ds-spacing-md)", backgroundColor: "var(--ds-brand-primary)", color: "var(--ds-surface-elevated)", border: "none", borderRadius: "var(--ds-radius-medium)", fontSize: "1rem", fontWeight: 700, cursor: "pointer", boxShadow: "var(--ds-shadow-md)", letterSpacing: "0.02em", marginBottom: "var(--ds-spacing-md)" }}>
              Proceed to Checkout
            </button>

            {/* Continue shopping */}
            <p style={{ textAlign: "center", margin: 0 }}>
              <span style={{ color: "var(--ds-text-link)", cursor: "pointer", fontSize: "0.9rem", textDecoration: "underline" }}>
                Continue Shopping
              </span>
            </p>

            {/* Trust badges */}
            <div style={{ marginTop: "var(--ds-spacing-lg)", paddingTop: "var(--ds-spacing-md)", borderTop: "1px solid var(--ds-border-subtle)", display: "flex", flexDirection: "column", gap: "var(--ds-spacing-xs)" }}>
              {["Secure checkout with SSL encryption", "Free returns within 30 days", "Free shipping on orders over $100"].map((badge, i) => (
                <p key={i} style={{ display: "flex", alignItems: "center", gap: "var(--ds-spacing-xs)", color: "var(--ds-text-muted)", fontSize: "0.8rem", margin: 0 }}>
                  <span style={{ color: "var(--ds-status-success)" }}>✓</span> {badge}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ backgroundColor: "var(--ds-surface-elevated)", borderTop: "1px solid var(--ds-border-default)", padding: "var(--ds-spacing-xl)", textAlign: "center", color: "var(--ds-text-muted)", fontSize: "0.85rem", marginTop: "var(--ds-spacing-2xl)" }}>
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
