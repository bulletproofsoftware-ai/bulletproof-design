"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
// eslint-disable-next-line no-restricted-imports -- Nav legitimately composes SearchCommand; extract to layout if this grows
import { SearchCommand } from "@/components/features/SearchCommand";

const links = [
  { href: "/templates", label: "Templates" },
  // SPEC-011 REQ-061 — surface /components and /icons in the top nav
  // so the new catalogs aren't orphan routes.
  { href: "/components", label: "Components" },
  { href: "/icons", label: "Icons" },
  { href: "/brands", label: "Brands" },
  { href: "/assets", label: "Assets" },
  { href: "/import", label: "Import" },
];

// SPEC-011 REQ-061 — exact-match or nested-child active state. Prevents
// /components from incorrectly highlighting on /components-library.
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Nav() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [modKey, setModKey] = useState("⌘");

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isMac) setModKey("Ctrl");
  }, []);

  return (
    <>
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-6">
        {/* Left: Logo */}
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          Design Library
        </Link>

        {/* Center: Nav links */}
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                data-active={active ? "true" : "false"}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right: Search */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <kbd className="pointer-events-none hidden select-none rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            {modKey}K
          </kbd>
        </Button>
      </nav>

      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
