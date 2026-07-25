import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, relative, basename, extname } from "path";
import { glob } from "glob";
import YAML from "yaml";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const COMPONENTS_DIR = resolve(ROOT, "components");
const METADATA_PATH = resolve(ROOT, "src", "components", "registry-meta.yaml");
const SCHEMA_PATH = resolve(ROOT, "src", "components", "registry.schema.json");
const OUTPUT_PATH = resolve(ROOT, "src", "components", "registry.json");

const TIERS = ["ui", "primitives", "features", "effects"] as const;
type Tier = (typeof TIERS)[number];

interface PropEntry {
  name: string;
  type: string;
  optional?: boolean;
  default?: string;
  description?: string;
}

interface MetaEntry {
  name: string;
  tier: Tier;
  description?: string;
  examples?: Array<{ label: string; code: string }>;
  accessibility?: {
    role?: string;
    keyboard?: string[];
    notes?: string;
  };
  guidelines?: {
    when?: string;
    avoid?: string;
  };
}

interface ComponentEntry {
  name: string;
  tier: Tier;
  path: string;
  client: boolean;
  description?: string;
  props?: PropEntry[];
  variants?: Record<string, string[]>;
  dependencies?: string[];
  examples?: Array<{ label: string; code: string }>;
  accessibility?: {
    role?: string;
    keyboard?: string[];
    notes?: string;
  };
  guidelines?: {
    when?: string;
    avoid?: string;
  };
  incomplete?: boolean;
}

/**
 * Extract exported interface/type Props from file content.
 * Best-effort regex — not a full AST parser.
 */
function extractProps(content: string): PropEntry[] {
  const props: PropEntry[] = [];

  // Match interface FooProps { ... } blocks (supports one level of nested braces)
  const interfaceRegex = /interface\s+\w*Props[^{]*\{([^}]*(?:\{[^}]*\}[^}]*){0,10})\}/g;
  let match: RegExpExecArray | null;

  while ((match = interfaceRegex.exec(content)) !== null) {
    const body = match[1];
    // Match property lines like:  name: string;  or  name?: string;
    const propRegex = /^\s*(\w+)(\??):\s*([^;]+);/gm;
    let propMatch: RegExpExecArray | null;
    while ((propMatch = propRegex.exec(body)) !== null) {
      const propName = propMatch[1];
      const isOptional = propMatch[2] === "?";
      let propType = propMatch[3].trim();
      // Clean up multiline types
      propType = propType.replace(/\s+/g, " ");
      const entry: PropEntry = { name: propName, type: propType };
      if (isOptional) entry.optional = true;
      props.push(entry);
    }
  }

  // Destructured parameter defaults, e.g.
  //   export function TagInput({ tags, onChange, placeholder = "Add tag..." }: TagInputProps)
  // The raw default expression text (including quotes) is captured.
  const destructureRegex = /function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*:/;
  const destructureMatch = destructureRegex.exec(content);
  if (destructureMatch) {
    const paramBody = destructureMatch[1];
    const defaultRegex = /(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,}]+)/g;
    let defMatch: RegExpExecArray | null;
    while ((defMatch = defaultRegex.exec(paramBody)) !== null) {
      const prop = props.find((p) => p.name === defMatch![1]);
      if (prop && prop.default === undefined) {
        prop.default = defMatch[2].trim().replace(/'/g, '"');
      }
    }
  }

  return props;
}

/**
 * Extract CVA variant keys and their values.
 * Parses the defaultVariants object for variant group names,
 * then extracts keys from each variant group.
 */
