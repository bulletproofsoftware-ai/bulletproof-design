import * as fs from "fs";
import * as path from "path";
import { generateStoryContent, getStoryPath } from "./storyGenerator";
import { resolveWithin } from "./sanitize";

const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? "./templates";
const SRC_DIR = process.env.SRC_DIR ?? "./src";

export interface WriteTemplateResult {
  templatePath: string;
  storyPath: string;
}

/**
 * Writes a template .tsx file and its auto-generated Storybook story wrapper.
 * Creates the category subdirectory under TEMPLATES_DIR if it does not exist.
 * Returns the paths of both written files.
 */
export function writeTemplate(
  category: string,
  name: string,
  sourceCode: string
): WriteTemplateResult {
  // resolveWithin compares against `root + path.sep`. A bare
  // startsWith(root) also accepts a *sibling* whose name merely begins with
  // the root's — "templates-evil" satisfies startsWith("…/templates") — so the
  // old check would have let a category of "../templates-evil" through.
  // Unreachable today because every caller passes sanitizePathParam output,
  // which rejects "/" and "..", but the guard should not depend on that.
  const categoryDir = resolveWithin(TEMPLATES_DIR, category);
  fs.mkdirSync(categoryDir, { recursive: true });

  const templatePath = resolveWithin(TEMPLATES_DIR, category, `${name}.tsx`);
  fs.writeFileSync(templatePath, sourceCode, "utf-8");

  const storyContent = generateStoryContent(category, name);
  const storyPath = getStoryPath(SRC_DIR, category, name);

  // Ensure the story target directory exists (mirrors the templates structure
  // inside src/templates/<category>/).
  const storyDir = path.dirname(storyPath);
  fs.mkdirSync(storyDir, { recursive: true });

  fs.writeFileSync(storyPath, storyContent, "utf-8");

  return { templatePath, storyPath };
}

/**
 * Deletes a template .tsx file and its accompanying .stories.tsx file.
 * Returns true if both files were removed, false if either did not exist.
 */
export function deleteTemplate(category: string, name: string): boolean {
  const templatePath = resolveWithin(TEMPLATES_DIR, category, `${name}.tsx`);
  const storyPath = getStoryPath(SRC_DIR, category, name);

  let allDeleted = true;

  for (const filePath of [templatePath, storyPath]) {
    try {
      fs.unlinkSync(filePath);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        allDeleted = false;
      } else {
        throw err;
      }
    }
  }

  return allDeleted;
}
