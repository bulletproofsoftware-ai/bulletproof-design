import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBrandForPortal,
  getBrandGuidelines,
  type GuidelinesSection,
} from "@/lib/api";
import { PortalBreadcrumbs } from "@/components/features/PortalBreadcrumbs";
import { SanitisedHtml } from "@/components/features/SanitisedHtml";

/**
 * Portal logo-usage page — REQ-013.
 *
 * Reads the parsed guidelines doc and locates the section whose slug
 * starts with "logo" (typically `logo-usage`). Renders:
 *   - The section body HTML. The HTML is pre-sanitised server-side by
 *     the guidelines parser (markdown-it with `html:false` then
 *     `sanitize-html` with a strict allowlist — see
 *     src/api/lib/guidelinesParser.ts, F-GUIDE-01). This is the single
 *     trusted rendering path for guidelines markup, so injecting
 *     `section.body` as HTML is safe.
 *   - A 2-column grid of green-bordered Do cards + red-bordered Don't
 *     cards from the section's `dos` / `donts` lists.
 *   - A "Clear space" callout if a subsection/note mentions clear space.
 *
 * Empty state when there is no logo section yet.
 */

interface PortalLogoUsageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PortalLogoUsageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) return { title: "Brand Portal — Not Found" };
  const title = `${brand.name} — Logo usage`;
  const description =
    brand.description ?? `Logo usage guidelines for ${brand.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function PortalLogoUsagePage({
  params,
}: PortalLogoUsageProps) {
  const { slug } = await params;
  const [brand, guidelines] = await Promise.all([
    getBrandForPortal(slug),
    getBrandGuidelines(slug),
  ]);
  if (!brand) notFound();

  const section = findLogoSection(guidelines?.sections ?? []);
  const clearSpace = extractClearSpaceCallout(section?.bodyMarkdown);

  return (
    <>
      <PortalBreadcrumbs
        items={[
          { label: "Brands" },
          { label: brand.name, href: `/portal/${slug}` },
          { label: "Visual Identity", href: `/portal/${slug}` },
          { label: "Logo Usage" },
        ]}
      />
      <h1 className="mb-3 text-[28px] font-normal text-foreground">
        Logo Usage
      </h1>
      <p className="mb-10 max-w-[640px] text-base leading-relaxed text-muted-foreground">
        {section
          ? `Follow these guidelines to ensure consistent and correct use of the ${brand.name} logo across all materials.`
          : `Logo usage guidelines for ${brand.name}.`}
      </p>

      {!section ? (
        <EmptyState message="Logo usage guidelines not yet published." />
      ) : (
        <>
          {section.body && (
            <SanitisedHtml
              html={section.body}
              className="prose prose-neutral mb-8 max-w-none text-sm text-foreground/80"
            />
          )}

          {(section.dos.length > 0 || section.donts.length > 0) && (
            <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
              {renderDosDontsPairs(section.dos, section.donts)}
            </div>
          )}

          {clearSpace && (
            <section className="mb-6">
              <h2 className="mb-2 text-xl font-normal text-foreground">
                Clear Space
              </h2>
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-6 text-sm text-foreground/80">
                {clearSpace}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

/**
 * Locate the logo-usage section. Prefers the canonical slug
 * `logo-usage`, then any slug starting with `logo`, then any section
 * whose title contains "logo" (case-insensitive).
 */
function findLogoSection(
  sections: GuidelinesSection[],
): GuidelinesSection | null {
  const exact = sections.find((s) => s.slug === "logo-usage");
  if (exact) return exact;
  const prefix = sections.find((s) => s.slug.startsWith("logo"));
  if (prefix) return prefix;
  const title = sections.find((s) => /logo/i.test(s.title));
  return title ?? null;
}

/**
 * Extract a short "clear space" callout if the section body mentions it.
 * We look for a sentence or paragraph containing "clear space" and return
 * it verbatim (first match). Returns null when nothing matches.
 */
function extractClearSpaceCallout(md?: string): string | null {
  if (!md) return null;
  const paragraphs = md.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (const p of paragraphs) {
    if (/clear\s+space/i.test(p)) {
      return p.replace(/^#+\s*/, "");
    }
  }
  return null;
}

/**
 * Render Do/Don't cards as 2-column pairs. When counts differ, the
 * shorter list is padded with empty cards so the grid stays aligned.
 */
function renderDosDontsPairs(dos: string[], donts: string[]) {
  const max = Math.max(dos.length, donts.length);
  const pairs: React.ReactNode[] = [];
  for (let i = 0; i < max; i++) {
    pairs.push(
      <DoCard key={`do-${i}`} text={dos[i] ?? null} />,
      <DontCard key={`dont-${i}`} text={donts[i] ?? null} />,
    );
  }
  return pairs;
}

function DoCard({ text }: { text: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 text-[13px] font-medium uppercase tracking-wider text-emerald-400">
        ✓ Do
      </div>
      <p className="text-sm text-foreground/80">
        {text ?? <span className="text-muted-foreground/60">&mdash;</span>}
      </p>
    </div>
  );
}

function DontCard({ text }: { text: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 text-[13px] font-medium uppercase tracking-wider text-rose-400">
        ✗ Don&apos;t
      </div>
      <p className="text-sm text-foreground/80">
        {text ?? <span className="text-muted-foreground/60">&mdash;</span>}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
