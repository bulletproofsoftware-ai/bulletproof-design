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
 * Portal imagery page — REQ-014.
 *
 * Reads the parsed guidelines doc and locates the `imagery` section.
 * Renders the section body HTML (pre-sanitised server-side — see
 * src/api/lib/guidelinesParser.ts, F-GUIDE-01). If the section body
 * looks like it contains dedicated "Photography" and "Illustration"
 * subsections (H3 headings in the raw markdown), renders them as
 * separate panels for visual distinction; otherwise renders a single
 * combined panel.
 */

interface PortalImageryProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PortalImageryProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) return { title: "Brand Portal — Not Found" };
  const title = `${brand.name} — Imagery`;
  const description =
    brand.description ?? `Imagery guidelines for ${brand.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function PortalImageryPage({
  params,
}: PortalImageryProps) {
  const { slug } = await params;
  const [brand, guidelines] = await Promise.all([
    getBrandForPortal(slug),
    getBrandGuidelines(slug),
  ]);
  if (!brand) notFound();

  const section = findImagerySection(guidelines?.sections ?? []);
  const subsectionSplit = section
    ? splitSubsections(section.bodyMarkdown)
    : null;

  return (
    <>
      <PortalBreadcrumbs
        items={[
          { label: "Brands" },
          { label: brand.name, href: `/portal/${slug}` },
          { label: "Visual Identity", href: `/portal/${slug}` },
          { label: "Imagery" },
        ]}
      />
      <h1 className="mb-3 text-[28px] font-normal text-foreground">Imagery</h1>
      <p className="mb-10 max-w-[640px] text-base leading-relaxed text-muted-foreground">
        {section
          ? `Photography and illustration guidance for ${brand.name}.`
          : `Imagery guidelines for ${brand.name}.`}
      </p>

      {!section ? (
        <EmptyState message="Imagery guidelines not yet published." />
      ) : subsectionSplit && subsectionSplit.length >= 2 ? (
        subsectionSplit.map((sub, i) => (
          <Panel key={`${sub.title}-${i}`} title={sub.title}>
            {/* Plain-text rendering for subsections — we split on raw
                markdown H3s so we don't have per-subsection HTML. This
                keeps the portal XSS-safe without re-rendering markdown
                client-side. */}
            <p className="whitespace-pre-line">{sub.body}</p>
          </Panel>
        ))
      ) : (
        <Panel title="Imagery">
          <SanitisedHtml
            html={section.body}
            className="prose prose-neutral max-w-none text-sm text-foreground/80"
          />
        </Panel>
      )}
    </>
  );
}

function findImagerySection(
  sections: GuidelinesSection[],
): GuidelinesSection | null {
  const exact = sections.find((s) => s.slug === "imagery");
  if (exact) return exact;
  const prefix = sections.find((s) => s.slug.startsWith("imagery"));
  if (prefix) return prefix;
  const title = sections.find((s) => /imagery/i.test(s.title));
  return title ?? null;
}

interface Subsection {
  title: string;
  body: string;
}

/**
 * Split a section's raw markdown into subsections keyed by H3 headings.
 *
 * Looks for `### Title` lines. Returns null when there are no H3s or
 * fewer than 2 — the caller treats that as "single-panel".
 *
 * We intentionally do NOT render the subsection body as HTML (it isn't
 * pre-sanitised) — callers render the plain text only, preserving line
 * breaks. This keeps the imagery page XSS-safe without re-running the
 * server-side sanitiser client-side.
 */
function splitSubsections(md: string): Subsection[] | null {
  const lines = md.split("\n");
  const subs: Subsection[] = [];
  let current: Subsection | null = null;
  const H3_PATTERN = /^###\s+(.+)$/;

  for (const line of lines) {
    const h3 = line.match(H3_PATTERN);
    if (h3) {
      if (current) subs.push(current);
      current = { title: h3[1].trim(), body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) subs.push(current);

  // Trim each subsection body.
  for (const s of subs) s.body = s.body.trim();

  return subs.length >= 2 ? subs : null;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-8">
      <h3 className="mb-4 text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="text-sm text-foreground/80">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
