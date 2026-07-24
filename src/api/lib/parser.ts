import * as fs from "fs";
import * as path from "path";

export interface TemplateMeta {
  category: string;
  name: string;
  description: string;
  tags: string[];
  source: string;
}

export interface ParsedTemplate {
  meta: TemplateMeta;
  sourceCode: string;
  filePath: string;
}

/**
 * Extracts @meta YAML frontmatter from a JSDoc comment block in a .tsx file.
 *
 * Expected format:
 * /**
 *  * @meta
 *  * category: dashboards
 *  * name: analytics-dashboard
 *  * description: Analytics dashboard with chart widgets
 *  * tags: [dashboard, charts, analytics]
 *  * source: generated
 *  *\/
 */
export function parseTemplate(filePath: string): ParsedTemplate | null {
  let sourceCode: string;
  try {
    sourceCode = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const metaBlockRegex = /\/\*\*[\s\S]*?@meta\s*\n([\s\S]*?)\*\//;
  const match = sourceCode.match(metaBlockRegex);

  if (!match) {
    return null;
  }

  const rawYaml = match[1];
  const meta = parseYamlBlock(rawYaml);

  if (!meta.category || !meta.name) {
    return null;
  }

  return {
    meta: {
      category: meta.category,
      name: meta.name,
      description: meta.description || "",
      tags: meta.tags || [],
      source: meta.source || "unknown",
    },
    sourceCode,
    filePath: path.resolve(filePath),
  };
}

/**
 * Parses a simplified YAML block extracted from JSDoc comments.
 * Each line has the format: " * key: value" or " * key: [item1, item2]"
 */
function parseYamlBlock(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = raw.split("\n");

  for (const line of lines) {
    // Strip leading whitespace, asterisks, and trailing whitespace
    const cleaned = line.replace(/^\s*\*?\s*/, "").trim();
    if (!cleaned || cleaned.startsWith("@")) {
      continue;
    }

    const colonIndex = cleaned.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = cleaned.substring(0, colonIndex).trim();
    let value = cleaned.substring(colonIndex + 1).trim();

    if (!key) {
      continue;
    }

    // Handle array notation: [item1, item2, item3]
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1);
      result[key] = inner
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    } else {
      result[key] = value;
    }
  }

  return result;
}
