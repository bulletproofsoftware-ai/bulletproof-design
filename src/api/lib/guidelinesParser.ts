/**
 * Brand guidelines parser (SPEC-002).
 *
 * Parses `brands/<slug>/guidelines.md` — YAML frontmatter + Markdown body —
 * into a structured `ParsedGuidelines` object with a list of top-level
 * sections, each with `title`, rendered HTML `body`, raw `bodyMarkdown`, and
 * extracted Do / Don't lists.
 *
 * **Design goals:**
 *   - **Tolerant**: never throws on empty, malformed, or partially-valid
 *     input. Instead, push a string into `warnings` and continue with the
 *     best-effort parse.
 *   - **Deterministic**: fixed markdown-it configuration and a strict
 *     sanitize-html allowlist — same input always yields the same output.
 *   - **XSS-safe (CISO F-GUIDE-01)**: all rendered HTML passes through
 *     `sanitize-html` with an explicit allowlist. `markdown-it`'s `html:false`
 *     flag is insufficient on its own because the renderer still emits
 *     `<a href="javascript:...">` from Markdown anchor syntax; sanitization
 *     runs *after* rendering.
 *
 * BRD requirements covered: REQ-006, REQ-007, REQ-077.
 * CISO requirement covered: F-GUIDE-01 (post-render HTML sanitization).
 */

import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import slugifyLib from "slugify";

// Re-export the shared types so existing Express callers keep working with
// `import { ParsedGuidelines } from '../lib/guidelinesParser'`. Next.js code
// should import from `@/lib/types/api` directly (tsconfig excludes src/api).
export type { GuidelinesSection, ParsedGuidelines } from "../../../lib/types/api";

import type {
  GuidelinesSection,
  ParsedGuidelines,
} from "../../../lib/types/api";

// ────────────────────────────────────────────────────────────────────────
// Renderer + sanitizer configuration (module-level, deterministic)
// ────────────────────────────────────────────────────────────────────────

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

/**
 * Sanitize-html options — strict allowlist per SPEC-002 "Implementation
 * Details" and CISO F-GUIDE-01.
 *
 * We do NOT allow: `script`, `iframe`, `object`, `embed`, `form`, `input`,
 * `button`, `style`, `link`, `meta`, `svg`, `foreignObject`, or any `on*`
 * event-handler attribute.
 *
 * Allowed URL schemes on anchors: http, https, mailto. Relative URLs are
 * permitted (sanitize-html's default). `javascript:`, `vbscript:`, `file:`,
 * and `data:` (on anchors) are blocked.
 *
 * Allowed URL schemes on `<img src>`: http, https, and `data:image/*`
 * (ensured via `allowedSchemesByTag.img` + a custom `transformTags` check).
 */
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  // Explicit allowlist — anything not listed is stripped.
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "a",
    "ul", "ol", "li",
    "strong", "em", "b", "i", "code", "pre",
    "blockquote",
    "img",
    "br", "hr",
    // Inline formatting kept narrow — no `span`, no `div`.
  ],
  allowedAttributes: {
    a: ["href", "title", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    // No other tag allows any attribute — `on*` handlers are impossible.
  },
  // Anchor URL schemes. `data:` intentionally omitted here so
  // `<a href="data:text/html,...">` is stripped; images get their own list.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  // Only permit `data:image/*` on <img src>; reject `data:text/html`, etc.
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  // Normalise anchors and images.
  transformTags: {
    a: (tagName, attribs) => {
      const safeAttribs: Record<string, string> = {};
      if (typeof attribs.href === "string") {
        safeAttribs.href = attribs.href;
        // Add rel="noopener noreferrer" on any anchor with an absolute URL.
        if (/^https?:/i.test(attribs.href)) {
          safeAttribs.rel = "noopener noreferrer";
        }
      }
      if (typeof attribs.title === "string") safeAttribs.title = attribs.title;
      return { tagName, attribs: safeAttribs };
    },
    img: (tagName, attribs) => {
      const src = typeof attribs.src === "string" ? attribs.src : "";
      // Reject any `data:` URI that is not an image/* type. sanitize-html's
      // scheme allowlist lets `data:` through for img, but we need finer
      // control on the MIME prefix.
      if (src.startsWith("data:") && !src.startsWith("data:image/")) {
        // Strip src entirely — sanitize-html will drop the attribute and the
        // tag becomes `<img alt="...">`, which is harmless.
        const { src: _drop, ...rest } = attribs;
        void _drop;
        return { tagName, attribs: rest };
      }
      return { tagName, attribs };
    },
  },
  // Keep unknown/unlisted tags stripped (default). Text content preserved.
  disallowedTagsMode: "discard",
  allowProtocolRelative: false,
  enforceHtmlBoundary: false,
};

