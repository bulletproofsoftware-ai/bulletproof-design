/**
 * @meta
 * category: auth
 * name: signup-page
 * description: Signup/registration page with full name, email, password, and terms agreement
 * tags: [auth, signup, registration, form]
 * source: seed
 */
export default function SignupPage() {
  return (
    <div
      style={{
        fontFamily: "var(--ds-font-body, 'Inter', sans-serif)",
        minHeight: "100vh",
        backgroundColor: "var(--ds-surface-background)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--ds-spacing-lg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
        }}
      >
        {/* Card */}
        <div
          style={{
            backgroundColor: "var(--ds-surface-elevated)",
            borderRadius: "var(--ds-radius-medium)",
            boxShadow: "var(--ds-shadow-md)",
            border: "1px solid var(--ds-border-subtle)",
            padding: "var(--ds-spacing-2xl)",
          }}
        >
          {/* Logo placeholder */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "var(--ds-spacing-xl)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--ds-radius-soft)",
                backgroundColor: "var(--ds-brand-primary)",
                marginBottom: "var(--ds-spacing-sm)",
              }}
            />
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: "700",
                color: "var(--ds-text-primary)",
                margin: "0 0 var(--ds-spacing-xs) 0",
              }}
            >
              Create an account
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--ds-text-secondary)",
                margin: "0",
              }}
            >
              Get started — it's free
            </p>
          </div>

          {/* Full Name field */}
          <div style={{ marginBottom: "var(--ds-spacing-md)" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--ds-text-primary)",
                marginBottom: "var(--ds-spacing-xs)",
              }}
            >
              Full name
            </label>
            <input
              type="text"
              placeholder="Jane Smith"
              style={{
                width: "100%",
                padding: "var(--ds-spacing-sm) var(--ds-spacing-md)",
                fontSize: "0.875rem",
                color: "var(--ds-text-primary)",
                backgroundColor: "var(--ds-surface-background)",
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Email field */}
          <div style={{ marginBottom: "var(--ds-spacing-md)" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--ds-text-primary)",
                marginBottom: "var(--ds-spacing-xs)",
              }}
            >
              Email address
            </label>
            <input
              type="email"
              placeholder="jane@example.com"
              style={{
                width: "100%",
                padding: "var(--ds-spacing-sm) var(--ds-spacing-md)",
                fontSize: "0.875rem",
                color: "var(--ds-text-primary)",
                backgroundColor: "var(--ds-surface-background)",
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: "var(--ds-spacing-xs)" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--ds-text-primary)",
                marginBottom: "var(--ds-spacing-xs)",
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="Create a password"
              style={{
                width: "100%",
                padding: "var(--ds-spacing-sm) var(--ds-spacing-md)",
                fontSize: "0.875rem",
                color: "var(--ds-text-primary)",
                backgroundColor: "var(--ds-surface-background)",
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password strength hint */}
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--ds-text-muted)",
              margin: "0 0 var(--ds-spacing-md) 0",
            }}
          >
            Use 8+ characters with a mix of letters, numbers, and symbols.
          </p>

          {/* Confirm Password field */}
          <div style={{ marginBottom: "var(--ds-spacing-lg)" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--ds-text-primary)",
                marginBottom: "var(--ds-spacing-xs)",
              }}
            >
              Confirm password
            </label>
            <input
              type="password"
              placeholder="Re-enter your password"
              style={{
                width: "100%",
                padding: "var(--ds-spacing-sm) var(--ds-spacing-md)",
                fontSize: "0.875rem",
                color: "var(--ds-text-primary)",
                backgroundColor: "var(--ds-surface-background)",
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Terms checkbox */}
          <div style={{ marginBottom: "var(--ds-spacing-lg)" }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--ds-spacing-sm)",
                fontSize: "0.875rem",
                color: "var(--ds-text-secondary)",
                cursor: "pointer",
                lineHeight: "1.4",
              }}
            >
              <input
                type="checkbox"
                style={{
                  marginTop: "2px",
                  cursor: "pointer",
                  flexShrink: "0",
                }}
              />
              <span>
                I agree to the{" "}
                <a
                  href="#"
                  style={{
                    color: "var(--ds-text-link)",
                    textDecoration: "none",
                    fontWeight: "500",
                  }}
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  style={{
                    color: "var(--ds-text-link)",
                    textDecoration: "none",
                    fontWeight: "500",
                  }}
                >
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          {/* Create Account button */}
          <button
            style={{
              width: "100%",
              padding: "var(--ds-spacing-sm) var(--ds-spacing-md)",
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "var(--ds-surface-background)",
              backgroundColor: "var(--ds-brand-primary)",
              border: "none",
              borderRadius: "var(--ds-radius-soft)",
              cursor: "pointer",
              marginBottom: "var(--ds-spacing-lg)",
            }}
          >
            Create account
          </button>

          {/* Sign in link */}
          <p
            style={{
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--ds-text-secondary)",
              margin: "0",
            }}
          >
            Already have an account?{" "}
            <a
              href="#"
              style={{
                color: "var(--ds-text-link)",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
