/**
 * Component Generator CLI
 *
 * Usage:
 *   npm run generate -- "a card that shows a user's subscription status"
 *
 * Generates a component scaffold (or AI-powered implementation if ANTHROPIC_API_KEY is set)
 * in the correct tier directory with test file and registry metadata entry.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import YAML from "yaml";
import { ESLint } from "eslint";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");

/* ───────────── Tier Classification ───────────── */

const FEATURE_KEYWORDS = [
  "template",
  "brand",
  "asset",
  "editor",
  "sidebar",
  "dashboard",
  "nav",
  "breadcrumb",
  "search command",
];

const EFFECT_KEYWORDS = [
  "animation",
  "effect",
  "aurora",
  "beam",
  "sparkle",
  "parallax",
  "glow",
  "shimmer",
  "pulse",
  "fade",
  "transition",
];

export type Tier = "primitives" | "features" | "effects";

export function classifyTier(description: string): Tier {
  const lower = description.toLowerCase();

  for (const kw of EFFECT_KEYWORDS) {
    if (lower.includes(kw)) return "effects";
  }
  for (const kw of FEATURE_KEYWORDS) {
    if (lower.includes(kw)) return "features";
  }
  return "primitives";
}

/* ───────────── Name Extraction ───────────── */

/** Words to strip from the description when extracting the component name. */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "that",
  "which",
  "with",
  "and",
  "or",
  "for",
  "to",
  "in",
  "on",
  "of",
  "is",
  "it",
  "its",
  "from",
  "by",
  "as",
  "at",
  "shows",
  "displays",
  "renders",
  "creates",
  "has",
  "uses",
  "user",
  "users",
  "user's",
]);

export function extractComponentName(description: string): string {
  // Remove punctuation, split into words, drop stop words
  const words = description
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) {
    return "GeneratedComponent";
  }

  // Take the first 3-4 meaningful words to form the name
  const nameWords = words.slice(0, 4);

  // PascalCase each word
  return nameWords
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/* ───────────── Fuzzy Matching ───────────── */

function normalize(name: string): string {
  return name.replace(/[^a-zA-Z]/g, "").toLowerCase();
}

export function findSimilarComponents(
  componentName: string,
  registryPath: string,
): string[] {
  if (!existsSync(registryPath)) return [];

  try {
    const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    const components: Array<{ name: string }> = registry.components ?? [];
    const target = normalize(componentName);

    return components
      .map((c) => c.name)
      .filter((name) => {
        const norm = normalize(name);
        // Check if the existing name is contained in the new name or vice versa
        return (
          norm.includes(target) ||
          target.includes(norm) ||
          levenshteinSimilarity(norm, target) > 0.6
        );
      });
  } catch {
    return [];
  }
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen;
}

/* ───────────── File Generation ───────────── */

function needsUseClient(tier: Tier, description: string): boolean {
  if (tier === "effects") return true;
  const interactiveKeywords = [
    "click",
    "hover",
    "toggle",
    "expand",
    "collapse",
    "input",
    "select",
    "drag",
    "drop",
    "button",
    "interactive",
    "state",
    "counter",
    "form",
  ];
  const lower = description.toLowerCase();
  return interactiveKeywords.some((kw) => lower.includes(kw));
}

function generateIndexFile(name: string): string {
  return `export { ${name} } from "./${name}";\n`;
}

function generateComponentFile(
  name: string,
  tier: Tier,
  description: string,
): string {
  const useClient = needsUseClient(tier, description);
  const lines: string[] = [];

  if (useClient) {
    lines.push('"use client";', "");
  }

  lines.push('import { cn } from "@/lib/utils";', "");

  lines.push(`interface ${name}Props {`, "  className?: string;", "}", "");

  lines.push(
    `export function ${name}({ className }: ${name}Props) {`,
    "  return (",
    `    <div className={cn("", className)}>`,
    `      {/* TODO: Implement based on description */}`,
    `      {/* Description: ${description} */}`,
    "    </div>",
    "  );",
    "}",
    "",
  );

  return lines.join("\n");
}

