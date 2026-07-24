import { notFound } from "next/navigation";
import { getBrandForPortal } from "@/lib/api";
import { BrandEditor } from "./BrandEditor";

/**
 * SPEC-007 — Brand admin editor route (REQ-016).
 *
 * Server component: fetches the brand config then hands off to a client
 * component (`BrandEditor`) that owns tab state and per-tab save flows.
 * Missing brands trigger `notFound()` so Next.js renders the default 404.
 *
 * `getBrandForPortal` uses `cache: "no-store"`, so edits made elsewhere
 * show up on the next navigation without a rebuild.
 */
export default async function BrandEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) {
    notFound();
  }
  return <BrandEditor initialBrand={brand} />;
}

export const dynamic = "force-dynamic";
