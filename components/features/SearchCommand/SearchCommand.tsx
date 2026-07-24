"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { searchTemplates, getBrands } from "@/lib/api";
import type { Template, BrandSummary } from "@/lib/api";

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  type: "template" | "brand";
  name: string;
  category?: string;
  slug?: string;
  description?: string;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keyboard shortcut: Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [templateRes, brandRes] = await Promise.all([
          searchTemplates(value),
          getBrands(),
        ]);

        const templateResults: SearchResult[] = (templateRes || []).map(
          (t: Template) => ({
            type: "template" as const,
            name: t.name,
            category: t.category,
            description: t.description,
          })
        );

        const filteredBrands: SearchResult[] = (brandRes || [])
          .filter(
            (b: BrandSummary) =>
              b.name.toLowerCase().includes(value.toLowerCase()) ||
              b.description?.toLowerCase().includes(value.toLowerCase())
          )
          .map((b: BrandSummary) => ({
            type: "brand" as const,
            name: b.name,
            slug: b.slug,
            description: b.description,
          }));

        setResults([...templateResults, ...filteredBrands]);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Search failed:", err);
        }
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    setQuery("");
    setResults([]);

    if (result.type === "template" && result.category) {
      router.push(`/templates/${result.category}/${result.name}`);
    } else if (result.type === "brand" && result.slug) {
      router.push(`/brands/${result.slug}`);
    }
  };

  const templates = results.filter((r) => r.type === "template");
  const brands = results.filter((r) => r.type === "brand");

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search templates, brands..."
        value={query}
        onValueChange={handleSearch}
      />
      <CommandList>
        {searching ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>

            {templates.length > 0 && (
              <CommandGroup heading="Templates">
                {templates.map((r) => (
                  <CommandItem
                    key={`template-${r.category}-${r.name}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <span className="font-medium">{r.name}</span>
                    {r.category && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.category}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {brands.length > 0 && (
              <CommandGroup heading="Brands">
                {brands.map((r) => (
                  <CommandItem
                    key={`brand-${r.slug}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <span className="font-medium">{r.name}</span>
                    {r.description && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
