/**
 * @meta
 * category: dashboard
 * name: settings-page
 * description: Settings page with tabbed sections and profile form
 * tags: [dashboard, settings, form, profile, tabs]
 * source: seed
 */
export default function SettingsPage() {
  const navItems = [
    { label: "Dashboard" },
    { label: "Analytics" },
    { label: "Team" },
    { label: "Billing" },
    { label: "Settings", active: true },
  ];

  const tabs = [
    { label: "Profile", active: true },
    { label: "Notifications" },
    { label: "Security" },
    { label: "Billing" },
  ];

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "var(--ds-font-body, 'Inter', sans-serif)",
        background: "var(--ds-surface-background)",
        color: "var(--ds-text-primary)",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: "var(--ds-surface-elevated)",
          borderRight: "1px solid var(--ds-border-default)",
          display: "flex",
          flexDirection: "column",
          padding: "var(--ds-spacing-lg, 24px) 0",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "0 var(--ds-spacing-lg, 24px)",
            marginBottom: "var(--ds-spacing-xl, 32px)",
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--ds-brand-primary)",
              letterSpacing: "-0.5px",
            }}
          >
            Workspace
          </span>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ds-spacing-sm, 8px)",
                padding: "10px var(--ds-spacing-lg, 24px)",
                cursor: "pointer",
                background: item.active
                  ? "color-mix(in srgb, var(--ds-brand-primary) 10%, transparent)"
                  : "transparent",
                borderLeft: item.active
                  ? "3px solid var(--ds-brand-primary)"
                  : "3px solid transparent",
                color: item.active
                  ? "var(--ds-brand-primary)"
                  : "var(--ds-text-secondary)",
                fontWeight: item.active ? 600 : 400,
                fontSize: 14,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  background: item.active
                    ? "var(--ds-brand-primary)"
                    : "var(--ds-border-default)",
                  borderRadius: "var(--ds-radius-soft, 4px)",
                  flexShrink: 0,
                }}
              />
              {item.label}
            </div>
          ))}
        </nav>

        <div
          style={{
            padding: "var(--ds-spacing-md, 16px) var(--ds-spacing-lg, 24px)",
            borderTop: "1px solid var(--ds-border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-spacing-sm, 8px)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--ds-brand-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            MV
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Alex Morgan</div>
            <div style={{ fontSize: 11, color: "var(--ds-text-muted)" }}>Admin</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header
          style={{
            padding: "var(--ds-spacing-md, 16px) var(--ds-spacing-xl, 32px)",
            borderBottom: "1px solid var(--ds-border-default)",
            background: "var(--ds-surface-elevated)",
            flexShrink: 0,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Settings</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ds-text-muted)" }}>
            Manage your account and workspace preferences
          </p>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-spacing-xl, 32px)" }}>
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid var(--ds-border-default)",
              marginBottom: "var(--ds-spacing-xl, 32px)",
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.label}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: tab.active ? 600 : 400,
                  border: "none",
                  borderBottom: tab.active
                    ? "2px solid var(--ds-brand-primary)"
                    : "2px solid transparent",
                  background: "transparent",
                  color: tab.active ? "var(--ds-brand-primary)" : "var(--ds-text-secondary)",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile tab content */}
          <div style={{ maxWidth: 640 }}>
            <div
              style={{
                background: "var(--ds-surface-elevated)",
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-medium, 8px)",
                boxShadow: "var(--ds-shadow-sm)",
                padding: "var(--ds-spacing-xl, 32px)",
                marginBottom: "var(--ds-spacing-lg, 24px)",
              }}
            >
              <h2
                style={{
                  margin: "0 0 var(--ds-spacing-lg, 24px)",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Profile Information
              </h2>

              {/* Avatar row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-spacing-lg, 24px)",
                  marginBottom: "var(--ds-spacing-xl, 32px)",
                  paddingBottom: "var(--ds-spacing-xl, 32px)",
                  borderBottom: "1px solid var(--ds-border-subtle)",
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "var(--ds-brand-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                    boxShadow: "var(--ds-shadow-md)",
                  }}
                >
                  MV
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Profile Photo
                  </p>
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: 12,
                      color: "var(--ds-text-muted)",
                    }}
                  >
                    JPG, PNG or GIF. Max size 2MB.
                  </p>
                  <div style={{ display: "flex", gap: "var(--ds-spacing-xs, 4px)" }}>
                    <button
                      style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: "var(--ds-brand-primary)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "var(--ds-radius-soft, 4px)",
                        cursor: "pointer",
                      }}
                    >
                      Upload Photo
                    </button>
                    <button
                      style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        border: "1px solid var(--ds-border-default)",
                        borderRadius: "var(--ds-radius-soft, 4px)",
                        background: "transparent",
                        color: "var(--ds-text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {/* Form fields */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--ds-spacing-lg, 24px)",
                  marginBottom: "var(--ds-spacing-lg, 24px)",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ds-text-secondary)",
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Alex"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      fontSize: 14,
                      border: "1px solid var(--ds-border-default)",
                      borderRadius: "var(--ds-radius-soft, 4px)",
                      background: "var(--ds-surface-background)",
                      color: "var(--ds-text-primary)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ds-text-secondary)",
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Vance"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      fontSize: 14,
                      border: "1px solid var(--ds-border-default)",
                      borderRadius: "var(--ds-radius-soft, 4px)",
                      background: "var(--ds-surface-background)",
                      color: "var(--ds-text-primary)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "var(--ds-spacing-lg, 24px)" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ds-text-secondary)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  defaultValue="alex@acme.com"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: 14,
                    border: "1px solid var(--ds-border-default)",
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    background: "var(--ds-surface-background)",
                    color: "var(--ds-text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 11,
                    color: "var(--ds-text-muted)",
                  }}
                >
                  Changing your email requires re-verification.
                </p>
              </div>

              <div style={{ marginBottom: "var(--ds-spacing-lg, 24px)" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ds-text-secondary)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Job Title
                </label>
                <input
                  type="text"
                  defaultValue="Senior Product Designer"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: 14,
                    border: "1px solid var(--ds-border-default)",
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    background: "var(--ds-surface-background)",
                    color: "var(--ds-text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ds-text-secondary)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Bio
                </label>
                <textarea
                  defaultValue="Building design systems and tools that help teams ship better products faster. Focused on accessibility and developer experience."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: 14,
                    border: "1px solid var(--ds-border-default)",
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    background: "var(--ds-surface-background)",
                    color: "var(--ds-text-primary)",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    lineHeight: 1.6,
                    fontFamily: "var(--ds-font-body, 'Inter', sans-serif)",
                  }}
                />
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 11,
                    color: "var(--ds-text-muted)",
                    textAlign: "right",
                  }}
                >
                  147 / 280 characters
                </p>
              </div>
            </div>

            {/* Inactive tab placeholders */}
            {["Notifications", "Security", "Billing"].map((section) => (
              <div
                key={section}
                style={{
                  background: "var(--ds-surface-elevated)",
                  border: "1px solid var(--ds-border-subtle)",
                  borderRadius: "var(--ds-radius-medium, 8px)",
                  padding: "var(--ds-spacing-lg, 24px)",
                  marginBottom: "var(--ds-spacing-sm, 8px)",
                  opacity: 0.45,
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ds-spacing-md, 16px)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    background: "var(--ds-surface-sunken)",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 4,
                      color: "var(--ds-text-secondary)",
                    }}
                  >
                    {section}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ds-text-muted)" }}>
                    {section === "Notifications"
                      ? "Email, push, and in-app notification preferences"
                      : section === "Security"
                      ? "Password, two-factor authentication, and sessions"
                      : "Subscription, payment methods, and invoices"}
                  </div>
                </div>
              </div>
            ))}

            {/* Save / Cancel */}
            <div
              style={{
                display: "flex",
                gap: "var(--ds-spacing-sm, 8px)",
                justifyContent: "flex-end",
                marginTop: "var(--ds-spacing-xl, 32px)",
                paddingTop: "var(--ds-spacing-lg, 24px)",
                borderTop: "1px solid var(--ds-border-subtle)",
              }}
            >
              <button
                style={{
                  padding: "9px 22px",
                  fontSize: 14,
                  border: "1px solid var(--ds-border-default)",
                  borderRadius: "var(--ds-radius-soft, 4px)",
                  background: "var(--ds-surface-elevated)",
                  color: "var(--ds-text-secondary)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: "9px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "var(--ds-radius-soft, 4px)",
                  background: "var(--ds-brand-primary)",
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "var(--ds-shadow-sm)",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
