# Design System Context

## Token System
### brand
- `primary`: #3b82f6 (color)
- `secondary`: #f1f5f9 (color)
- `accent`: #eff6ff (color)
- `accent-foreground`: #1e40af (color)
- `neutral`: #64748b (color)

### surface
- `background`: #f0f4f8 (color)
- `elevated`: #ffffff (color)
- `sunken`: #e0e4e8 (color)
- `overlay`: rgba(15, 23, 42, 0.5) (color)

### text
- `primary`: #0f172a (color)
- `secondary`: #475569 (color)
- `muted`: #64748b (color)
- `inverse`: #ffffff (color)
- `link`: #3b82f6 (color)

### border
- `default`: #e2e8f0 (color)
- `strong`: #cbd5e1 (color)
- `subtle`: #f1f5f9 (color)

### status
- `success`: #10b981 (color)
- `warning`: #f59e0b (color)
- `error`: #ef4444 (color)
- `info`: #3b82f6 (color)

### radius
- `none`: 0 (dimension)
- `soft`: 0.375rem (dimension)
- `medium`: 0.75rem (dimension)
- `full`: 9999px (dimension)

### spacing
- `xs`: 0.25rem (dimension)
- `sm`: 0.5rem (dimension)
- `md`: 1rem (dimension)
- `lg`: 1.5rem (dimension)
- `xl`: 2rem (dimension)
- `2xl`: 3rem (dimension)

### shadow
- `sm`: 0 2px 8px rgba(15, 23, 42, 0.06) (shadow)
- `md`: 0 4px 16px rgba(15, 23, 42, 0.08) (shadow)
- `lg`: 0 20px 40px rgba(15, 23, 42, 0.12) (shadow)

### motion
- `fast`: 150ms (duration)
- `normal`: 300ms (duration)
- `slow`: 500ms (duration)


## Component Inventory
### ui/ (Pristine Primitives)
- **badge** — Inline status indicator with variant styles
  - Variants: variant: default, secondary, destructive, outline, ghost, link
- **button** — Primary interactive control with multiple variants and sizes
  - Variants: variant: default, destructive, outline, secondary, ghost, link; size: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg
- **card** — Container component for grouping related content
- **command** — Command palette built on cmdk for searchable actions
  - Client component ("use client")
- **dialog** — Modal dialog overlay using Radix Dialog primitives
  - Client component ("use client")
- **dropdown-menu** — Contextual action menu using Radix DropdownMenu primitives
  - Client component ("use client")
- **input** — Text input field with consistent styling and validation states
- **scroll-area** — Custom scrollable area using Radix ScrollArea
  - Client component ("use client")
- **select** — Dropdown select component using Radix Select primitives
  - Client component ("use client")
- **separator** — Visual divider using Radix Separator
  - Client component ("use client")
- **sheet** — Slide-out panel using Radix Dialog primitives
  - Client component ("use client")
- **tabs** — Tab navigation component using Radix Tabs with CVA variants
  - Variants: variant: default, line
  - Client component ("use client")
- **tooltip** — Informational popup on hover using Radix Tooltip
  - Client component ("use client")

### primitives/ (Domain-Agnostic)
- **ColorPicker** — Color selection control with native picker and hex text input
  - Props: `label: string`, `value: string`, `onChange: (value: string) => void`
  - Client component ("use client")
- **ConfirmDialog** — Confirmation modal wrapping Dialog with confirm and cancel actions
  - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `title: string`, `description: string`, `confirmLabel: string`, `cancelLabel: string`, `variant: "default" | "destructive"`, `onConfirm: () => void`
  - Client component ("use client")
- **FontPicker** — Font selection dropdown with preset fonts and custom font entry
  - Props: `label: string`, `value: string`, `onChange: (value: string) => void`, `filter: "all" | "sans" | "serif" | "mono"`
  - Client component ("use client")
- **IconButton** — Button variant displaying only an icon with an accessible label
  - Props: `icon: LucideIcon`, `label: string`, `iconSize: number`
  - Client component ("use client")
- **TagInput** — Multi-value tag entry with keyboard support for add and remove
  - Props: `tags: string[]`, `onChange: (tags: string[]) => void`, `placeholder: string`
  - Client component ("use client")

### features/ (Product-Level)
- **AssetCard** — Card displaying an asset preview with name, size, and MIME type badge
  - Props: `name: string`, `url: string`, `size: number`, `mimeType: string`, `onClick: () => void`
  - Client component ("use client")
