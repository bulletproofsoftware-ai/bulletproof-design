import * as fs from "fs";
import * as path from "path";
import { parseTemplate, ParsedTemplate } from "./parser";

let templates: ParsedTemplate[] = [];
let watcher: fs.FSWatcher | null = null;

const MAX_SCAN_DEPTH = 10;

/**
 * Recursively collects all .tsx files from a directory tree.
 * Depth is bounded to prevent runaway traversal of deeply nested or symlinked trees.
 */
function collectTsxFiles(dir: string, depth: number = 0): string[] {
  if (depth > MAX_SCAN_DEPTH) return [];
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(fullPath, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Builds the in-memory template index by scanning a directory for .tsx files
 * containing @meta YAML frontmatter. Sets up a file watcher to detect new
 * or changed templates without requiring a restart.
 */
export function buildIndex(dir: string): void {
  const resolvedDir = path.resolve(dir);

  // Parse all .tsx files in the directory tree
  const files = collectTsxFiles(resolvedDir);
  templates = [];

  for (const file of files) {
    const parsed = parseTemplate(file);
    if (parsed) {
      templates.push(parsed);
    }
  }

  console.log(
    `[templateIndex] Indexed ${templates.length} templates from ${files.length} .tsx files in ${resolvedDir}`
  );

  // Close any existing watcher before creating a new one
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  // Watch for changes — rebuild on any file system event
  try {
    watcher = fs.watch(resolvedDir, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith(".tsx")) {
        console.log(
          `[templateIndex] Detected ${eventType} on ${filename}, rebuilding index...`
        );
        // Rebuild the full index on any .tsx change
        const freshFiles = collectTsxFiles(resolvedDir);
        const freshTemplates: ParsedTemplate[] = [];
        for (const file of freshFiles) {
          const parsed = parseTemplate(file);
          if (parsed) {
            freshTemplates.push(parsed);
          }
        }
        templates = freshTemplates;
        console.log(
          `[templateIndex] Re-indexed ${templates.length} templates`
        );
      }
    });
  } catch (err) {
    console.warn(
      `[templateIndex] Could not set up file watcher for ${resolvedDir}:`,
      err
    );
  }
}

/**
 * Returns all indexed templates.
 */
export function getTemplates(): ParsedTemplate[] {
  return templates;
}

/**
 * Returns unique category names with their template counts.
 */
export function getCategories(): Array<{ name: string; count: number }> {
  const categoryMap = new Map<string, number>();

  for (const t of templates) {
    const current = categoryMap.get(t.meta.category) || 0;
    categoryMap.set(t.meta.category, current + 1);
  }

  const categories = Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return categories;
}

/**
 * Returns all templates in a given category.
 */
export function getByCategory(category: string): ParsedTemplate[] {
  const matched = templates.filter(
    (t) => t.meta.category.toLowerCase() === category.toLowerCase()
  );
  return matched;
}

/**
 * Finds a specific template by category and name.
 */
export function getByName(
  category: string,
  name: string
): ParsedTemplate | undefined {
  const found = templates.find(
    (t) =>
      t.meta.category.toLowerCase() === category.toLowerCase() &&
      t.meta.name.toLowerCase() === name.toLowerCase()
  );
  return found;
}

/**
 * Searches templates across name, description, tags, and category fields.
 * Returns templates where any field contains the query string (case-insensitive).
 */
export function search(query: string): ParsedTemplate[] {
  const q = query.toLowerCase().trim();
  if (!q) {
    return [];
  }

  return templates.filter((t) => {
    const fields = [
      t.meta.name,
      t.meta.description,
      t.meta.category,
      ...t.meta.tags,
    ];
    return fields.some((field) => field.toLowerCase().includes(q));
  });
}
