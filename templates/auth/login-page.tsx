/**
 * @meta
 * category: auth
 * name: login-page
 * description: Login page with email/password form and social options
 * tags: [auth, login, form]
 * source: seed
 */
export default function LoginPage() {
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
              Welcome back
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--ds-text-secondary)",
                margin: "0",
              }}
            >
              Sign in to your account to continue
            </p>
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
              placeholder="you@example.com"
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
          <div style={{ marginBottom: "var(--ds-spacing-sm)" }}>
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
              placeholder="Enter your password"
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

          {/* Remember me + Forgot password */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--ds-spacing-lg)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-spacing-xs)",
                fontSize: "0.875rem",
                color: "var(--ds-text-secondary)",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" style={{ cursor: "pointer" }} />
              Remember me
            </label>
            <a
              href="#"
              style={{
                fontSize: "0.875rem",
                color: "var(--ds-text-link)",
                textDecoration: "none",
              }}
            >
              Forgot password?
            </a>
          </div>

          {/* Sign in button */}
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
            Sign in
          </button>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ds-spacing-md)",
              marginBottom: "var(--ds-spacing-lg)",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "var(--ds-border-subtle)",
              }}
            />
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--ds-text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              or continue with
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "var(--ds-border-subtle)",
              }}
            />
          </div>

          {/* Social buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--ds-spacing-sm)",
              marginBottom: "var(--ds-spacing-lg)",
            }}
          >
            {/* Google */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--ds-spacing-xs)",
                padding: "var(--ds-spacing-sm)",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--ds-text-primary)",
                backgroundColor: "var(--ds-surface-background)",
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft)",
                cursor: "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="var(--ds-brand-primary)" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="var(--ds-text-secondary)" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="var(--ds-text-muted)" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="var(--ds-status-error)" />
              </svg>
              Google
            </button>

            {/* GitHub */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--ds-spacing-xs)",
                padding: "var(--ds-spacing-sm)",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--ds-text-primary)",
                backgroundColor: "var(--ds-surface-background)",
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft)",
                cursor: "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--ds-text-primary)">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </button>
          </div>

          {/* Sign up link */}
          <p
            style={{
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--ds-text-secondary)",
              margin: "0",
            }}
          >
            Don't have an account?{" "}
            <a
              href="#"
              style={{
                color: "var(--ds-text-link)",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