- **BrandCard** — Card displaying a brand identity with color swatch and description
  - Props: `name: string`, `slug: string`, `description: string`, `primaryColor: string`, `brand: Pick<BrandConfig, "colors">`, `onClick: () => void`
  - Client component ("use client")
- **Breadcrumbs** — Navigation breadcrumb trail with linked segments
  - Props: `items: BreadcrumbItem[]`
  - Client component ("use client")
- **ColorSwatch** — Individual brand color specimen with hex, RGB, and role metadata
  - Props: `name: string`, `hex: string`, `rgb: [number, number, number]`
  - Client component ("use client")
- **ComponentSpecViewer** — Combined spec viewer (props, variants, examples, playground) for a single component
  - Client component ("use client")
- **Playground** — Client-side JSX sandbox that transpiles user code with Babel standalone and renders a live preview
  - Props: `componentName: string`, `initialCode: string`
  - Client component ("use client")
- **VariantsGallery** — Grid of rendered variant combinations for a component, driven by the registry spec
  - Props: `componentName: string`, `variants: ComponentSpec["variants"]`
  - Client component ("use client")
- **LivePreview** — Iframe-based live preview panel with refresh control
  - Props: `url: string`, `className: string`
  - Client component ("use client")
- **LogoLockupCard** — Preview card for a brand logo variant with label, usage note, and download action
  - Props: `url: string`, `label: string`, `usage: string`, `preferred: boolean`, `downloadName: string`
- **MonacoEditor** — Monaco code editor wrapper with dark theme and sensible defaults
  - Props: `value: string`, `onChange: (value: string) => void`, `language: string`, `height: string`
  - Client component ("use client")
- **Nav** — Top navigation bar with route links and command palette trigger
  - Client component ("use client")
- **PortalBreadcrumbs** — Breadcrumb trail for brand portal pages with the current page as the final non-link item
  - Props: `items: PortalBreadcrumbItem[]`
- **PortalSidebar** — Collapsible sidebar for brand portal layouts with section groups and active-route highlighting
  - Props: `slug: string`, `brandName: string`, `brandInitial: string`, `brandInitialColor: string`, `extraSections: Array<{ title: string`
  - Client component ("use client")
- **PortalTopNav** — Top-level navigation bar for brand portal pages with Design Library section links and active-state indicator
  - Props: `activeSection: PortalTopNavSection`
- **SanitisedHtml** — Server component that renders pre-sanitised HTML (already run through sanitize-html)
  - Props: `html: string`, `className: string`
