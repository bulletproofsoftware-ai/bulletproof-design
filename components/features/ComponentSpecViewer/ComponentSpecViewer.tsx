"use client";

/**
 * Component spec viewer (SPEC-008 REQ-022).
 *
 * Renders the full spec detail for a single component, composed from the
 * pieces returned by `GET /api/components/:name`:
 *
 *   1. Header — name, tier badge, description, source path
 *   2. Usage guidelines (when / avoid / notes) — hidden if all empty
 *   3. Props table
 *   4. Variants gallery (iframes — see `VariantsGallery`)
 *   5. Interactive playground (client-side only — see `Playground`)
 *   6. Code examples (copy-to-clipboard)
 *   7. Accessibility notes
 *   8. Dependencies
 *
 * The Playground is loaded lazily (dynamic import with `ssr:false`) so
 * `@babel/standalone` and Monaco aren't shipped with the index page bundle
 * or with any other admin page.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { ComponentSpec } from "@/lib/api";

import { VariantsGallery } from "./VariantsGallery";

const Playground = dynamic(
  () => import("./Playground").then((m) => m.Playground),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] animate-pulse rounded-lg border border-dashed border-border bg-muted/40" />
    ),
  },
);

function tierBadgeClass(tier: ComponentSpec["tier"]): string {
  switch (tier) {
    case "ui":
      return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    case "primitives":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
    case "features":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "effects":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200";
  }
}

function hasGuidelines(g: ComponentSpec["guidelines"]): boolean {
  if (!g) return false;
  return Boolean(
    (g.when && g.when.trim()) ||
      (g.whenNot && g.whenNot.trim()) ||
      (g.notes && g.notes.trim()),
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — silent no-op */
        }
      }}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function ComponentSpecViewer({ spec }: { spec: ComponentSpec }) {
  const showGuidelines = hasGuidelines(spec.guidelines);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-2">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Components", href: "/components" },
            { label: spec.name },
          ]}
        />
      </div>

      {/* Header */}
      <header className="mb-8 border-b border-border pb-6">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">{spec.name}</h1>
          <Badge
            variant="secondary"
            className={`border-0 ${tierBadgeClass(spec.tier)}`}
          >
            {spec.tier}
          </Badge>
          {spec.client && (
            <Badge variant="outline" className="text-xs">
              client
            </Badge>
          )}
          {spec.incomplete && (
            <Badge
              variant="outline"
              className="text-xs text-amber-700 border-amber-300 dark:text-amber-300"
            >
              incomplete spec
            </Badge>
          )}
        </div>
        {spec.description && (
          <p className="mb-3 text-muted-foreground">{spec.description}</p>
        )}
        <code className="text-xs text-muted-foreground">{spec.path}</code>
        <div className="mt-4">
          <Link
            href="/components"
            className="text-sm text-primary hover:underline"
          >
            ← All components
          </Link>
        </div>
      </header>

      <div className="space-y-10">
        {/* Usage guidelines */}
        {showGuidelines && (
          <Section id="guidelines" title="Usage guidelines">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {spec.guidelines?.when && (
                <div className="rounded-lg border border-emerald-300/40 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
                  <h3 className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    Use when
                  </h3>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {spec.guidelines.when}
                  </p>
                </div>
              )}
              {spec.guidelines?.whenNot && (
                <div className="rounded-lg border border-rose-300/40 bg-rose-50/50 p-4 dark:bg-rose-950/20">
                  <h3 className="mb-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
                    Avoid when
                  </h3>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {spec.guidelines.whenNot}
                  </p>
                </div>
              )}
              {spec.guidelines?.notes && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Notes
                  </h3>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {spec.guidelines.notes}
                  </p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Props table */}
        <Section id="props" title="Props">
          {spec.props && spec.props.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Name</th>
                    <th scope="col" className="px-3 py-2 font-medium">Type</th>
                    <th scope="col" className="px-3 py-2 font-medium">Default</th>
                    <th scope="col" className="px-3 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {spec.props.map((p) => (
                    <tr
                      key={p.name}
                      className="border-t border-border align-top"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {p.name}
                        {p.optional && (
                          <span className="ml-1 text-muted-foreground">?</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {p.type}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {p.default !== undefined ? String(p.default) : "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground/80">
                        {p.description || (
                          <span className="italic text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No props documented.</p>
          )}
        </Section>

        {/* Variants gallery */}
        <Section id="variants" title="Variants">
          <VariantsGallery
            componentName={spec.name}
            variants={spec.variants}
          />
        </Section>

        {/* Interactive playground — CLIENT-SIDE ONLY */}
        <Section id="playground" title="Interactive playground">
          <Playground componentName={spec.name} />
        </Section>

        {/* Code examples */}
        {spec.examples && spec.examples.length > 0 && (
          <Section id="examples" title="Code examples">
            <div className="space-y-4">
              {spec.examples.map((ex, i) => (
                <div
                  key={`${ex.label}-${i}`}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {ex.label}
                      </p>
                      {ex.description && (
                        <p className="text-xs text-muted-foreground">
                          {ex.description}
                        </p>
                      )}
                    </div>
                    <CopyButton text={ex.code} />
                  </div>
                  <pre className="overflow-x-auto bg-muted/20 px-3 py-3 text-xs">
                    <code className="font-mono text-foreground/90">{ex.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Accessibility notes */}
        {spec.accessibility &&
          (spec.accessibility.role ||
            (spec.accessibility.keyboard &&
              spec.accessibility.keyboard.length > 0) ||
            spec.accessibility.notes) && (
            <Section id="accessibility" title="Accessibility">
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                {spec.accessibility.role && (
                  <p className="text-sm">
                    <span className="font-medium">ARIA role:</span>{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {spec.accessibility.role}
                    </code>
                  </p>
                )}
                {spec.accessibility.keyboard &&
                  spec.accessibility.keyboard.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Keyboard:</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-foreground/80">
                        {spec.accessibility.keyboard.map((k) => (
                          <li key={k}>
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                              {k}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {spec.accessibility.notes && (
                  <p className="whitespace-pre-wrap text-sm text-foreground/80">
                    {spec.accessibility.notes}
                  </p>
                )}
              </div>
            </Section>
          )}

        {/* Dependencies */}
        {spec.dependencies && spec.dependencies.length > 0 && (
          <Section id="dependencies" title="Dependencies">
            <div className="flex flex-wrap gap-2">
              {spec.dependencies.map((dep) => (
                <Badge key={dep} variant="outline" className="font-mono text-xs">
                  {dep}
                </Badge>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
