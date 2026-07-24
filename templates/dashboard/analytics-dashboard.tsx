/**
 * @meta
 * category: dashboard
 * name: analytics-dashboard
 * description: Analytics dashboard with chart widgets and metrics
 * tags: [dashboard, analytics, charts, stats]
 * source: seed
 */
export default function AnalyticsDashboard() {
  const navItems = [
    { label: "Overview", active: true },
    { label: "Analytics" },
    { label: "Revenue" },
    { label: "Users" },
    { label: "Reports" },
    { label: "Settings" },
  ];

  const stats = [
    { label: "Total Revenue", value: "$48,350", change: "+12.4%", up: true },
    { label: "Active Users", value: "12,482", change: "+8.1%", up: true },
    { label: "Conversion Rate", value: "3.6%", change: "-0.3%", up: false },
    { label: "Avg Session", value: "4m 32s", change: "+0:18", up: true },
  ];

  const activity = [
    { time: "2026-04-06 14:32", user: "Sarah Chen", action: "Upgraded to Pro plan", status: "success" },
    { time: "2026-04-06 13:55", user: "James Okafor", action: "Password reset requested", status: "warning" },
    { time: "2026-04-06 13:21", user: "Maria Gonzalez", action: "New account created", status: "success" },
    { time: "2026-04-06 12:47", user: "Priya Nair", action: "Invoice payment failed", status: "error" },
    { time: "2026-04-06 11:09", user: "Tom Bergmann", action: "Exported user report", status: "success" },
  ];

  const statusColor = (s: string) =>
    s === "success"
      ? "var(--ds-status-success)"
      : s === "warning"
      ? "var(--ds-status-warning)"
      : "var(--ds-status-error)";

  const statusLabel = (s: string) =>
    s === "success" ? "Completed" : s === "warning" ? "Pending" : "Failed";

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
            Pulse
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
              background: "var(--ds-brand-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ds-surface-elevated)",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Overview</h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ds-text-muted)" }}>
              Sunday, April 6, 2026
            </p>
          </div>

          {/* Date filter */}
          <div style={{ display: "flex", gap: "var(--ds-spacing-xs, 4px)" }}>
            {["7D", "30D", "90D", "YTD"].map((range, i) => (
              <button
                key={range}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: i === 1 ? 600 : 400,
                  border: "1px solid var(--ds-border-default)",
                  borderRadius: "var(--ds-radius-soft, 4px)",
                  background: i === 1 ? "var(--ds-brand-primary)" : "var(--ds-surface-elevated)",
                  color: i === 1 ? "#fff" : "var(--ds-text-secondary)",
                  cursor: "pointer",
                }}
              >
                {range}
              </button>
            ))}
          </div>
        </header>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-spacing-xl, 32px)" }}>
          {/* Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "var(--ds-spacing-md, 16px)",
              marginBottom: "var(--ds-spacing-xl, 32px)",
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--ds-surface-elevated)",
                  border: "1px solid var(--ds-border-default)",
                  borderRadius: "var(--ds-radius-medium, 8px)",
                  padding: "var(--ds-spacing-lg, 24px)",
                  boxShadow: "var(--ds-shadow-sm)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 12,
                    color: "var(--ds-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </p>
                <p style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700 }}>{s.value}</p>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: s.up ? "var(--ds-status-success)" : "var(--ds-status-error)",
                  }}
                >
                  {s.change} vs last period
                </span>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--ds-spacing-md, 16px)",
              marginBottom: "var(--ds-spacing-xl, 32px)",
            }}
          >
            {["Revenue Over Time", "User Growth"].map((title) => (
              <div
                key={title}
                style={{
                  background: "var(--ds-surface-elevated)",
                  border: "1px solid var(--ds-border-default)",
                  borderRadius: "var(--ds-radius-medium, 8px)",
                  padding: "var(--ds-spacing-lg, 24px)",
                  boxShadow: "var(--ds-shadow-sm)",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 var(--ds-spacing-md, 16px)",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {title}
                </h3>
                <div
                  style={{
                    height: 180,
                    background: "var(--ds-surface-sunken)",
                    borderRadius: "var(--ds-radius-soft, 4px)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "var(--ds-spacing-sm, 8px)",
                    gap: 6,
                  }}
                >
                  {[55, 72, 63, 88, 74, 91, 68, 95, 82, 78, 99, 85].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${h}%`,
                        background:
                          i === 11
                            ? "var(--ds-brand-primary)"
                            : "color-mix(in srgb, var(--ds-brand-primary) 40%, transparent)",
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                    fontSize: 11,
                    color: "var(--ds-text-muted)",
                  }}
                >
                  <span>May</span>
                  <span>Aug</span>
                  <span>Dec</span>
                  <span>Apr</span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity Table */}
          <div
            style={{
              background: "var(--ds-surface-elevated)",
              border: "1px solid var(--ds-border-default)",
              borderRadius: "var(--ds-radius-medium, 8px)",
              boxShadow: "var(--ds-shadow-sm)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "var(--ds-spacing-md, 16px) var(--ds-spacing-lg, 24px)",
                borderBottom: "1px solid var(--ds-border-default)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Recent Activity</h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ds-surface-sunken)" }}>
                  {["Timestamp", "User", "Action", "Status"].map((h) => (
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
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom:
                        i < activity.length - 1
                          ? "1px solid var(--ds-border-subtle)"
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px var(--ds-spacing-lg, 24px)",
                        fontSize: 13,
                        color: "var(--ds-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.time}
                    </td>
                    <td
                      style={{
                        padding: "12px var(--ds-spacing-lg, 24px)",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {row.user}
                    </td>
                    <td
                      style={{
                        padding: "12px var(--ds-spacing-lg, 24px)",
                        fontSize: 13,
                        color: "var(--ds-text-secondary)",
                      }}
                    >
                      {row.action}
                    </td>
                    <td style={{ padding: "12px var(--ds-spacing-lg, 24px)" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `color-mix(in srgb, ${statusColor(row.status)} 15%, transparent)`,
                          color: statusColor(row.status),
                        }}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