- **SearchCommand** — Command palette for searching templates and brands with Cmd+K shortcut
  - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`
  - Client component ("use client")
- **Sidebar** — Collapsible sidebar navigation with sections, search, and category counts
  - Client component ("use client")
- **TemplateCard** — Card displaying a template with name, description, category badge, and tags
  - Props: `name: string`, `description: string`, `category: string`, `tags: string[]`, `onClick: () => void`, `className: string`
- **TypeSpecimen** — Typography specimen row showing family, weight, size, line-height, and a sample string
  - Props: `label: string`, `sample: string`, `family: string`, `size: string`, `lineHeight: string`, `weight: number | string`

### effects/ (Animated/Marketing)
None yet.


## Asset Inventory

### placeholder
- **avatar-placeholder** — Default avatar when user has no profile image (svg, 293B)
- **card-image-placeholder** — Default card image placeholder (svg, 391B)
- **hero-placeholder** — Default hero section placeholder (svg, 600B)
- **logo-placeholder** — Default logo placeholder (svg, 506B)
- **product-placeholder** — Default product image placeholder (svg, 446B)


## Import Rules
- **ui**: External packages only
- **primitives**: ui/, external packages
- **features**: primitives/, ui/, external packages. Cannot import from other features.
- **effects**: ui/, external packages

## Usage Examples

### badge
**Default badge:**
```tsx
<Badge>New</Badge>
```

### button
**Default button:**
```tsx
<Button>Click me</Button>
```
**Destructive button:**
```tsx
<Button variant="destructive">Delete</Button>
```

### card
**Basic card:**
```tsx
<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent>Content</CardContent></Card>
```

### command
**Command dialog:**
```tsx
<CommandDialog><CommandInput placeholder="Search..." /><CommandList><CommandEmpty>No results</CommandEmpty></CommandList></CommandDialog>
```

### dialog
**Basic dialog:**
```tsx
<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogTitle>Title</DialogTitle></DialogContent></Dialog>
```

### dropdown-menu
**Basic menu:**
```tsx
<DropdownMenu><DropdownMenuTrigger>Open</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Action</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
```

### input
**Default input:**
```tsx
<Input placeholder="Enter text..." />
```

### scroll-area
**Scrollable container:**
```tsx
<ScrollArea className="h-48"><div>Long content...</div></ScrollArea>
```

### select
**Basic select:**
```tsx
<Select><SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger><SelectContent><SelectItem value="a">Option A</SelectItem></SelectContent></Select>
```

### separator
**Horizontal separator:**
```tsx
<Separator />
```

### sheet
**Right sheet:**
```tsx
<Sheet><SheetTrigger>Open</SheetTrigger><SheetContent>Panel content</SheetContent></Sheet>
```

### tabs
**Basic tabs:**
```tsx
<Tabs defaultValue="a"><TabsList><TabsTrigger value="a">Tab A</TabsTrigger></TabsList><TabsContent value="a">Content A</TabsContent></Tabs>
```

### tooltip
**Basic tooltip:**
```tsx
<TooltipProvider><Tooltip><TooltipTrigger>Hover</TooltipTrigger><TooltipContent>Info</TooltipContent></Tooltip></TooltipProvider>
```

### ColorPicker
**Basic color picker:**
```tsx
<ColorPicker label="Primary" value="#3b82f6" onChange={setValue} />
```

### ConfirmDialog
**Delete confirmation:**
```tsx
<ConfirmDialog open={open} onOpenChange={setOpen} title="Delete?" description="This action cannot be undone." variant="destructive" onConfirm={handleDelete} />
```

### FontPicker
**Basic font picker:**
```tsx
<FontPicker label="Heading" value="Inter" onChange={setFont} />
```

### IconButton
**Settings icon button:**
```tsx
<IconButton icon={Settings} label="Settings" />
```

### TagInput
**Basic tag input:**
```tsx
<TagInput tags={tags} onChange={setTags} placeholder="Add tag..." />
```

### AssetCard
**SVG asset:**
```tsx
<AssetCard name="logo.svg" url="/assets/logo.svg" size={1024} mimeType="image/svg+xml" />
```

### BrandCard
**Brand card:**
```tsx
<BrandCard name="Acme" slug="acme" description="Corporate identity" primaryColor="#3b82f6" />
```

### Breadcrumbs
**Basic breadcrumbs:**
```tsx
<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Templates" }]} />
```

### ColorSwatch
**Primary swatch:**
```tsx
<ColorSwatch name="Brand Primary" hex="#0057B8" rgb={[0, 87, 184]} />
```

### ComponentSpecViewer
**View Button spec:**
```tsx
<ComponentSpecViewer componentName="Button" />
```

### Playground
**Button playground:**
```tsx
<Playground componentName="Button" initialCode="<Button>Click</Button>" />
```

### VariantsGallery
**Button variants:**
```tsx
<VariantsGallery componentName="Button" variants={spec.variants} />
```

### LivePreview
**Template preview:**
```tsx
<LivePreview url="/preview/template-1" />
```

### LogoLockupCard
**Horizontal lockup:**
```tsx
<LogoLockupCard url="/brand-assets/acme/horizontal.svg" label="Horizontal" usage="Primary lockup" preferred downloadName="acme-horizontal.svg" />
```

### MonacoEditor
**TypeScript editor:**
```tsx
<MonacoEditor value={code} onChange={setCode} language="typescript" />
```

### Nav
**Navigation bar:**
```tsx
<Nav />
```

### PortalBreadcrumbs
**Portal breadcrumb:**
```tsx
<PortalBreadcrumbs items={[{ label: "Acme", href: "/portal/acme" }, { label: "Colors" }]} />
```

### PortalSidebar
**Brand portal sidebar:**
```tsx
<PortalSidebar slug="acme" brandName="Acme Corp" brandInitial="A" brandInitialColor="#0057B8" />
```

### PortalTopNav
**Brands section active:**
```tsx
<PortalTopNav activeSection="brands" />
```

### SanitisedHtml
**Guidelines section body:**
```tsx
<SanitisedHtml html={section.html} className="prose" />
```

### SearchCommand
**Search command:**
```tsx
<SearchCommand open={open} onOpenChange={setOpen} />
```

### Sidebar
**Sidebar navigation:**
```tsx
<Sidebar />
```

### TemplateCard
**Template card:**
```tsx
<TemplateCard name="Hero Section" category="landing" tags={["hero", "cta"]} />
```

### TypeSpecimen
**Heading specimen:**
```tsx
<TypeSpecimen label="H1" sample="The quick brown fox" family="Inter" size="2.25rem" lineHeight="1.2" weight={700} />
```

