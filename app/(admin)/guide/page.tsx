import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Rocket, Layout, FolderPlus } from "lucide-react";

export default function GuidePage() {
  return (
    <div className="p-8 max-w-4xl">
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/" }, { label: "Quick Start" }]}
      />
      <h1 className="text-2xl font-bold text-foreground mb-2">Quick Start</h1>
      <p className="text-muted-foreground mb-8">
        Get up and running with the Design Library in under a minute.
      </p>

      {/* Step 1 */}
      <div className="stat-card card-blue mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500 font-bold text-sm">
            1
          </div>
          <h2 className="text-lg font-semibold text-foreground">Start the Container</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          The Design Library runs as a Docker container on port 8096. Start it with:
        </p>
        <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-sm font-mono overflow-x-auto">
{`cd ~/Documents/Code/design && docker compose up -d`}
        </pre>
        <p className="text-xs text-muted-foreground mt-3">
          Then open{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            http://localhost:8096
          </code>{" "}
          in your browser.
        </p>
      </div>

      {/* Step 2 */}
      <div className="stat-card card-purple mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-500 font-bold text-sm">
            2
          </div>
          <h2 className="text-lg font-semibold text-foreground">Browse the Library</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Use the sidebar to navigate the library:
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { icon: Layout, label: "Templates", desc: "Browse and preview UI component templates organized by category" },
            { icon: Rocket, label: "Brands", desc: "View and manage brand configurations with colors, fonts, and spacing" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <item.icon className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Click any template card to see a live preview, view the source code, or open it in the
          editor. Use the search bar in the sidebar to find templates by name or tag.
        </p>
      </div>

      {/* Step 3 */}
      <div className="stat-card card-teal mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-500 font-bold text-sm">
            3
          </div>
          <h2 className="text-lg font-semibold text-foreground">Use with Claude Code</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Tell Claude Code to use templates and brands from the Design Library API. Example prompts:
        </p>
        <div className="space-y-2">
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-sm font-mono overflow-x-auto">
{`"Build a landing page using the hero template from the design library at localhost:8096"`}
          </pre>
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-sm font-mono overflow-x-auto">
{`"Fetch the brand config for 'acme' from http://localhost:8096/api/brands/acme
and apply its colors to this component"`}
          </pre>
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-sm font-mono overflow-x-auto">
{`"Search the design library for 'pricing' templates and use one as a starting point"`}
          </pre>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Claude Code can fetch templates, apply brand tokens, and generate components that match
          your design system automatically.
        </p>
      </div>

      {/* Adding content */}
      <div className="stat-card card-amber">
        <div className="flex items-center gap-3 mb-4">
          <FolderPlus className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">Adding Content</h2>
        </div>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Add a Template</p>
            <p>
              Drop a <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">.tsx</code>{" "}
              file into{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                data/templates/&lt;category&gt;/
              </code>{" "}
              or use the Template Editor in the sidebar. You can also POST to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                /api/templates
              </code>.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Add a Brand</p>
            <p>
              Drop a JSON file into{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                data/brands/
              </code>{" "}
              or use the Brands page to create one visually with the color picker and font selector.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Import from URL</p>
            <p>
              Use the Import tool to fetch a component from any URL (GitHub raw files, CodePen, etc.)
              and save it as a template. Go to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                Tools &gt; Import from URL
              </code>{" "}
              in the sidebar or POST to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/api/import</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
