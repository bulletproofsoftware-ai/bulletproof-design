"use client";

import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wand2, Copy, Check, Shuffle } from "lucide-react";
import * as api from "@/lib/api";
import { isRoleGroupedColors } from "@/lib/types/brand";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";

const PRESET_PALETTES = [
  { name: "Ocean Blue", primary: "#3b82f6", secondary: "#1e293b", accent: "#06b6d4", bg: "#f8fafc", text: "#0f172a" },
  { name: "Forest Green", primary: "#16a34a", secondary: "#14532d", accent: "#84cc16", bg: "#f0fdf4", text: "#052e16" },
  { name: "Royal Purple", primary: "#7c3aed", secondary: "#2e1065", accent: "#a78bfa", bg: "#faf5ff", text: "#1e1b4b" },
  { name: "Sunset Orange", primary: "#ea580c", secondary: "#431407", accent: "#f59e0b", bg: "#fff7ed", text: "#431407" },
  { name: "Rose Pink", primary: "#e11d48", secondary: "#1c1917", accent: "#fb7185", bg: "#fff1f2", text: "#1c1917" },
  { name: "Slate Mono", primary: "#475569", secondary: "#0f172a", accent: "#94a3b8", bg: "#f8fafc", text: "#0f172a" },
  { name: "Dark Mode", primary: "#60a5fa", secondary: "#0f172a", accent: "#34d399", bg: "#0f172a", text: "#f1f5f9" },
  { name: "Warm Earth", primary: "#b45309", secondary: "#292524", accent: "#d97706", bg: "#fefce8", text: "#1c1917" },
];

interface BrandTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  fontHeading: string;
  fontBody: string;
  fontMono: string;
  radius: string;
}

const DEFAULT_TOKENS: BrandTokens = {
  primary: "#3b82f6",
  secondary: "#1e293b",
  accent: "#06b6d4",
  background: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  error: "#ef4444",
  warning: "#f59e0b",
  success: "#22c55e",
  fontHeading: "Inter",
  fontBody: "Inter",
  fontMono: "JetBrains Mono",
  radius: "8px",
};

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-7 w-7 shrink-0 cursor-pointer rounded-md border border-slate-600 shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-slate-400 block">{label}</span>
        <span className="text-[11px] font-mono text-slate-300">{value}</span>
      </div>
    </div>
  );
}

