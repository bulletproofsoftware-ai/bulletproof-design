/**
 * Generates src/components/ai-context.md from the registries and tokens.
 *
 * Run: npx tsx scripts/generate-ai-context.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

interface ComponentEntry {
  name: string;
  tier: string;
  path: string;
  client?: boolean;
  description?: string;
  variants?: Record<string, string[]>;
  props?: Array<{ name: string; type: string }>;
  dependencies?: string[];
  examples?: Array<{ label: string; code: string }>;
  accessibility?: Record<string, unknown>;
}

interface AssetEntry {
  name: string;
  file: string;
  category: string;
  format: string;
  size: string;
  tags: string[];
  usage: string;
}

type TokenValue = { $value: string; $type: string };
type TokenCategory = Record<string, TokenValue>;
type TokenFile = Record<string, TokenCategory>;

async function readJson<T>(relPath: string): Promise<T> {
  const raw = await readFile(resolve(ROOT, relPath), "utf-8");
  return JSON.parse(raw) as T;
}

function formatProps(props?: Array<{ name: string; type: string }>): string {
  if (!props || props.length === 0) return "";
  return props.map((p) => `\`${p.name}: ${p.type}\``).join(", ");
}

async function main() {
  const components = await readJson<{ components: ComponentEntry[] }>(
    "src/components/registry.json"
  );
  const assets = await readJson<{ assets: AssetEntry[] }>(
    "src/assets/registry.json"
  );
  const tokens = await readJson<TokenFile>("design-tokens/tokens.json");

  const tiers: Record<string, ComponentEntry[]> = {
    ui: [],
    primitives: [],
    features: [],
    effects: [],
  };
  for (const c of components.components) {
    const bucket = tiers[c.tier];
    if (bucket) bucket.push(c);
  }

  // ── Token section ──
  const tokenLines: string[] = [];
  for (const [category, values] of Object.entries(tokens)) {
    tokenLines.push(`### ${category}`);
    for (const [key, val] of Object.entries(values)) {
      tokenLines.push(`- \`${key}\`: ${val.$value} (${val.$type})`);
    }
    tokenLines.push("");
  }

  // ── Component sections ──
  function renderTier(label: string, tierKey: string): string {
    const items = tiers[tierKey];
    if (!items || items.length === 0) return `### ${label}\nNone yet.\n`;
    const lines = [`### ${label}`];
    for (const c of items) {
      const propsStr = formatProps(c.props);
      lines.push(`- **${c.name}** — ${c.description ?? "No description"}`);
      if (propsStr) lines.push(`  - Props: ${propsStr}`);
      if (c.variants) {
        const variantStr = Object.entries(c.variants)
          .map(([k, v]) => `${k}: ${v.join(", ")}`)
          .join("; ");
        lines.push(`  - Variants: ${variantStr}`);
      }
      if (c.client) lines.push(`  - Client component ("use client")`);
    }
    lines.push("");
    return lines.join("\n");
  }

  // ── Asset section ──
  const assetLines: string[] = ["## Asset Inventory", ""];
  const assetCategories = new Map<string, AssetEntry[]>();
  for (const a of assets.assets) {
    const cat = a.category;
    if (!assetCategories.has(cat)) assetCategories.set(cat, []);
    assetCategories.get(cat)!.push(a);
  }
  for (const [cat, items] of assetCategories) {
    assetLines.push(`### ${cat}`);
    for (const a of items) {
      assetLines.push(`- **${a.name}** — ${a.usage} (${a.format}, ${a.size})`);
    }
    assetLines.push("");
  }

  // ── Examples section ──
  const exampleLines: string[] = ["## Usage Examples", ""];
  for (const c of components.components) {
    if (c.examples && c.examples.length > 0) {
      exampleLines.push(`### ${c.name}`);
      for (const ex of c.examples) {
        exampleLines.push(`**${ex.label}:**`);
        exampleLines.push("```tsx");
        exampleLines.push(ex.code);
        exampleLines.push("```");
      }
      exampleLines.push("");
    }
  }

  // ── Compose ──
  const md = `# Design System Context

## Token System
${tokenLines.join("\n")}

## Component Inventory
${renderTier("ui/ (Pristine Primitives)", "ui")}
${renderTier("primitives/ (Domain-Agnostic)", "primitives")}
${renderTier("features/ (Product-Level)", "features")}
${renderTier("effects/ (Animated/Marketing)", "effects")}

${assetLines.join("\n")}

## Import Rules
- **ui**: External packages only
- **primitives**: ui/, external packages
- **features**: primitives/, ui/, external packages. Cannot import from other features.
- **effects**: ui/, external packages

${exampleLines.join("\n")}
`;

  const outPath = resolve(ROOT, "src/components/ai-context.md");
  await writeFile(outPath, md, "utf-8");
  console.log(`Generated ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
