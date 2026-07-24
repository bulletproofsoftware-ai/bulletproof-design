import { Breadcrumbs } from "@/components/features/Breadcrumbs";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-200",
  POST: "bg-blue-100 text-blue-700 border-blue-200",
  PUT: "bg-amber-100 text-amber-700 border-amber-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
};

function EndpointRow({ method, path, description }: Endpoint) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
      <span
        className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[11px] font-bold tracking-wide border ${METHOD_COLORS[method]}`}
        style={{ minWidth: 56, textAlign: "center" }}
      >
        {method}
      </span>
      <code className="text-sm font-mono text-foreground">{path}</code>
      <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">
        {description}
      </span>
    </div>
  );
}

function EndpointSection({
  title,
  endpoints,
  colorClass,
}: {
  title: string;
  endpoints: Endpoint[];
  colorClass: string;
}) {
  return (
    <div className={`stat-card ${colorClass} !p-0 overflow-hidden mb-6`}>
      <div className="px-5 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {endpoints.map((ep, i) => (
        <EndpointRow key={`${ep.method}-${ep.path}-${i}`} {...ep} />
      ))}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "API Reference" },
        ]}
      />
      <h1 className="text-2xl font-bold text-foreground mb-2">API Reference</h1>
      <p className="text-muted-foreground mb-2">
        Full REST API for the Design Library.
      </p>
      <div className="flex items-center gap-2 mb-8">
        <span className="text-sm text-muted-foreground">Base URL:</span>
        <code className="rounded bg-muted px-2 py-1 text-sm font-mono text-foreground">
          http://localhost:8096
        </code>
      </div>

      <EndpointSection
        title="Templates"
        colorClass="card-blue"
        endpoints={[
          { method: "GET", path: "/api/categories", description: "List all template categories with counts" },
          { method: "GET", path: "/api/templates/:category", description: "List templates in a category" },
          { method: "GET", path: "/api/templates/:category/:name", description: "Get a single template with source code" },
          { method: "POST", path: "/api/templates", description: "Create a new template" },
          { method: "PUT", path: "/api/templates/:category/:name", description: "Update a template's source code" },
          { method: "DELETE", path: "/api/templates/:category/:name", description: "Delete a template" },
          { method: "GET", path: "/api/search?q=", description: "Search templates by name, tags, or description" },
        ]}
      />

      <EndpointSection
        title="Brands"
        colorClass="card-purple"
        endpoints={[
          { method: "GET", path: "/api/brands", description: "List all brands" },
          { method: "GET", path: "/api/brands/:slug", description: "Get full brand configuration" },
          { method: "GET", path: "/api/brands/:slug/colors", description: "Get brand color palette" },
          { method: "GET", path: "/api/brands/:slug/fonts", description: "Get brand font stack" },
          { method: "GET", path: "/api/brands/:slug/css-variables", description: "Get brand as CSS custom properties" },
          { method: "GET", path: "/api/brands/:slug/assets", description: "Get brand logo and asset URLs" },
          { method: "POST", path: "/api/brands", description: "Create a new brand" },
          { method: "PUT", path: "/api/brands/:slug", description: "Update a brand configuration" },
          { method: "DELETE", path: "/api/brands/:slug", description: "Delete a brand" },
        ]}
      />

      <EndpointSection
        title="Assets"
        colorClass="card-teal"
        endpoints={[
          { method: "GET", path: "/api/assets", description: "List all assets (optional ?folder= filter)" },
          { method: "GET", path: "/api/assets/folders", description: "List asset folder names" },
          { method: "POST", path: "/api/assets", description: "Upload an asset (base64 body)" },
          { method: "DELETE", path: "/api/assets/*", description: "Delete an asset by path" },
        ]}
      />

      <EndpointSection
        title="Import"
        colorClass="card-amber"
        endpoints={[
          { method: "POST", path: "/api/import", description: "Import a component from an external URL" },
        ]}
      />

      <EndpointSection
        title="Preview"
        colorClass="card-emerald"
        endpoints={[
          { method: "GET", path: "/preview/:category/:name", description: "Render a template in an isolated preview page" },
        ]}
      />

      <EndpointSection
        title="Health"
        colorClass="card-rose"
        endpoints={[
          { method: "GET", path: "/api/health", description: "Health check — returns server status" },
        ]}
      />
    </div>
  );
}