/**
 * Render a Markdown string to a sanitized HTML string. Always runs the
 * sanitizer, even on empty input, so the return type is guaranteed HTML.
 */
function renderSafeHtml(markdown: string): string {
  const raw = md.render(markdown);
  return sanitizeHtml(raw, SANITIZE_OPTS);
}

// ────────────────────────────────────────────────────────────────────────
// Slug helpers
// ────────────────────────────────────────────────────────────────────────

// `slugify` v1 exports a default function; depending on interop we may get
// it as `.default`. Normalise once.
const slugify: (s: string, opts?: Record<string, unknown>) => string =
  typeof slugifyLib === "function"
    ? (slugifyLib as unknown as (s: string, opts?: Record<string, unknown>) => string)
    : (slugifyLib as { default: (s: string, opts?: Record<string, unknown>) => string }).default;

function slugFromTitle(title: string): string {
  const s = slugify(title, { lower: true, strict: true });
  return s.length > 0 ? s : "section";
}

// ────────────────────────────────────────────────────────────────────────
// Section extraction
// ────────────────────────────────────────────────────────────────────────

/**
 * Split a Markdown body into raw chunks keyed by their H2 heading.
 *
 * Matches `^## Title\n` at the start of a line (not inside code fences).
 * Code-fence awareness keeps triple-backtick blocks that happen to contain
 * a `## ` line from being mis-split.
 *
 * Returns `[{ title, content }]` where `content` is everything after the
 * H2 line up to (but not including) the next H2.
 */
function splitByH2(body: string): Array<{ title: string; content: string }> {
  const lines = body.split(/\r?\n/);
  const sections: Array<{ title: string; content: string }> = [];
  let current: { title: string; content: string[] } | null = null;
  let inFence = false;

  for (const line of lines) {
    // Toggle fence state on any line that begins with ``` or ~~~.
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
    }
    const h2Match = !inFence ? /^##\s+(.+?)\s*$/.exec(line) : null;
    if (h2Match && h2Match[1]) {
      // Flush the previous section.
      if (current) {
        sections.push({
          title: current.title,
          content: current.content.join("\n").trim(),
        });
      }
      current = { title: h2Match[1].trim(), content: [] };
    } else if (current) {
      current.content.push(line);
    }
    // Lines before any H2 are discarded — they are typically intro prose
    // handled upstream when no H2 exists at all.
  }
  if (current) {
    sections.push({
      title: current.title,
      content: current.content.join("\n").trim(),
    });
  }
  return sections;
}

/**
 * From a section's raw Markdown, extract the Do and Don't lists if present
 * and return the remaining body (with those H3 lists removed).
 *
 * Recognised headings (case-insensitive): `### Do`, `### Do's`, `### Dos`,
 * `### Don't`, `### Donts`, `### Dont`, `### Do Not`.
 */
function extractDosDonts(sectionMd: string): {
  body: string;
  dos: string[];
  donts: string[];
} {
  const lines = sectionMd.split(/\r?\n/);
  const out: string[] = [];
  const dos: string[] = [];
  const donts: string[] = [];

  type Bucket = "dos" | "donts" | null;
  let bucket: Bucket = null;
  let inFence = false;

  const doRe = /^###\s+(?:do'?s?|do's)\s*$/i;
  const dontRe = /^###\s+(?:don'?t|don'?ts?|do\s+not)\s*$/i;
  const h3Re = /^###\s+/;
  const listItemRe = /^\s*[-*+]\s+(.*)$/;

  for (const line of lines) {
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      // Fenced code in a section is never part of a do/don't list.
      if (bucket !== null) bucket = null;
      out.push(line);
      continue;
    }
    if (!inFence && doRe.test(line)) {
      bucket = "dos";
      continue; // drop the heading from the residual body
    }
    if (!inFence && dontRe.test(line)) {
      bucket = "donts";
      continue;
    }
    if (!inFence && h3Re.test(line) && bucket !== null) {
      // A different H3 breaks out of the do/don't bucket; the heading itself
      // stays in the body.
      bucket = null;
      out.push(line);
      continue;
    }

    if (bucket !== null) {
      const m = listItemRe.exec(line);
      if (m && m[1]) {
        const item = m[1].trim();
        if (bucket === "dos") dos.push(item);
        else donts.push(item);
      } else if (line.trim() === "") {
        // Blank line inside a bucket — keep the bucket open, list may have
        // spaces between items.
        continue;
      } else {
        // Non-list content ends the bucket and re-enters normal body flow.
        bucket = null;
        out.push(line);
      }
    } else {
      out.push(line);
    }
  }

  return { body: out.join("\n").trim(), dos, donts };
}