function generateTestFile(name: string): string {
  return `/**
 * @jest-environment jsdom
 */
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { ${name} } from "./index";

expect.extend(toHaveNoViolations);

describe("${name}", () => {
  it("renders without crashing", () => {
    const { container } = render(<${name} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<${name} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
`;
}

/* ───────────── Registry Metadata Update ───────────── */

function appendRegistryMeta(name: string, metaPath: string): void {
  if (!existsSync(metaPath)) {
    console.warn(`  Warning: ${metaPath} not found — skipping metadata update`);
    return;
  }

  const content = readFileSync(metaPath, "utf-8");
  const doc = YAML.parseDocument(content);
  const components = doc.get("components");

  if (!YAML.isSeq(components)) {
    console.warn(
      "  Warning: registry-meta.yaml has unexpected structure — skipping metadata update",
    );
    return;
  }

  // Check if entry already exists
  for (const item of components.items) {
    if (YAML.isMap(item) && item.get("name") === name) {
      console.log(`  Registry entry for "${name}" already exists — skipping`);
      return;
    }
  }

  const entry = doc.createNode({
    name,
    description: "TODO: Add description",
    examples: [{ label: "Basic usage", code: `<${name} />` }],
    accessibility: { notes: "TODO: Document accessibility" },
  });

  components.add(entry);
  writeFileSync(metaPath, doc.toString(), "utf-8");
}

/* ───────────── AI Generation (Optional) ───────────── */

async function generateWithAI(
  name: string,
  tier: Tier,
  description: string,
  registryContext: string,
  tokenList: string,
): Promise<string | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const useClient = needsUseClient(tier, description);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Generate a React component implementation for a design system.

Component name: ${name}
Tier: ${tier}
Description: ${description}

Rules:
- ${useClient ? 'Include "use client" directive at top' : 'Do NOT include "use client" directive'}
- Import cn from "@/lib/utils"
- Import UI primitives from "@/components/ui/" (e.g. Button, Card, Badge, Input)
- Use design token CSS variables (var(--ds-*)) — never hardcode colors
- TypeScript with proper interface for props
- Include className prop that merges via cn()
- Export as named export: export function ${name}

Available design tokens:
${tokenList}

Existing components in the registry (you can import from these):
${registryContext}

