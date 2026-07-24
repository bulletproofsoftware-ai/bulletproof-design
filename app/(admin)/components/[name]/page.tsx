/**
 * Component spec detail page (SPEC-008 REQ-022).
 *
 * Server component that fetches the spec via the registry-driven API and
 * delegates rendering to the client-side `ComponentSpecViewer`. Renders a
 * Next.js 404 when the registry has no matching component.
 *
 * Dynamic metadata pulls the component's name + description so the browser
 * tab + share cards are accurate.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getComponentSpec } from "@/lib/api";
import { ComponentSpecViewer } from "@/components/features/ComponentSpecViewer";

interface PageProps {
  // Next.js 15 dynamic-route params are async.
  params: Promise<{ name: string }>;
}

/**
 * Probe the API for a given name. Returns the spec on success or `null`
 * when the component is missing / the API responded with an error. We
 * prefer `null` over a thrown error so `notFound()` can render cleanly
 * without tripping the error boundary.
 */
async function safeGetComponentSpec(name: string) {
  try {
    return await getComponentSpec(name);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const spec = await safeGetComponentSpec(name);
  if (!spec) {
    return {
      title: "Component not found — Design Library",
    };
  }
  return {
    title: `${spec.name} — Components`,
    description: spec.description || `Spec for the ${spec.name} component.`,
  };
}

export default async function ComponentSpecPage({ params }: PageProps) {
  const { name } = await params;
  const spec = await safeGetComponentSpec(name);
  if (!spec) notFound();
  return <ComponentSpecViewer spec={spec} />;
}
