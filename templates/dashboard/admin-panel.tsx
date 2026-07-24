/**
 * @meta
 * category: dashboard
 * name: admin-panel
 * description: Admin panel with user management table, search, and pagination
 * tags: [dashboard, admin, users, table, management]
 * source: seed
 */
export default function AdminPanel() {
  const navItems = [
    { label: "Dashboard" },
    { label: "Users", active: true },
    { label: "Roles" },
    { label: "Audit Log" },
    { label: "Integrations" },
    { label: "Settings" },
  ];

  const users = [
    { name: "Sarah Chen", email: "sarah.chen@acme.com", role: "Admin", status: "Active", joined: "Jan 12, 2025" },
    { name: "James Okafor", email: "j.okafor@acme.com", role: "Editor", status: "Active", joined: "Mar 3, 2025" },
    { name: "Maria Gonzalez", email: "m.gonzalez@acme.com", role: "Viewer", status: "Inactive", joined: "Feb 18, 2025" },
    { name: "Priya Nair", email: "p.nair@acme.com", role: "Editor", status: "Active", joined: "Dec 7, 2024" },
    { name: "Tom Bergmann", email: "t.bergmann@acme.com", role: "Viewer", status: "Active", joined: "Apr 1, 2026" },
    { name: "Aisha Yusuf", email: "a.yusuf@acme.com", role: "Admin", status: "Suspended", joined: "Nov 21, 2024" },
    { name: "Lucas Petit", email: "l.petit@acme.com", role: "Editor", status: "Active", joined: "Jan 30, 2026" },
    { name: "Chidi Obi", email: "c.obi@acme.com", role: "Viewer", status: "Inactive", joined: "Oct 14, 2024" },
  ];

  const statusStyle = (status: string) => {
    if (status === "Active")
      return {
        bg: "color-mix(in srgb, var(--ds-status-success) 15%, transparent)",
        color: "var(--ds-status-success)",
      };
    if (status === "Inactive")
      return {
        bg: "color-mix(in srgb, var(--ds-status-warning) 15%, transparent)",
        color: "var(--ds-status-warning)",
      };
    return {
      bg: "color-mix(in srgb, var(--ds-status-error) 15%, transparent)",
      color: "var(--ds-status-error)",
    };
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("");

  const avatarColors = [
    "var(--ds-brand-primary)",
    "var(--ds-brand-secondary)",
    "var(--ds-brand-accent)",
    "var(--ds-status-info)",
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
            AdminHub
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
            <div style={{ fontSize: 11, color: "var(--ds-text-muted)" }}>Super Admin</div>
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>User Management</h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ds-text-muted)" }}>
              Manage accounts, roles, and permissions
            </p>
          </div>
          <button
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              background: "var(--ds-brand-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--ds-radius-soft, 4px)",
              cursor: "pointer",
              boxShadow: "var(--ds-shadow-sm)",
            }}
          >
            + Add User
          </button>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-spacing-xl, 32px)" }}>
          {/* Search + Filter bar */}
          <div
            style={{
              display: "flex",
              gap: "var(--ds-spacing-sm, 8px)",
              marginBottom: "var(--ds-spacing-lg, 24px)",
              alignItems: "center",
            }}
          >
            <div
              style={{
                flex: 1,
                position: "relative",
                maxWidth: 360,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ds-text-muted)",
                  fontSize: 14,
                  pointerEvents: "none",
                }}
              >
                ⌕
              </span>
              <input
                type="text"
                placeholder="Search users…"
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  fontSize: 13,
                  border: "1px solid var(--ds-border-default)",
                  borderRadius: "var(--ds-radius-soft, 4px)",
                  background: "var(--ds-surface-elevated)",
                  color: "var(--ds-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <select
              style={{
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft, 4px)",
                background: "var(--ds-surface-elevated)",
                color: "var(--ds-text-primary)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option>All Roles</option>
              <option>Admin</option>
              <option>Editor</option>
              <option>Viewer</option>
            </select>

            <select
              style={{
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--ds-border-default)",
                borderRadius: "var(--ds-radius-soft, 4px)",
                background: "var(--ds-surface-elevated)",
                color: "var(--ds-text-primary)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Suspended</option>
            </select>
          </div>

          {/* Table */}
          <div
            style={{
              background: "var(--ds-surface-elevated)",
              border: "1px solid var(--ds-border-default)",
              borderRadius: "var(--ds-radius-medium, 8px)",
              boxShadow: "var(--ds-shadow-sm)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ds-surface-sunken)" }}>
                  {["Name", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px var(--ds-spacing-lg, 24px)",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--ds-text-muted)",
                        borderBottom: "1px solid var(--ds-border-default)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => {
                  const ss = statusStyle(user.status);
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom:
                          i < users.length - 1
                            ? "1px solid var(--ds-border-subtle)"
                            : "none",
                      }}
                    >
                      <td style={{ padding: "12px var(--ds-spacing-lg, 24px)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: avatarColors[i % avatarColors.length],
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#fff",
                              flexShrink: 0,
                            }}
                          >
                            {initials(user.name)}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "12px var(--ds-spacing-lg, 24px)",
                          fontSize: 13,
                          color: "var(--ds-text-secondary)",
                        }}
                      >
                        {user.email}
                      </td>
                      <td style={{ padding: "12px var(--ds-spacing-lg, 24px)" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "var(--ds-radius-soft, 4px)",
                            fontSize: 12,
                            fontWeight: 600,
                            background: "var(--ds-surface-sunken)",
                            color: "var(--ds-text-secondary)",
                          }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: "12px var(--ds-spacing-lg, 24px)" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: ss.bg,
                            color: ss.color,
                          }}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px var(--ds-spacing-lg, 24px)",
                          fontSize: 13,
                          color: "var(--ds-text-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.joined}
                      </td>
                      <td style={{ padding: "12px var(--ds-spacing-lg, 24px)" }}>
                        <div style={{ display: "flex", gap: "var(--ds-spacing-xs, 4px)" }}>
                          <button
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              border: "1px solid var(--ds-border-default)",
                              borderRadius: "var(--ds-radius-soft, 4px)",
                              background: "var(--ds-surface-elevated)",
                              color: "var(--ds-text-secondary)",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              border: "1px solid color-mix(in srgb, var(--ds-status-error) 40%, transparent)",
                              borderRadius: "var(--ds-radius-soft, 4px)",
                              background: "transparent",
                              color: "var(--ds-status-error)",
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div
              style={{
                padding: "12px var(--ds-spacing-lg, 24px)",
                borderTop: "1px solid var(--ds-border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--ds-surface-sunken)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--ds-text-muted)" }}>
                Showing <strong style={{ color: "var(--ds-text-primary)" }}>1–8</strong> of{" "}
                <strong style={{ color: "var(--ds-text-primary)" }}>124</strong> users
              </span>
              <div style={{ display: "flex", gap: "var(--ds-spacing-xs, 4px)" }}>
                <button
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    border: "1px solid var(--ds-border-default)",
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    background: "var(--ds-surface-elevated)",
                    color: "var(--ds-text-muted)",
                    cursor: "pointer",
                  }}
                >
                  ← Prev
                </button>
                {[1, 2, 3].map((p) => (
                  <button
                    key={p}
                    style={{
                      padding: "5px 10px",
                      fontSize: 12,
                      border: "1px solid var(--ds-border-default)",
                      borderRadius: "var(--ds-radius-soft, 4px)",
                      background:
                        p === 1 ? "var(--ds-brand-primary)" : "var(--ds-surface-elevated)",
                      color: p === 1 ? "#fff" : "var(--ds-text-secondary)",
                      cursor: "pointer",
                      fontWeight: p === 1 ? 600 : 400,
                    }}
                  >
                    {p}
                  </button>
                ))}
                <span
                  style={{
                    padding: "5px 6px",
                    fontSize: 12,
                    color: "var(--ds-text-muted)",
                  }}
                >
                  …
                </span>
                <button
                  style={{
                    padding: "5px 10px",
                    fontSize: 12,
                    border: "1px solid var(--ds-border-default)",
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    background: "var(--ds-surface-elevated)",
                    color: "var(--ds-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  16
                </button>
                <button
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    border: "1px solid var(--ds-border-default)",
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    background: "var(--ds-surface-elevated)",
                    color: "var(--ds-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