function extractVariants(content: string): Record<string, string[]> | undefined {
  const variants: Record<string, string[]> = {};

  // First find defaultVariants to know which groups exist
  const defaultsRegex = /defaultVariants:\s*\{([^}]+)\}/;
  const defaultsMatch = defaultsRegex.exec(content);
  if (!defaultsMatch) return undefined;

  // Extract group names from defaultVariants
  const groupNames: string[] = [];
  const groupNameRegex = /(\w+):\s*["']/g;
  let gnMatch: RegExpExecArray | null;
  while ((gnMatch = groupNameRegex.exec(defaultsMatch[1])) !== null) {
    groupNames.push(gnMatch[1]);
  }

  if (groupNames.length === 0) return undefined;

  // For each group, find its definition block and extract keys
  // Pattern: groupName: { key: "value", ... }
  // The keys are at the start of lines (with indentation) followed by : and a string/template
  for (const groupName of groupNames) {
    // Match the specific variant group block
    const groupRegex = new RegExp(
      `${groupName}:\\s*\\{([\\s\\S]*?)\\}`,
      "g"
    );
    // Find the match within the variants section (not defaultVariants)
    const variantsSectionRegex = /variants:\s*\{([\s\S]*?)defaultVariants/;
    const sectionMatch = variantsSectionRegex.exec(content);
    if (!sectionMatch) continue;

    const section = sectionMatch[1];
    const groupMatch = groupRegex.exec(section);
    if (!groupMatch) continue;

    const groupBody = groupMatch[1];
    const keys: string[] = [];
    // Match lines like:  default: "...",  or  "icon-sm": "...",
    // Key must be followed by colon then whitespace and a string/template literal
    const keyRegex = /^\s+["']?([\w][\w-]*)["']?\s*:\s*(?:["'`\n])/gm;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = keyRegex.exec(groupBody)) !== null) {
      keys.push(keyMatch[1]);
    }
    if (keys.length > 0) {
      variants[groupName] = keys;
    }
  }

  return Object.keys(variants).length > 0 ? variants : undefined;
}

/**
 * Extract external package dependencies from import statements.
 */
function extractDependencies(content: string): string[] {
  const deps = new Set<string>();
  const importRegex = /(?:import|from)\s+["']([^"'.][^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const mod = match[1];
    // Skip relative imports and @/ alias imports
    if (mod.startsWith(".") || mod.startsWith("@/")) continue;
    // Get package name (handle scoped packages)
    const parts = mod.split("/");
    const pkgName = mod.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
    deps.add(pkgName);
  }
  return Array.from(deps).sort();
}

function validateSchema(data: unknown, schemaPath: string): void {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const registry = data as { components?: unknown[] };
  if (!registry.components || !Array.isArray(registry.components)) {
    throw new Error("Registry must have a 'components' array");
  }

  const requiredFields = schema.properties.components.items.required as string[];
  const validTiers = schema.properties.components.items.properties.tier.enum as string[];

  for (const entry of registry.components) {
    const obj = entry as Record<string, unknown>;
    for (const field of requiredFields) {
      if (obj[field] === undefined || obj[field] === null) {
        throw new Error(
          `Component "${obj.name || obj.path || "unknown"}" missing required field: ${field}`
        );
      }
    }
    if (!validTiers.includes(obj.tier as string)) {
      throw new Error(
        `Component "${obj.name}" has invalid tier: ${obj.tier}`
      );
    }
  }
}

async function main(): Promise<void> {
  // 1. Load metadata YAML
  const metaRaw = readFileSync(METADATA_PATH, "utf8");
  const metaDoc = YAML.parse(metaRaw) as { components: MetaEntry[] };
  const metaByName = new Map<string, MetaEntry>();
  for (const entry of metaDoc.components) {
    // Store by normalized key: lowercase, no hyphens (for case/hyphen-insensitive lookup)
    const key = entry.name.toLowerCase().replace(/-/g, "");
    metaByName.set(key, entry);
  }

  // 2. Scan component files
  const components: ComponentEntry[] = [];

  for (const tier of TIERS) {
    const tierDir = resolve(COMPONENTS_DIR, tier);
    if (!existsSync(tierDir)) continue;

    const files = await glob("**/*.tsx", {
      cwd: tierDir,
      nodir: true,
      ignore: ["**/index.ts", "**/index.tsx"],
    });

    for (const file of files.sort()) {
      const absPath = resolve(tierDir, file);
      const content = readFileSync(absPath, "utf8");
      const componentName = basename(file, extname(file));
      const relPath = `components/${tier}/${file}`;

      const isClient = content.trimStart().startsWith('"use client"') ||
                        content.trimStart().startsWith("'use client'");

      const props = extractProps(content);
      const variants = extractVariants(content);
      const dependencies = extractDependencies(content);

      const meta = metaByName.get(componentName.toLowerCase().replace(/-/g, ""));

      const entry: ComponentEntry = {
        name: componentName,
        tier: tier as Tier,
        path: relPath,
        client: isClient,
      };

      if (meta?.description) entry.description = meta.description;
      if (props.length > 0) entry.props = props;
      if (variants) entry.variants = variants;
      if (dependencies.length > 0) entry.dependencies = dependencies;
      if (meta?.examples) entry.examples = meta.examples;
      if (meta?.accessibility) entry.accessibility = meta.accessibility;
      if (meta?.guidelines) entry.guidelines = meta.guidelines;
      if (!meta) entry.incomplete = true;

      components.push(entry);
    }
  }

  const registry = { components };

  // 3. Validate
  validateSchema(registry, SCHEMA_PATH);

  // 4. Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(registry, null, 2) + "\n", "utf8");
  console.log(`Component registry generated: ${components.length} components -> ${relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error("Component registry generation failed:", err);
  process.exit(1);
});
