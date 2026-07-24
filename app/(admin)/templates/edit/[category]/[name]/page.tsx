"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { MonacoEditor } from "@/components/features/MonacoEditor";
import { LivePreview } from "@/components/features/LivePreview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/primitives/TagInput";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  Eye,
  Code2,
  FileText,
  Palette,
} from "lucide-react";
import * as api from "@/lib/api";
import type { Template, BrandConfig } from "@/lib/api";

type Tab = "preview" | "code" | "usage";

export default function EditTemplatePage() {
  const params = useParams<{ category: string; name: string }>();
  const router = useRouter();

  const routeCategory = decodeURIComponent(params.category);
  const routeName = decodeURIComponent(params.name);

  const [tab, setTab] = useState<Tab>("preview");
  const [template, setTemplate] = useState<Template | null>(null);
  const [sourceCode, setSourceCode] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";

  /** Check if the current source code contains a `const theme = { ... }` block. */
  function hasThemeBlock(code: string): boolean {
    return /const\s+theme\s*=\s*\{/.test(code);
  }

  /** Extract theme values from a `const theme = { ... }` block in source code. */
  function extractTheme(code: string): Record<string, string> {
    const match = code.match(/const\s+theme\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
    if (!match) return {};
    const block = match[1];
    const result: Record<string, string> = {};
    const propRegex = /(\w+)\s*:\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = propRegex.exec(block)) !== null) {
      result[m[1]] = m[2];
    }
    return result;
  }

  /** Convert a name string to a URL-friendly slug. */
  function toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /** Open the Create Brand dialog, pre-filling fields from the template. */
  function openBrandDialog() {
    const cleanName = (template?.name || routeName)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setBrandName(cleanName);
    setBrandSlug(toSlug(cleanName));
    setBrandDescription(
      `Brand extracted from ${template?.source || "template"}: ${template?.category}/${template?.name}`
    );
    setBrandDialogOpen(true);
  }

  /** Create a brand from the extracted theme values. */
  async function handleCreateBrand() {
    setCreatingBrand(true);
    setStatus(null);

    try {
      const theme = extractTheme(sourceCode);

      const brand: BrandConfig = {
        name: brandName,
        slug: brandSlug,
        description: brandDescription,
        logo: { mark: "", horizontal: "", favicon: "" },
        colors: {
          primary: theme.primary || "#3b82f6",
          secondary: theme.secondary || theme.primary || "#6366f1",
          accent: theme.accent || "#8b5cf6",
          background: theme.background || "#ffffff",
          surface: theme.surface || "#f8fafc",
          text: theme.text || "#0f172a",
          textMuted: theme.muted || theme.textMuted || "#64748b",
          border: theme.border || "#e2e8f0",
          error: theme.error || "#ef4444",
          warning: theme.warning || "#f59e0b",
          success: theme.success || "#22c55e",
        },
        fonts: {
          heading: theme.headingFont || theme.heading || "Inter",
          body: theme.bodyFont || theme.body || "Inter",
          mono: theme.monoFont || theme.mono || "JetBrains Mono",
        },
        spacing: { unit: 4, scale: [0, 1, 2, 4, 8, 16, 32, 64] },
        borderRadius: {
          small: "0.25rem",
          medium: "0.5rem",
          large: "1rem",
          full: "9999px",
        },
        shadows: {
          small: "0 1px 2px rgba(0,0,0,0.05)",
          medium: "0 4px 6px rgba(0,0,0,0.1)",
          large: "0 10px 15px rgba(0,0,0,0.1)",
        },
      };

      await api.createBrand(brand);
      setBrandDialogOpen(false);
      setStatus({ type: "success", message: `Brand "${brandName}" created` });
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message || "Failed to create brand",
      });
    } finally {
      setCreatingBrand(false);
    }
  }

  // Load template and categories
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const tmpl = await api.getTemplate(routeCategory, routeName);
        setTemplate(tmpl);
        setSourceCode(tmpl.sourceCode || "");
        setDescription(tmpl.description || "");
        setTags(tmpl.tags || []);
      } catch (err: any) {
        setStatus({
          type: "error",
          message: err.message || "Failed to load template",
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [routeCategory, routeName]);

  // Clear status after 3 seconds
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleSave() {
    if (!template) return;

    setSaving(true);
    setStatus(null);

    try {
      // Update the meta block in source code with current form values
      const metaRegex = /\/\*\*[\s\S]*?\*\//;
      const tagStr = tags.join(", ");
      const newMeta = `/**
 * @meta
 * category: ${template.category}
 * name: ${template.name}
 * description: ${description}
 * tags: [${tagStr}]
 * source: ${template.source || "manual"}
 */`;

      let finalSource = sourceCode;
      if (metaRegex.test(finalSource)) {
        finalSource = finalSource.replace(metaRegex, newMeta);
      }

      await api.updateTemplate(template.category, template.name, finalSource);
      setSourceCode(finalSource);
      setStatus({ type: "success", message: "Template saved" });
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message || "Failed to save template",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!template) return;

    setDeleting(true);
    try {
      await api.deleteTemplate(template.category, template.name);
      router.push("/templates");
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message || "Failed to delete template",
      });
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading template...
      </div>
    );
  }

  if (!template && !loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>
          Template not found: {routeCategory}/{routeName}
        </p>
        <Button variant="outline" onClick={() => router.push("/templates")}>
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/templates")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex flex-col gap-0.5">
            <Breadcrumbs
              items={[
                { label: "Dashboard", href: "/" },
                { label: "Templates", href: "/templates" },
                {
                  label: routeCategory,
                  href: `/templates?category=${routeCategory}`,
                },
                { label: routeName },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented tab control */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                tab === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setTab("preview")}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                tab === "code"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setTab("code")}
            >
              <Code2 className="h-3.5 w-3.5" /> Code
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                tab === "usage"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setTab("usage")}
            >
              <FileText className="h-3.5 w-3.5" /> Usage
            </button>
          </div>

          {status && (
            <Badge
              variant={status.type === "success" ? "default" : "destructive"}
            >
              {status.message}
            </Badge>
          )}

          {hasThemeBlock(sourceCode) && (
            <Button
              size="sm"
              onClick={openBrandDialog}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              <Palette className="size-3.5" />
              Create Brand
            </Button>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {/* Preview tab */}
        {tab === "preview" && (
          <LivePreview
            url={`${apiBase}/preview/${encodeURIComponent(routeCategory)}/${encodeURIComponent(routeName)}`}
            className="h-full"
          />
        )}

        {/* Code tab */}
        {tab === "code" && (
          <MonacoEditor
            value={sourceCode}
            onChange={setSourceCode}
            language="typescript"
            height="100%"
          />
        )}

        {/* Usage tab */}
        {tab === "usage" && (
          <div className="edit-panel h-full overflow-auto p-6">
            <div className="mx-auto max-w-2xl space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Name
                </label>
                <Input value={template?.name || ""} disabled />
                <p className="mt-1 text-xs text-muted-foreground">
                  Name cannot be changed after creation
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Category
                </label>
                <Input value={template?.category || ""} disabled />
                <p className="mt-1 text-xs text-muted-foreground">
                  Category cannot be changed after creation
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the template"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Tags
                </label>
                <TagInput tags={tags} onChange={setTags} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Source
                </label>
                <Badge variant="outline">
                  {template?.source || "unknown"}
                </Badge>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  File Path
                </label>
                <p className="break-all text-xs text-muted-foreground">
                  {template?.filePath}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong>
              {template?.category}/{template?.name}
            </strong>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Brand Dialog */}
      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Brand from Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Brand Name
              </label>
              <Input
                value={brandName}
                onChange={(e) => {
                  setBrandName(e.target.value);
                  setBrandSlug(toSlug(e.target.value));
                }}
                placeholder="My Brand"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Slug</label>
              <Input
                value={brandSlug}
                onChange={(e) => setBrandSlug(e.target.value)}
                placeholder="my-brand"
                className="font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL-friendly identifier, auto-generated from name
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Input
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                placeholder="Brand description"
              />
            </div>
            {hasThemeBlock(sourceCode) && (
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Detected theme colors
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(extractTheme(sourceCode))
                    .filter(([, v]) => /^#[0-9a-fA-F]{3,8}$/.test(v))
                    .map(([key, color]) => (
                      <div
                        key={key}
                        className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-full border"
                          style={{ backgroundColor: color }}
                        />
                        {key}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBrandDialogOpen(false)}
              disabled={creatingBrand}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBrand}
              disabled={creatingBrand || !brandName.trim() || !brandSlug.trim()}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {creatingBrand ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Palette className="size-3.5" />
              )}
              Create Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
