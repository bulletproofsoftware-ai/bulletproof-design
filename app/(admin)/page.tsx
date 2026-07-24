import Link from "next/link";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import {
  LayoutTemplate,
  FolderOpen,
  Palette,
  Image,
  Plus,
  Upload,
  Import,
} from "lucide-react";

// Server Component — runs inside the container. Use the container-internal
// API origin (loopback to the Express process on port 8096), NOT the
// host-mapped `NEXT_PUBLIC_API_URL` which only exists on the host network.
// Use `127.0.0.1` explicitly because Node's fetch resolves `localhost` to
// IPv6 `::1` first, but Express binds only to IPv4 `0.0.0.0` — `localhost`
// from inside the container would yield ECONNREFUSED.
const API = process.env.INTERNAL_API_URL || "http://127.0.0.1:8096";

const FETCH_TIMEOUT_MS = 10_000;

async function fetchCategories() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API}/api/categories`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return data.categories as { name: string; count: number }[];
  } catch {
    return [];
  }
}

async function fetchBrands() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API}/api/brands`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return data.brands as any[];
  } catch {
    return [];
  }
}

async function fetchAssets() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API}/api/assets`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { count: 0 };
    const data = await res.json();
    return { count: data.assets?.length || 0 };
  } catch {
    return { count: 0 };
  }
}

export default async function DashboardPage() {
  const [categories, brands, assets] = await Promise.all([
    fetchCategories(),
    fetchBrands(),
    fetchAssets(),
  ]);

  const totalTemplates = categories.reduce((sum, c) => sum + c.count, 0);

  const stats = [
    { label: "Total Templates", value: totalTemplates, icon: LayoutTemplate, color: "text-blue-500", bg: "bg-blue-50", border: "card-blue" },
    { label: "Categories", value: categories.length, icon: FolderOpen, color: "text-purple-500", bg: "bg-purple-50", border: "card-purple" },
    { label: "Brands", value: brands.length, icon: Palette, color: "text-teal-500", bg: "bg-teal-50", border: "card-teal" },
    { label: "Assets", value: assets.count, icon: Image, color: "text-amber-500", bg: "bg-amber-50", border: "card-amber" },
  ];

  const quickActions = [
    { label: "New Template", href: "/templates/new", icon: Plus, color: "text-blue-500", bg: "bg-blue-50", border: "card-blue" },
    { label: "New Brand", href: "/brands", icon: Palette, color: "text-purple-500", bg: "bg-purple-50", border: "card-purple" },
    { label: "Import URL", href: "/import", icon: Import, color: "text-teal-500", bg: "bg-teal-50", border: "card-teal" },
    { label: "Upload Asset", href: "/assets", icon: Upload, color: "text-amber-500", bg: "bg-amber-50", border: "card-amber" },
  ];

  return (
    <div className="p-8">
      <Breadcrumbs items={[{ label: "Dashboard" }]} />
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <div className={`action-card ${action.border}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${action.bg}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat-card ${stat.border}`}>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <div className="mt-2 flex items-center gap-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent PRDs style - Category list */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Categories</h2>
        <div className="stat-card !p-0 overflow-hidden">
          {categories.map((cat, i) => (
            <Link key={cat.name} href={`/templates?category=${encodeURIComponent(cat.name)}`}>
              <div className={`flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors ${i < categories.length - 1 ? "border-b border-border" : ""}`}>
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize text-foreground">
                    {cat.name.replace(/-/g, " ")}
                  </span>
                </div>
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0">
                  {cat.count}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
