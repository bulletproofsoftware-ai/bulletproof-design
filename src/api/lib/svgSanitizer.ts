/**
 * SVG Sanitizer — pre-write and read-time defense against XSS/XXE attacks
 * carried in SVG payloads.
 *
 * Implements CISO F-UPLOAD-01 (SVG XSS), F-UPLOAD-02 (XXE), and F-STATIC-02
 * (sanitize-on-read). Covers every attack vector enumerated in SPEC-004 §POST
 * /logos:
 *
 *   1. `<script>` elements in any namespace or case, whitespace/tab variants.
 *   2. Every `on*` event handler attribute (case-insensitive).
 *   3. `<foreignObject>` elements — arbitrary HTML/JS injection surface.
 *   4. `<iframe>`, `<embed>`, `<object>` — nested browsing contexts.
 *   5. `<use>` with external-origin `href`/`xlink:href`.
 *   6. `xlink:href`/`href` values with `javascript:` / `vbscript:` / non-image
 *      `data:` schemes.
 *   7. `<style>` blocks — `url(javascript:...)`, `expression()`, `@import`.
 *   8. DOCTYPE declarations and `<!ENTITY>` blocks (XXE).
 *   9. `<form>`, `<input>`, `<button>`, `<meta>`, `<link>` — non-SVG UI.
 *
 * The sanitizer is a pure function: `sanitizeSvg(input: Buffer | string)` →
 * `{ output: string; modified: boolean }`. Invalid or non-SVG input throws.
 *
 * Implementation strategy — `sanitize-html` (already a project dependency)
 * is configured in SVG mode with an explicit allowlist of SVG elements and
 * attributes, wrapped with additional pre/post passes to handle DOCTYPE /
 * ENTITY / XML declaration (which sanitize-html doesn't expose) and a
 * conservative regex scrub to guard against parser edge cases
 * (namespaced `<svg:script>` whitespace variants, etc.).
 */

import sanitizeHtml from "sanitize-html";

/** Upper-bound on input size (5 MB — aligned with SPEC-004 MAX_LOGO_BYTES). */
const MAX_SVG_BYTES = 5 * 1024 * 1024;

/**
 * Allowed SVG element names. Anything outside this list is stripped by
 * sanitize-html. Kept intentionally small — we only need shapes, text, paths,
 * gradients, filters, and SMIL/animate elements.
 *
 * Non-SVG elements `<form>`, `<input>`, `<button>`, `<meta>`, `<link>`,
 * `<iframe>`, `<embed>`, `<object>`, `<foreignObject>`, `<script>`, `<style>`
 * are deliberately absent.
 */
const ALLOWED_SVG_TAGS: string[] = [
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "metadata",
  // Shapes
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  // Text
  "text",
  "tspan",
  "textPath",
  // Fills / paints
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "mask",
  "clipPath",
  "filter",
  "feGaussianBlur",
  "feOffset",
  "feMerge",
  "feMergeNode",
  "feColorMatrix",
  "feBlend",
  "feFlood",
  "feComposite",
  "feMorphology",
  "feTurbulence",
  "feDisplacementMap",
  "feDropShadow",
  // Reuse (only same-document fragments allowed — enforced below)
  "use",
  "symbol",
  "marker",
  "image",
  // Anchors (sanitized schemes only)
  "a",
  // Animation (SMIL) — retained, but event-handler attrs stripped
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "mpath",
];

/**
 * Attribute allowlist. `"*"` means "on any element". Anything not listed is
 * dropped. All `on*` attributes are excluded by omission; the regex pass below
 * adds a second line of defence in case sanitize-html ever added tolerant
 * parsing of case-variant attribute names.
 */