export default function ConfiguratorPage() {
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [templates, setTemplates] = useState<Array<{ name: string; category: string }>>([]);
  const [brands, setBrands] = useState<api.BrandSummary[]>([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [tokens, setTokens] = useState<BrandTokens>({ ...DEFAULT_TOKENS });
  const [copied, setCopied] = useState(false);
  const [roleGroupedNotice, setRoleGroupedNotice] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [cats, brandList] = await Promise.all([
          api.getCategories(),
          api.getBrands(),
        ]);
        setCategories(cats);
        setBrands(brandList);
        if (cats.length > 0) {
          setSelectedCategory(cats[0].name);
        }
      } catch {}
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    async function loadTemplates() {
      try {
        const data = await api.getTemplates(selectedCategory);
        setTemplates(data.map((t: any) => ({ name: t.name, category: selectedCategory })));
        if (data.length > 0) setSelectedTemplate(data[0].name);
      } catch {}
    }
    loadTemplates();
  }, [selectedCategory]);

  function applyBrand(slug: string) {
    api.getBrand(slug).then((brand) => {
      // Role-grouped brands use a different color schema the flat
      // configurator cannot render without corruption. Show a read-only
      // notice instead of loading tokens from an incompatible shape.
      if (isRoleGroupedColors(brand.colors as unknown as Parameters<typeof isRoleGroupedColors>[0])) {
        setRoleGroupedNotice(
          `"${brand.name}" uses the expanded role-grouped color schema. Edit it in /brands/${brand.slug} — the flat configurator cannot apply it without losing data.`,
        );
        return;
      }
      setRoleGroupedNotice(null);
      const colors = brand.colors as unknown as api.BrandColors;
      const newTokens: BrandTokens = {
        primary: colors.primary,
        secondary: colors.secondary,
        accent: colors.accent,
        background: colors.background,
        surface: colors.surface,
        text: colors.text,
        textMuted: colors.textMuted,
        border: colors.border,
        error: colors.error,
        warning: colors.warning,
        success: colors.success,
        fontHeading: brand.fonts.heading,
        fontBody: brand.fonts.body,
        fontMono: brand.fonts.mono ?? "JetBrains Mono",
        radius: brand.borderRadius?.medium || "8px",
      };
      setTokens(newTokens);
    });
  }

  function applyPreset(preset: typeof PRESET_PALETTES[0]) {
    const newTokens = {
      ...tokens,
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      background: preset.bg,
      text: preset.text,
    };
    setTokens(newTokens);
  }

  function randomize() {
    // crypto.getRandomValues used instead of Math.random for unpredictable
    // selection. Rejection sampling rather than a bare `% length`: 2^32 is not
    // a multiple of the palette count, so the plain modulo makes the first
    // (2^32 % length) presets marginally likelier than the rest
    // (CodeQL js/biased-cryptographic-random). Discarding the short tail
    // removes the bias; the loop retries with probability < 1 in 2^22 here.
    const count = PRESET_PALETTES.length;
    const limit = Math.floor(0x1_0000_0000 / count) * count;
    let draw: number;
    do {
      draw = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (draw >= limit);
    const preset = PRESET_PALETTES[draw % count];
    applyPreset(preset);
  }

  function updateToken(key: keyof BrandTokens, value: string) {
    setTokens((prev) => ({ ...prev, [key]: value }));
  }

  function buildCssExport(): string {
    return `:root {
  /* Colors */
  --brand-primary: ${tokens.primary};
  --brand-secondary: ${tokens.secondary};
  --brand-accent: ${tokens.accent};
  --brand-bg: ${tokens.background};
  --brand-surface: ${tokens.surface};
  --brand-text: ${tokens.text};
  --brand-text-muted: ${tokens.textMuted};
  --brand-border: ${tokens.border};
  --brand-error: ${tokens.error};
  --brand-warning: ${tokens.warning};
  --brand-success: ${tokens.success};

  /* Typography */
  --brand-font-heading: '${tokens.fontHeading}', sans-serif;
  --brand-font-body: '${tokens.fontBody}', sans-serif;
  --brand-font-mono: '${tokens.fontMono}', monospace;

  /* Layout */
  --brand-radius: ${tokens.radius};
}`;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildCssExport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cat = encodeURIComponent(selectedCategory);
  const template = encodeURIComponent(selectedTemplate);
  const previewUrl = selectedCategory && selectedTemplate
    ? `${API}/preview/${cat}/${template}?primary=${encodeURIComponent(tokens.primary)}&secondary=${encodeURIComponent(tokens.secondary)}&accent=${encodeURIComponent(tokens.accent)}&bg=${encodeURIComponent(tokens.background)}&surface=${encodeURIComponent(tokens.surface)}&text=${encodeURIComponent(tokens.text)}&textMuted=${encodeURIComponent(tokens.textMuted)}&border=${encodeURIComponent(tokens.border)}&fontHeading=${encodeURIComponent(tokens.fontHeading)}&fontBody=${encodeURIComponent(tokens.fontBody)}&radius=${encodeURIComponent(tokens.radius)}`
    : "";

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-white px-6 py-3">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Brands", href: "/brands" }, { label: "Configurator" }]} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wand2 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Brand Configurator</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={randomize}>
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </Button>
            <Button size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Export CSS"}
            </Button>
          </div>
        </div>
      </div>

      {roleGroupedNotice && (
        <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-6 py-2 text-xs text-amber-900">
          <span className="font-semibold">Expanded schema:</span> {roleGroupedNotice}
          <button
            className="ml-3 underline hover:no-underline"
            onClick={() => setRoleGroupedNotice(null)}
            type="button"
          >
            dismiss
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Controls */}
        <div className="w-[280px] shrink-0 overflow-hidden" style={{ backgroundColor: "#111827", color: "#e2e8f0" }}>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">

              {/* Template */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Template</h3>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-xs text-slate-200">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.name} value={c.name}>{c.name.replace(/-/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-xs text-slate-200">
                    <SelectValue placeholder="Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              {/* Brand Presets */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Load Brand</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {brands.map((b) => (
                    <button key={b.slug} onClick={() => applyBrand(b.slug)} className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1.5 text-[11px] hover:bg-slate-700 transition-colors text-left">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: b.primaryColor }} />
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Color Presets */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Color Presets</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_PALETTES.map((p) => (
                    <button key={p.name} onClick={() => applyPreset(p)} className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1.5 text-[11px] hover:bg-slate-700 transition-colors text-left">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.primary }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* All Colors */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Colors</h3>
                <div className="grid grid-cols-2 gap-2">
                  <ColorSwatch label="Primary" value={tokens.primary} onChange={(v) => updateToken("primary", v)} />
                  <ColorSwatch label="Secondary" value={tokens.secondary} onChange={(v) => updateToken("secondary", v)} />
                  <ColorSwatch label="Accent" value={tokens.accent} onChange={(v) => updateToken("accent", v)} />
                  <ColorSwatch label="Background" value={tokens.background} onChange={(v) => updateToken("background", v)} />
                  <ColorSwatch label="Surface" value={tokens.surface} onChange={(v) => updateToken("surface", v)} />
                  <ColorSwatch label="Text" value={tokens.text} onChange={(v) => updateToken("text", v)} />
                  <ColorSwatch label="Text Muted" value={tokens.textMuted} onChange={(v) => updateToken("textMuted", v)} />
                  <ColorSwatch label="Border" value={tokens.border} onChange={(v) => updateToken("border", v)} />
                  <ColorSwatch label="Error" value={tokens.error} onChange={(v) => updateToken("error", v)} />
                  <ColorSwatch label="Warning" value={tokens.warning} onChange={(v) => updateToken("warning", v)} />
                  <ColorSwatch label="Success" value={tokens.success} onChange={(v) => updateToken("success", v)} />
                </div>
              </section>

              {/* Typography */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Typography</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] text-slate-400">Heading</span>
                    <Select value={tokens.fontHeading} onValueChange={(v) => updateToken("fontHeading", v)}>
                      <SelectTrigger className="h-7 bg-slate-800 border-slate-700 text-xs text-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Inter", "Roboto", "Poppins", "DM Sans", "Space Grotesk", "Manrope", "Outfit", "Sora", "Playfair Display", "Merriweather", "Lora"].map((f) => (
                          <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Body</span>
                    <Select value={tokens.fontBody} onValueChange={(v) => updateToken("fontBody", v)}>
                      <SelectTrigger className="h-7 bg-slate-800 border-slate-700 text-xs text-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Inter", "Roboto", "Open Sans", "Poppins", "DM Sans", "Manrope", "Outfit", "Sora"].map((f) => (
                          <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Mono</span>
                    <Select value={tokens.fontMono} onValueChange={(v) => updateToken("fontMono", v)}>
                      <SelectTrigger className="h-7 bg-slate-800 border-slate-700 text-xs text-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono"].map((f) => (
                          <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Radius */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Border Radius</h3>
                <div className="flex gap-1.5">
                  {["0px", "4px", "8px", "12px", "16px", "9999px"].map((r) => (
                    <button
                      key={r}
                      onClick={() => updateToken("radius", r)}
                      className={`h-8 w-8 rounded-md border text-[9px] transition-all ${
                        tokens.radius === r
                          ? "border-blue-500 bg-blue-500/20 text-blue-300"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                      }`}
                      style={{ borderRadius: r === "9999px" ? "9999px" : undefined }}
                    >
                      {r === "9999px" ? "Full" : parseInt(r)}
                    </button>
                  ))}
                </div>
              </section>

              {/* Preset string */}
              <section className="space-y-1">
                <code className="block rounded bg-slate-800 px-2 py-1.5 text-[9px] text-slate-400 break-all">
                  --preset {tokens.primary.slice(1)}{tokens.secondary.slice(1)}{tokens.accent.slice(1)}
                </code>
              </section>
            </div>
          </ScrollArea>
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 overflow-hidden bg-[#e8ecf0]">
          {previewUrl ? (
            <div className="h-full p-4">
              <div className="stat-card h-full !p-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{selectedCategory}/{selectedTemplate}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Color preview dots */}
                    {[tokens.primary, tokens.secondary, tokens.accent, tokens.background, tokens.text].map((c, i) => (
                      <span key={i} className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <iframe
                  key={JSON.stringify(tokens)}
                  src={previewUrl}
                  className="w-full border-0"
                  style={{ height: "calc(100% - 40px)" }}
                  title="Preview"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Wand2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Brand Configurator</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Pick a template and adjust colors, fonts, and radius on the left. The preview updates live.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
