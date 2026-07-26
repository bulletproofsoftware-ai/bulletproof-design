"use client";

import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Loader2 } from "lucide-react";
import { MonacoEditor } from "@/components/features/MonacoEditor";
import * as api from "@/lib/api";

const VIEWPORTS = [
  { label: "Desktop", width: 960 },
  { label: "Tablet", width: 768 },
  { label: "Mobile", width: 375 },
] as const;

function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/|\/$/g, "");
    if (path) {
      return path.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    }
    return u.hostname.replace(/^www\./, "").replace(/\./g, "-");
  } catch {
    return "";
  }
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Return `url` only if it is http(s); otherwise undefined.
 *
 * fetchedUrl is whatever the operator typed into the import box and it is fed
 * straight into an href. `javascript:` and `data:` URLs execute on click, so
 * an operator pasting a crafted link would run it in the admin origin
 * (CodeQL js/xss-through-dom). Omitting the attribute renders an inert anchor.
 */
function httpHrefOrUndefined(url: string): string | undefined {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [fetchedUrl, setFetchedUrl] = useState("");
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [viewport, setViewport] = useState(960);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "fetched" | "generated" | "saved" | "error"
  >("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0 && !category) setCategory(cats[0].name);
    }).catch(console.error);
  }, []);

  function handleFetch() {
    if (!url.trim()) return;
    try {
      new URL(url);
    } catch {
      setError("Invalid URL");
      return;
    }
    setFetchedUrl(url);
    setName(slugFromUrl(url));
    setSourceCode("");
    setStatus("fetched");
    setError("");
  }

  async function handleGenerate() {
    if (!fetchedUrl || !category || !name) {
      setError("URL, category, and name are required");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const result = await api.importFromUrl({
        url: fetchedUrl,
        category,
        name,
        save: false,
      });
      setSourceCode(result.sourceCode);
      setStatus("generated");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!sourceCode || !category || !name) return;
    setSaving(true);
    setError("");
    try {
      try {
        await api.createTemplate({ category, name, sourceCode });
      } catch (createErr: any) {
        // If already exists (409), update instead
        if (createErr.message.includes("already exists") || createErr.message.includes("409")) {
          await api.updateTemplate(category, name, sourceCode);
        } else {
          throw createErr;
        }
      }
      setStatus("saved");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Import from URL" }]} />
      <h1 className="mb-6 text-3xl font-bold">Import from URL</h1>

      {/* URL bar */}
      <div className="mb-6 flex gap-3">
        <Input
          placeholder="https://example.com/page"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          className="flex-1"
        />
        <Button onClick={handleFetch} disabled={!url.trim()}>
          Fetch
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {status === "idle" ? (
        <div className="flex h-96 items-center justify-center rounded-xl border-2 border-dashed border-border text-center">
          <div>
            <ExternalLink className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Paste a URL and click Fetch</p>
            <p className="text-sm text-muted-foreground/60 mt-1">A screenshot preview will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Screenshot Preview */}
          <div className="stat-card !p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{hostnameFromUrl(fetchedUrl)}</span>
                <a href={httpHrefOrUndefined(fetchedUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Open <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                {VIEWPORTS.map((vp) => (
                  <Badge key={vp.width} variant={viewport === vp.width ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setViewport(vp.width)}>
                    {vp.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="bg-muted/30 p-4 flex justify-center" style={{ minHeight: 400 }}>
              <img
                src={`https://image.thum.io/get/width/${viewport}/crop/800/${encodeURI(fetchedUrl)}`}
                alt={`Screenshot of ${hostnameFromUrl(fetchedUrl)}`}
                className="rounded-lg border border-border shadow-md"
                style={{ maxWidth: "100%", height: "auto" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>

          {/* Generate Controls */}
          <div className="edit-panel rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.name} value={c.name}>{c.name} ({c.count})</SelectItem>
                    ))}
                    <SelectItem value="imported">imported</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Template Name</label>
                <Input placeholder="template-name" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
              </div>
              <Button onClick={handleGenerate} disabled={generating || !fetchedUrl || !category || !name}>
                {generating && <Loader2 className="size-4 animate-spin" />}
                {generating ? "Generating..." : "Generate Template"}
              </Button>
              {sourceCode && (
                <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
                  {saving ? "Saving..." : "Save to Library"}
                </Button>
              )}

              {status === "saved" && (
                <Badge variant="secondary">Saved to library</Badge>
              )}
            </div>

            {/* Generated code editor */}
            {sourceCode && (
              <MonacoEditor
                value={sourceCode}
                onChange={setSourceCode}
                height="400px"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