const ALLOWED_ATTRS: Record<string, string[]> = {
  "*": [
    "id",
    "class",
    "style",
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-opacity",
    "opacity",
    "transform",
    "clip-path",
    "clip-rule",
    "mask",
    "filter",
    "color",
    "display",
    "visibility",
    "overflow",
    "pointer-events",
    "cursor",
    "vector-effect",
    "paint-order",
  ],
  svg: [
    "xmlns",
    "xmlns:xlink",
    "version",
    "viewBox",
    "width",
    "height",
    "preserveAspectRatio",
  ],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"],
  path: ["d"],
  text: ["x", "y", "dx", "dy", "text-anchor", "font-family", "font-size", "font-weight", "font-style"],
  tspan: ["x", "y", "dx", "dy", "text-anchor"],
  textPath: ["href", "xlink:href", "startOffset", "method", "spacing"],
  linearGradient: ["x1", "y1", "x2", "y2", "gradientUnits", "gradientTransform", "spreadMethod"],
  radialGradient: ["cx", "cy", "r", "fx", "fy", "gradientUnits", "gradientTransform", "spreadMethod"],
  stop: ["offset", "stop-color", "stop-opacity"],
  pattern: ["x", "y", "width", "height", "patternUnits", "patternContentUnits", "patternTransform", "viewBox", "preserveAspectRatio", "href", "xlink:href"],
  mask: ["x", "y", "width", "height", "maskUnits", "maskContentUnits"],
  clipPath: ["clipPathUnits"],
  filter: ["x", "y", "width", "height", "filterUnits", "primitiveUnits"],
  feGaussianBlur: ["in", "in2", "stdDeviation", "result", "edgeMode"],
  feOffset: ["in", "dx", "dy", "result"],
  feMerge: ["in", "result"],
  feMergeNode: ["in"],
  feColorMatrix: ["in", "type", "values", "result"],
  feBlend: ["in", "in2", "mode", "result"],
  feFlood: ["flood-color", "flood-opacity", "result"],
  feComposite: ["in", "in2", "operator", "k1", "k2", "k3", "k4", "result"],
  feMorphology: ["in", "operator", "radius", "result"],
  feTurbulence: ["baseFrequency", "numOctaves", "seed", "stitchTiles", "type", "result"],
  feDisplacementMap: ["in", "in2", "scale", "xChannelSelector", "yChannelSelector", "result"],
  feDropShadow: ["dx", "dy", "stdDeviation", "flood-color", "flood-opacity"],
  use: ["href", "xlink:href", "x", "y", "width", "height"],
  symbol: ["viewBox", "preserveAspectRatio"],
  marker: ["viewBox", "refX", "refY", "markerUnits", "markerWidth", "markerHeight", "orient"],
  image: ["href", "xlink:href", "x", "y", "width", "height", "preserveAspectRatio"],
  a: ["href", "xlink:href", "target", "rel"],
  animate: ["attributeName", "from", "to", "dur", "begin", "end", "repeatCount", "values", "keyTimes", "keySplines", "calcMode"],
  animateMotion: ["dur", "begin", "end", "repeatCount", "path", "keyTimes", "keySplines", "calcMode", "rotate"],
  animateTransform: ["attributeName", "type", "from", "to", "dur", "begin", "end", "repeatCount", "values", "keyTimes", "keySplines", "calcMode"],
  set: ["attributeName", "to", "begin", "end", "dur"],
  mpath: ["href", "xlink:href"],
  g: ["transform"],
};

/**
 * Validate an `href` / `xlink:href` value. Strips:
 *   - `javascript:`, `vbscript:`, `livescript:` schemes (XSS)
 *   - `data:` schemes UNLESS `data:image/<anything>` (same-origin inline images OK)
 *   - Absolute URLs on `<use>` (only same-document fragments `#…` allowed)
 *
 * Returns `false` to signal that sanitize-html should DROP the attribute,
 * or a string to rewrite the value.
 */
function validateHref(value: string, tagName: string): string | false {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  // Reject dangerous schemes outright.
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("livescript:") ||
    lower.startsWith("mocha:")
  ) {
    return false;
  }

  // Allow only image data URIs. Block `data:text/html`, `data:application/*`, etc.
  if (lower.startsWith("data:")) {
    if (!/^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)[;,]/i.test(trimmed)) {
      return false;
    }
    return trimmed;
  }

  // `<use>` may only reference same-document fragments.
  if (tagName === "use" || tagName === "mpath") {
    if (!trimmed.startsWith("#")) return false;
    return trimmed;
  }

  return trimmed;
}

/**
 * Pre-pass that strips XML/DOCTYPE/ENTITY declarations and CDATA-wrapped
 * script before handing the string to sanitize-html.
 *
 * sanitize-html's HTML parser treats `<!DOCTYPE …>` tokens as noise rather
 * than dangerous content; entities can slip through as attribute values in
 * fixture-parser edge cases. Deleting them here is cheap and defence-in-depth.
 */
