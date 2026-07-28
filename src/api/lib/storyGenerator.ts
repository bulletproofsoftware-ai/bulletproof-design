/**
 * Generates Storybook CSF3 story files for design library templates.
 */

import * as path from "path";
import { sanitizePathParam, resolveWithin } from "./sanitize";

/**
 * Converts a kebab-case string to PascalCase.
 * Example: "my-template" → "MyTemplate"
 */
export function toPascalCase(kebab: string): string {
  const pascalName = kebab
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
  return pascalName;
}

/**
 * Converts a kebab-case string to a space-separated display name.
 * Example: "my-template" → "My Template"
 */
export function toDisplayName(kebab: string): string {
  const displayName = kebab
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
  return displayName;
}

/**
 * Generates the full CSF3 story file content for a given template.
 * The story imports the component from the templates directory,
 * sets the title to Templates/<DisplayCategory>/<DisplayName>,
 * and uses fullscreen layout.
 */
export function generateStoryContent(category: string, name: string): string {
  const pascalName = toPascalCase(name);
  const displayCategory = toDisplayName(category);
  const displayName = toDisplayName(name);

  const storyContent = `import type { Meta, StoryObj } from "@storybook/react";
import ${pascalName} from "../../../templates/${category}/${name}";

const meta: Meta<typeof ${pascalName}> = {
  title: "Templates/${displayCategory}/${displayName}",
  component: ${pascalName},
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ${pascalName}>;

export const Default: Story = {};
`;
  return storyContent;
}

/**
 * Returns the filesystem path where the story file for a template should live.
 * Pattern: <srcDir>/templates/<category>/<PascalName>.stories.tsx
 */
export function getStoryPath(
  srcDir: string,
  category: string,
  name: string
): string {
  // Sanitize inputs before using in path construction
  const safeCategory = sanitizePathParam(category);
  const safeName = sanitizePathParam(name);
  const pascalName = toPascalCase(safeName);
  // Same sibling-prefix hazard as templateWriter: startsWith(base) without a
  // trailing separator accepts "…/templates-evil". resolveWithin compares
  // against `base + path.sep`.
  resolveWithin(path.join(srcDir, "templates"), safeCategory, `${pascalName}.stories.tsx`);
  const storyPath = path.join(srcDir, "templates", safeCategory, `${pascalName}.stories.tsx`);
  return storyPath;
}
