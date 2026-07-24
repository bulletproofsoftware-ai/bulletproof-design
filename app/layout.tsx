import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Design Library",
  description: "Browse templates, brands, and assets",
};

/**
 * Root layout — HTML shell only.
 *
 * Admin chrome (Sidebar) lives in `app/(admin)/layout.tsx`. Portal chrome
 * lives in `app/portal/[slug]/layout.tsx`. This root layout MUST NOT render
 * either — keeping it minimal guarantees route-group isolation (REQ-071).
 *
 * Reads `x-nonce` from request headers so Next.js propagates the nonce to
 * framework script tags — required for the production CSP with
 * `strict-dynamic` set in middleware.ts to hydrate correctly.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await headers();
  return (
    <html lang="en">
      <body
        className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