// ────────────────────────────────────────────────────────────────────────
// Declared-sections frontmatter parsing
// ────────────────────────────────────────────────────────────────────────

/**
 * Extract `{ slug, title }` declarations from frontmatter `sections` array
 * if it exists and looks sane. Malformed declarations are silently dropped.
 */
function readDeclaredSections(
  meta: Record<string, unknown>,
): Array<{ slug: string; title: string }> | undefined {
  const raw = meta["sections"];
  if (!Array.isArray(raw)) return undefined;
  const out: Array<{ slug: string; title: string }> = [];
  for (const entry of raw) {
    if (entry && typeof entry === "object") {
      const rec = entry as Record<string, unknown>;
      const slug = typeof rec.slug === "string" ? rec.slug : undefined;
      const title = typeof rec.title === "string" ? rec.title : undefined;
      if (slug && title) {
        out.push({ slug, title });
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

// ────────────────────────────────────────────────────────────────────────
// Public entry point
// ────────────────────────────────────────────────────────────────────────

export interface ParseOptions {
  /** When `true` (default), `body` is sanitized HTML. When `false`, `body` = `bodyMarkdown`. */
  renderHtml?: boolean;
}

export function parseGuidelines(
  markdown: string,
  opts: ParseOptions = {},
): ParsedGuidelines {
  const renderHtml = opts.renderHtml !== false;
  const warnings: string[] = [];

  // Guard against non-string inputs — treat as empty.
  if (typeof markdown !== "string") {
    return { meta: {}, sections: [], warnings: ["empty"] };
  }

  if (markdown.trim() === "") {
    return { meta: {}, sections: [], warnings: ["empty"] };
  }

  // ─── Frontmatter ───────────────────────────────────────────────
  let meta: Record<string, unknown> = {};
  let body = markdown;
  try {
    const parsed = matter(markdown);
    meta = (parsed.data ?? {}) as Record<string, unknown>;
    body = parsed.content ?? "";
  } catch (err) {
    warnings.push(
      `frontmatter-malformed: ${err instanceof Error ? err.message : "unknown"}`,
    );
    // fall through with body=full markdown, meta={}
  }

  const declaredSections = readDeclaredSections(meta);

  // ─── Sections ──────────────────────────────────────────────────
  const rawSections = splitByH2(body);

  let sections: GuidelinesSection[];
  if (rawSections.length === 0) {
    // No H2 headings at all → single synthetic section with the full body.
    const { body: bodyMd, dos, donts } = extractDosDonts(body.trim());
    sections = [
      {
        slug: "content",
        title: "Content",
        body: renderHtml ? renderSafeHtml(bodyMd) : bodyMd,
        bodyMarkdown: bodyMd,
        dos,
        donts,
      },
    ];
  } else {
    sections = rawSections.map(({ title, content }) => {
      const { body: bodyMd, dos, donts } = extractDosDonts(content);
      const defaultSlug = slugFromTitle(title);
      // If frontmatter declared a section with a matching title, prefer that
      // slug so declared routing stays stable when titles diverge slightly.
      const declared = declaredSections?.find(
        (d) => d.title.toLowerCase() === title.toLowerCase(),
      );
      const slug = declared?.slug ?? defaultSlug;
      return {
        slug,
        title,
        body: renderHtml ? renderSafeHtml(bodyMd) : bodyMd,
        bodyMarkdown: bodyMd,
        dos,
        donts,
      };
    });
  }

  // ─── Declared-vs-actual reconciliation (REQ-077) ──────────────
  if (declaredSections) {
    const actualTitles = new Set(
      sections.map((s) => s.title.toLowerCase()),
    );
    const missing = declaredSections.filter(
      (d) => !actualTitles.has(d.title.toLowerCase()),
    );
    if (missing.length > 0) {
      warnings.push(
        `declared-sections-missing: ${missing.map((m) => m.slug).join(",")}`,
      );
    }
  }

  const result: ParsedGuidelines = { meta, sections, warnings };
  if (declaredSections) result.declaredSections = declaredSections;
  return result;
}
