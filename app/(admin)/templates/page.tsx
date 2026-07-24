"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { TemplateCard } from "@/components/features/TemplateCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search } from "lucide-react";
import * as api from "@/lib/api";
import type { Category, Template } from "@/lib/api";

function TemplateBrowserInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeCategory = searchParams.get("category") || "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Load categories + all templates (excluding components)
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const allCats = await api.getCategories();
        const cats = allCats.filter((c) => c.name !== "components");
        setCategories(cats);

        const templatePromises = cats.map((c) =>
          api.getTemplates(c.name, true)
        );
        const results = await Promise.all(templatePromises);
        setAllTemplates(results.flat());
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter templates
  const filtered = allTemplates.filter((t) => {
    const matchCategory = !activeCategory || t.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(q));
    return matchCategory && matchSearch;
  });

  function setCategory(cat: string) {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    router.push(`/templates${params.toString() ? `?${params}` : ""}`);
  }

  const totalTemplates = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="edit-panel w-60 shrink-0">
        <div className="flex h-full flex-col">
          <div className="border-b px-4 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <nav className="space-y-0.5 p-2">
              <button
                onClick={() => setCategory("")}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  !activeCategory
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                <span className="flex items-center justify-between">
                  All Templates
                  <Badge
                    variant={!activeCategory ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {totalTemplates}
                  </Badge>
                </span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm capitalize transition-colors ${
                    activeCategory === cat.name
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    {cat.name}
                    <Badge
                      variant={
                        activeCategory === cat.name ? "secondary" : "outline"
                      }
                      className="text-[10px]"
                    >
                      {cat.count}
                    </Badge>
                  </span>
                </button>
              ))}
            </nav>
          </ScrollArea>
          <div className="border-t p-3" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Templates" }]} />
            <Button size="sm" asChild>
              <a href="/templates/new">
                <Plus className="size-3.5" />
                New Template
              </a>
            </Button>
          </div>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="pl-10"
            />
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Loading templates...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-sm">No templates found</p>
              {(search || activeCategory) && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setCategory("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <TemplateCard
                  key={`${t.category}/${t.name}`}
                  name={t.name}
                  description={t.description}
                  category={t.category}
                  tags={t.tags}
                  onClick={() => router.push(`/templates/edit/${encodeURIComponent(t.category)}/${encodeURIComponent(t.name)}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}

export default function TemplateBrowserPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Loading...
        </div>
      }
    >
      <TemplateBrowserInner />
    </Suspense>
  );
}
