import { readFileSync, writeFileSync, statSync } from "fs";
import { resolve, extname, relative } from "path";
import { glob } from "glob";
import YAML from "yaml";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const ASSETS_DIR = resolve(ROOT, "assets");
const METADATA_PATH = resolve(ROOT, "src", "assets", "metadata.yaml");
const SCHEMA_PATH = resolve(ROOT, "src", "assets", "registry.schema.json");
const OUTPUT_PATH = resolve(ROOT, "src", "assets", "registry.json");

interface MetadataEntry {
  name: string;
  file: string;
  category: string;
  tags?: string[];
  usage?: string;
}

interface AssetEntry {
  name: string;
  file: string;
  category: string;
  format: string;
  size: string;
  tags?: string[];
  usage?: string;
  incomplete?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${parseFloat(value.toFixed(1))}${units[i]}`;
}

function deriveNameFromPath(filePath: string): string {
  // e.g., "brands/bulletproof/mark.svg" -> "bulletproof-mark"
  // e.g., "templates/avatar-placeholder.svg" -> "avatar-placeholder"
  const parts = filePath.replace(extname(filePath), "").split("/");
  if (parts.length >= 3) {
    // brands/bulletproof/mark -> bulletproof-mark
    return `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
  }
  // templates/avatar-placeholder -> avatar-placeholder
  return parts[parts.length - 1];
}

function validateSchema(data: unknown, schemaPath: string): void {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

  // Simple structural validation without external dependency
  const registry = data as { assets?: unknown[] };
  if (!registry.assets || !Array.isArray(registry.assets)) {
    throw new Error("Registry must have an 'assets' array");
  }

  const requiredFields = schema.properties.assets.items.required as string[];
  for (const entry of registry.assets) {
    const obj = entry as Record<string, unknown>;
    for (const field of requiredFields) {
      if (obj[field] === undefined || obj[field] === null) {
        throw new Error(
          `Asset "${obj.name || obj.file || "unknown"}" missing required field: ${field}`
        );
      }
    }
  }
}

async function main(): Promise<void> {
  // 1. Load metadata YAML
  const metaRaw = readFileSync(METADATA_PATH, "utf8");
  const metaDoc = YAML.parse(metaRaw) as { assets: MetadataEntry[] };
  const metaByFile = new Map<string, MetadataEntry>();
  for (const entry of metaDoc.assets) {
    metaByFile.set(entry.file, entry);
  }

  // 2. Scan all files in assets/
  const files = await glob("**/*", {
    cwd: ASSETS_DIR,
    nodir: true,
    ignore: ["**/.gitkeep"],
  });

  // 3. Build asset entries
  const assets: AssetEntry[] = files.sort().map((file) => {
    const absPath = resolve(ASSETS_DIR, file);
    const stat = statSync(absPath);
    const ext = extname(file).replace(".", "").toLowerCase();
    const meta = metaByFile.get(file);

    if (meta) {
      const entry: AssetEntry = {
        name: meta.name,
        file: meta.file,
        category: meta.category,
        format: ext,
        size: formatBytes(stat.size),
      };
      if (meta.tags) entry.tags = meta.tags;
      if (meta.usage) entry.usage = meta.usage;
      return entry;
    }

    // No metadata — flag as incomplete
    return {
      name: deriveNameFromPath(file),
      file,
      category: "unknown",
      format: ext,
      size: formatBytes(stat.size),
      incomplete: true,
    };
  });

  const registry = { assets };

  // 4. Validate against schema
  validateSchema(registry, SCHEMA_PATH);

  // 5. Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(registry, null, 2) + "\n", "utf8");
  console.log(`Asset registry generated: ${assets.length} assets -> ${relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error("Asset registry generation failed:", err);
  process.exit(1);
});
