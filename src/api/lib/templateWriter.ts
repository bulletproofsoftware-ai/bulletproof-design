import * as fs from "fs";
import * as path from "path";
import { generateStoryContent, getStoryPath } from "./storyGenerator";

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
  const categoryDir = path.resolve(TEMPLATES_DIR, category);
  if (!categoryDir.startsWith(path.resolve(TEMPLATES_DIR))) {
    throw new Error("Invalid path: directory traversal attempt");
  }
  fs.mkdirSync(categoryDir, { recursive: true });

  const templatePath = path.join(categoryDir, `${name}.tsx`);
  if (!path.resolve(templatePath).startsWith(path.resolve(TEMPLATES_DIR))) {
    throw new Error("Invalid path: directory traversal attempt");
  }
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
  const templatePath = path.resolve(TEMPLATES_DIR, category, `${name}.tsx`);
  if (!templatePath.startsWith(path.resolve(TEMPLATES_DIR))) {
    throw new Error("Invalid path: directory traversal attempt");
  }
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