function stripDoctypeAndEntities(input: string): string {
  return input
    // XML declaration — harmless but removed for determinism
    .replace(/<\?xml[^?]*\?>/gi, "")
    // Internal DTD subset with ENTITY definitions (XXE primary vector).
    // Matches `<!DOCTYPE svg [ … ]>` with nested brackets.
    .replace(/<!DOCTYPE[^[>]*\[[\s\S]*?\][^>]*>/gi, "")
    // Simple DOCTYPE without internal subset.
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    // Standalone ENTITY declarations that somehow escaped the DTD strip.
    .replace(/<!ENTITY[^>]*>/gi, "")
    // Standalone ELEMENT/ATTLIST/NOTATION declarations (DTD noise).
    .replace(/<!ELEMENT[^>]*>/gi, "")
    .replace(/<!ATTLIST[^>]*>/gi, "")
    .replace(/<!NOTATION[^>]*>/gi, "");
}

/**
 * Post-pass that catches any residual script-like or event-handler-like
 * artifacts the sanitize-html allowlist should have already dropped. Belt
 * AND suspenders — if the allowlist ever regresses, this pass still blocks
 * the attack.
 *
 * This is intentionally conservative: it only strips patterns that can never
 * appear in a legitimate SVG.
 */
function postPassScrub(input: string): string {
  let out = input;

  // Strip any remaining namespaced or oddly-cased <script> openings. The HTML
  // parser normalises most of these, but SVG namespaced forms like
  // `<svg:script>` or weird whitespace (`<script\t>`) can slip through fragment
  // mode. Remove the entire element.
  // Each of these runs to a fixpoint. A single pass is defeatable by nesting the
  // very token being removed: `<scr<script>ipt>` becomes `<script>` *after* one
  // replacement, and `<!-<!-- ->-->` reassembles a comment the same way. Repeating
  // until the string stops changing removes that class of bypass entirely.
  // (CodeQL js/incomplete-multi-character-sanitization.)
  out = replaceToFixpoint(out, [
    // Namespaced or oddly-cased <script>...</script>, whole element.
    // `[^>]*` after the tag name, not `\s*`: HTML lets a close tag carry junk
    // (`</script\t\n bar>`), and a pattern that only tolerates whitespace misses
    // it (CodeQL js/bad-tag-filter).
    /<\s*(?:[a-zA-Z][\w-]*:)?script\b[\s\S]*?<\s*\/\s*(?:[a-zA-Z][\w-]*:)?script[^>]*>/gi,
    // Self-closing / malformed <script> with no matching close.
    /<\s*(?:[a-zA-Z][\w-]*:)?script\b[^>]*>/gi,
    // Residual `on*=...` regardless of case/whitespace:
    // `onclick="..."`, `ON LOAD = '...'`, `onbegin=foo`.
    /\s+on[a-z][a-z0-9_-]*\s*=\s*"[^"]*"/gi,
    /\s+on[a-z][a-z0-9_-]*\s*=\s*'[^']*'/gi,
    /\s+on[a-z][a-z0-9_-]*\s*=\s*[^\s>]+/gi,
  ]);

  return out;
}

/**
 * Apply every pattern repeatedly until a full round changes nothing.
 *
 * Bounded so a pathological input cannot spin: each round must shorten the
 * string (every pattern here only ever deletes), so the bound is generous.
 */
function replaceToFixpoint(input: string, patterns: RegExp[]): string {
  let out = input;
  for (let round = 0; round < 20; round++) {
    const before = out;
    for (const re of patterns) out = out.replace(re, "");
    if (out === before) break;
  }
  return out;
}

/**
 * Quick structural gate — the sanitized output must still contain an `<svg>`
 * root, otherwise the input was not a real SVG (or was so hostile that
 * nothing survived sanitization).
 */
function isSvgRooted(input: string): boolean {
  return /<svg[\s>]/i.test(input);
}

export interface SanitizeResult {
  /** UTF-8 string output, safe to write to disk or serve. */
  output: string;
  /** True when the sanitizer modified the input (tripped at least one rule). */
  modified: boolean;
}

/**
 * Sanitize an SVG buffer or string. Returns the cleaned bytes plus a
 * `modified` flag so callers can audit-log divergence from the original.
 *
 * Throws on:
 *   - Non-UTF-8 input (via Buffer.toString).
 *   - Input exceeding MAX_SVG_BYTES.
 *   - Output that contains no `<svg>` root (input was not a valid SVG).
 */
/**
 * Apply `re` until the string stops changing.
 *
 * A single pass is not enough when the pattern spans multiple characters,
 * because removing one match can splice the surrounding text into a fresh one.
 * Concretely, one pass over
 *
 *     <scr<script>ipt>alert(1)</script>ipt>alert(2)</script>
 *
 * removes the inner span and leaves `<script>alert(2)</script>` fully intact —
 * the pre-pass hands sanitize-html exactly the element it was meant to strip
 * (CodeQL js/incomplete-multi-character-sanitization). Iterating to a fixed
 * point removes it. The string shrinks on every iteration that changes it, so
 * this terminates.
 */
function stripUntilStable(value: string, re: RegExp): string {
  let out = value;
  let previous: string;
  do {
    previous = out;
    out = out.replace(re, "");
  } while (out !== previous);
  return out;
}

