import { Sidebar } from "@/components/features/Sidebar";

/**
 * Admin route-group layout (REQ-071).
 *
 * Wraps all admin pages (dashboard, brands, templates, assets, components,
 * foundations, guide, import, api-docs) with the Sidebar nav. Portal pages at
 * `/portal/*` escape this layout because they live OUTSIDE the `(admin)`
 * route group, so the Sidebar never renders on a portal page.
 *
 * Root `app/layout.tsx` handles only the <html>/<body> shell and global
 * providers — it must NOT render any admin chrome.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
