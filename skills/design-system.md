---
name: design-system
description: Guides component creation, styling, and architecture within the four-tier design system. Use when creating components, building UI, adding pages, styling elements, or working with design tokens.
---

# Design System Guide

This project uses a four-tier component architecture with a semantic design token system. Follow these rules for ALL UI work.

## Architecture

Components are organized in four tiers under `components/`:

| Tier | Directory | Purpose | Can Import From |
|------|-----------|---------|-----------------|
| 1 | `ui/` | Pristine shadcn/ui primitives | External packages only |
| 2 | `primitives/` | Domain-agnostic compositions | `ui/`, external packages |
| 3 | `features/` | Product-level compositions | `primitives/`, `ui/`, external packages |
| 4 | `effects/` | Animated/marketing components | `ui/`, external packages |

**Rules:**
- `ui/` components are managed by shadcn CLI — never edit them directly
- `features/` components cannot import from other `features/` directories
- Each component in tiers 2-4 lives in its own directory: `{Tier}/{PascalName}/{PascalName}.tsx` + `index.ts`

## Before Creating a Component

**MANDATORY: Check if it already exists.**

Use the MCP server tools (available as `design-system` MCP):
1. Call `search_components` with your component description to find existing matches
2. Call `get_component` to inspect a specific component's props and usage examples
3. Call `get_composition_rules` for the target tier to confirm import rules

If a suitable component exists, compose with it instead of creating a new one.

## Creating a New Component

Use the scaffold generator:
```bash
npm run generate -- "description of your component"
```

This creates the directory structure, component file, test file, and registry entry.

If creating manually, every new component MUST have:
1. A directory under the correct tier
2. An `index.ts` re-export
3. A `ComponentName.test.tsx` with a `jest-axe` accessibility test
4. An entry in `src/components/registry-meta.yaml`

## Design Tokens

Use semantic design tokens — NEVER hardcode colors, spacing, or radii.

```tsx
// WRONG
<div style={{ color: "#3b82f6", padding: "1rem" }}>

// WRONG
<div className="text-blue-500 p-4">

// RIGHT
<div className="text-[var(--ds-brand-primary)] p-[var(--ds-spacing-md)]">
```

Call `get_tokens` via MCP to discover available tokens by category:
- `brand`: primary, secondary, accent, neutral
- `surface`: background, elevated, sunken, overlay
- `text`: primary, secondary, muted, inverse, link
- `border`: default, strong, subtle
- `status`: success, warning, error, info
- `radius`: none, soft, medium, full
- `spacing`: xs, sm, md, lg, xl, 2xl
- `shadow`: sm, md, lg
- `motion`: fast, normal, slow

Three themes available: `light` (default), `dark`, `high-contrast`.

## Accessibility

Every component in `primitives/` and `features/` MUST include an axe-core test:

```tsx
/**
 * @jest-environment jsdom
 */
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { MyComponent } from "./index";

expect.extend(toHaveNoViolations);

test("has no accessibility violations", async () => {
  const { container } = render(<MyComponent />);
  expect(await axe(container)).toHaveNoViolations();
});
```

## After Creating/Modifying Components

Run `npm run generate:registry` to update the component registry.

## Subagent Instructions

When dispatching subagents for UI work, include this context:

> This project uses a four-tier design system with an MCP server at `design-system`. Before creating or modifying any component, call `search_components` to check existing inventory and `get_tokens` for available design tokens. Follow the composition rules for the target tier. All components require axe-core accessibility tests.