export function sanitizeSvg(input: Buffer | string): SanitizeResult {
  const raw = typeof input === "string" ? input : input.toString("utf-8");

  if (Buffer.byteLength(raw, "utf-8") > MAX_SVG_BYTES) {
    throw new Error("SVG input exceeds maximum size");
  }

  if (!isSvgRooted(raw)) {
    throw new Error("Input does not contain an <svg> root element");
  }

  // 1. Strip DOCTYPE / ENTITY / DTD constructs (XXE defence).
  let prePass = stripDoctypeAndEntities(raw);

  // 1b. Strip namespaced script elements (`<svg:script>`, `<xhtml:script>`)
  //     and their contents BEFORE handing to sanitize-html. The HTML parser
  //     sanitize-html uses treats `<svg:script>` as a separate tag from
  //     `<script>`, so a simple allowlist wouldn't drop the child text node.
  //     We also pre-strip uppercase/mixed-case `<SCRIPT>` so the text
  //     content doesn't survive.
  prePass = stripUntilStable(
    prePass,
    /<\s*[a-zA-Z][\w-]*:script\b[\s\S]*?<\s*\/\s*[a-zA-Z][\w-]*:script[^>]*>/gi,
  );
  // Case-insensitive <script>…</script> — sanitize-html's nonTextTags is
  // case-sensitive under `lowerCaseTags:false`, so we pre-strip here.
  prePass = stripUntilStable(
    prePass,
    /<\s*script\b[\s\S]*?<\s*\/\s*script[^>]*>/gi,
  );
  // Same for <style>, <iframe>, <embed>, <object>, <foreignObject>, <form>,
  // <input>, <button>, <meta>, <link>, <textarea>, <select>, <noscript>,
  // <body>. These must have their contents dropped even when the tag name
  // comes in uppercase or mixed case.
  const DANGEROUS_TAGS = [
    "style",
    "iframe",
    "embed",
    "object",
    "foreignObject",
    "form",
    "input",
    "button",
    "meta",
    "link",
    "textarea",
    "select",
    "noscript",
    "body",
    "html",
    "head",
  ];
  for (const tag of DANGEROUS_TAGS) {
    const paired = new RegExp(
      `<\\s*${tag}\\b[\\s\\S]*?<\\s*/\\s*${tag}[^>]*>`,
      "gi",
    );
    prePass = stripUntilStable(prePass, paired);
    // Self-closing or unclosed variants.
    const selfClosing = new RegExp(`<\\s*${tag}\\b[^>]*/?>`, "gi");
    prePass = stripUntilStable(prePass, selfClosing);
  }

  // 2. Run through sanitize-html with the SVG allowlist.
  //    `parser.lowerCaseTags: false` preserves camelCase SVG names like
  //    `viewBox`, `linearGradient`, `feGaussianBlur`.
  const sanitized = sanitizeHtml(prePass, {
    allowedTags: ALLOWED_SVG_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    // Drop the contents of any disallowed tag (including <script>, <style>,
    // <iframe>, <embed>, <object>, <foreignObject>, <form>, <input>, etc.).
    nonTextTags: ["script", "style", "iframe", "embed", "object", "foreignObject", "form", "input", "button", "meta", "link", "textarea", "select", "noscript"],
    // Attribute transformations — validate href/xlink:href schemes.
    transformTags: {
      "*": (tagName, attribs) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(attribs)) {
          // Drop any `on*` attribute unconditionally.
          if (/^on/i.test(k)) continue;

          // Validate href and xlink:href.
          if (k === "href" || k === "xlink:href") {
            const validated = validateHref(v, tagName);
            if (validated === false) continue;
            out[k] = validated;
            continue;
          }

          // Drop any attribute whose value contains `javascript:` — catches
          // CSS-in-style and edge parser cases.
          if (/javascript\s*:/i.test(v)) continue;

          out[k] = v;
        }
        return { tagName, attribs: out };
      },
    },
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
    // The transform above is the authoritative href validator — it rejects
    // `javascript:` / `vbscript:` outright, and narrows `data:` to the image
    // subset. We allow `data` here so sanitize-html doesn't pre-strip a safe
    // `data:image/png;base64,…` before our transform can see it.
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      image: ["http", "https", "data"],
      use: ["http", "https"],
      mpath: ["http", "https"],
      textPath: ["http", "https"],
    },
    allowProtocolRelative: false,
  });

  // 3. Defence-in-depth regex pass.
  const scrubbed = postPassScrub(sanitized);

  // 4. Sanity check — sanitization destroyed the root.
  if (!isSvgRooted(scrubbed)) {
    throw new Error("Sanitization removed <svg> root — input was malformed");
  }

  // `modified` is true whenever any transformation changed the bytes.
  // We compare the pre-DOCTYPE-strip original to the final output to catch
  // every case (DOCTYPE removal counts as a modification for audit purposes).
  const modified = scrubbed !== raw;

  return { output: scrubbed, modified };
}

/** Exported for tests — the absolute byte cap the sanitizer enforces. */
export const SVG_SANITIZER_MAX_BYTES = MAX_SVG_BYTES;