Return ONLY the component file contents — no markdown fences, no explanation.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      // Strip markdown code block wrappers that LLMs frequently add
      let content = textBlock.text;
      content = content.replace(/^```\w*\n/, "").replace(/\n```\s*$/, "");
      return content;
    }
    return null;
  } catch (err) {
    console.warn(
      `  AI generation failed, falling back to scaffold: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/* ───────────── ESLint Validation ───────────── */

async function validateWithEslint(
  code: string,
  filePath: string,
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const eslint = new ESLint({
      overrideConfigFile: resolve(ROOT, "eslint.config.mjs"),
    });
    const results = await eslint.lintText(code, { filePath });
    const errors = results
      .flatMap((r) => r.messages)
      .filter((m) => m.severity === 2)
      .map((m) => `Line ${m.line}: ${m.message} (${m.ruleId})`);
    return { valid: errors.length === 0, errors };
  } catch (err) {
    console.warn("  ESLint validation skipped:", String(err));
    return { valid: true, errors: [] };
  }
}

/* ───────────── Main Orchestrator ───────────── */

export interface GenerateResult {
  name: string;
  tier: Tier;
  directory: string;
  files: string[];
  warnings: string[];
}

export async function generateComponent(
  description: string,
  options?: { rootDir?: string },
): Promise<GenerateResult> {
  const root = options?.rootDir ?? ROOT;
  const tier = classifyTier(description);
  const name = extractComponentName(description);
  const warnings: string[] = [];

  // Check for similar existing components
  const registryPath = resolve(root, "src", "components", "registry.json");
  const similar = findSimilarComponents(name, registryPath);
  if (similar.length > 0) {
    warnings.push(
      `Similar component(s) already exist: ${similar.join(", ")}. Consider extending instead of creating new.`,
    );
  }

  // Create directory
  const componentDir = resolve(root, "components", tier, name);
  mkdirSync(componentDir, { recursive: true });

  // Try AI generation
  let componentContent: string | null = null;
  const apiKey = process.env["ANTHROPIC_API_KEY"];

  if (apiKey) {
    const tokenCss = existsSync(resolve(root, "src", "styles", "tokens.css"))
      ? readFileSync(resolve(root, "src", "styles", "tokens.css"), "utf-8")
          .split("\n")
          .filter((l) => l.includes("--ds-"))
          .map((l) => l.trim())
          .join("\n")
      : "";

    let registryContext = "";
    if (existsSync(registryPath)) {
      try {
        const reg = JSON.parse(readFileSync(registryPath, "utf-8"));
        registryContext = (reg.components ?? [])
          .map(
            (c: { name: string; tier: string; description: string }) =>
              `${c.name} (${c.tier}): ${c.description}`,
          )
          .join("\n");
      } catch {
        /* ignore parse errors */
      }
    }

    componentContent = await generateWithAI(
      name,
      tier,
      description,
      registryContext,
      tokenCss,
    );
  } else {
    console.log(
      "  No ANTHROPIC_API_KEY set — generating scaffold template. Set the key for AI-powered generation.",
    );
  }

  // Validate generated code against ESLint import boundary rules
  const virtualPath = resolve(componentDir, `${name}.tsx`);
  const codeToValidate = componentContent ?? generateComponentFile(name, tier, description);
  const lint = await validateWithEslint(codeToValidate, virtualPath);
  if (!lint.valid) {
    console.error("\n  ESLint validation failed — component not written.\n");
    for (const e of lint.errors) {
      console.error(`    ${e}`);
    }
    console.error(
      "\n  Fix the import boundary violations and try again.\n",
    );
    process.exit(1);
  }

  // Write files
  const files: string[] = [];

  // index.ts
  const indexPath = resolve(componentDir, "index.ts");
  writeFileSync(indexPath, generateIndexFile(name), "utf-8");
  files.push(indexPath);

  // Component file
  const componentPath = resolve(componentDir, `${name}.tsx`);
  writeFileSync(
    componentPath,
    componentContent ?? generateComponentFile(name, tier, description),
    "utf-8",
  );
  files.push(componentPath);

  // Test file
  const testPath = resolve(componentDir, `${name}.test.tsx`);
  writeFileSync(testPath, generateTestFile(name), "utf-8");
  files.push(testPath);

  // Update registry metadata
  const metaPath = resolve(root, "src", "components", "registry-meta.yaml");
  appendRegistryMeta(name, metaPath);

  return { name, tier, directory: componentDir, files, warnings };
}

/* ───────────── CLI Entry Point ───────────── */

async function main(): Promise<void> {
  const description = process.argv[2];

  if (!description) {
    console.error(
      "Usage: npm run generate -- \"description of the component\"",
    );
    process.exit(1);
  }

  console.log(`\nGenerating component from: "${description}"\n`);

  const result = await generateComponent(description);

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
    console.log();
  }

  console.log(`  Component: ${result.name}`);
  console.log(`  Tier:      ${result.tier}`);
  console.log(`  Directory: ${result.directory}`);
  console.log(`  Files:`);
  for (const f of result.files) {
    console.log(`    - ${f}`);
  }
  console.log();
  console.log("  Next steps:");
  console.log("    1. Implement the component");
  console.log("    2. Update the registry metadata in src/components/registry-meta.yaml");
  console.log("    3. Run: npm run generate:registry");
  console.log();
}

// Only run CLI when invoked directly (not when imported by tests)
const isDirectRun =
  process.argv[1]?.endsWith("generate-component.ts") ||
  process.argv[1]?.endsWith("generate-component.js");

if (isDirectRun) {
  main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
