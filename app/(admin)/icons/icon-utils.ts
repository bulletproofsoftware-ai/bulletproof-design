/**
 * Icon browser utilities (SPEC-009 / REQ-068).
 *
 * Pure client-side helpers used by the icons page and detail sheet:
 *   - `svgToPngBlob` — renders an SVG string to a PNG Blob via canvas.
 *     REQ-068 chose client-side rendering over a server-side image pipeline
 *     because Material Symbols SVGs are simple path geometry (no filters,
 *     gradients, or external refs) and the preview sizes are small (24/36/48
 *     px). This avoids introducing native dependencies (canvas, sharp) on
 *     the Express server while keeping the download experience instant.
 *   - `triggerBlobDownload` — wires a Blob into a synthetic `<a download>`.
 *   - `buildInlineJsxSnippet` — converts a server-fetched SVG string into
 *     an inline JSX snippet (no MaterialSymbol component — wrapper is out
 *     of scope per SPEC-009).
 *   - `copyTextToClipboard` — navigator.clipboard with an execCommand
 *     fallback for older browsers / restricted contexts.
 */

/**
 * Render an SVG string into a PNG `Blob` at the requested pixel size.
 * Rejects if the browser cannot decode the SVG or the canvas context is
 * unavailable.
 */
export async function svgToPngBlob(
  svgText: string,
  sizePx: number,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("svgToPngBlob can only run in the browser");
  }
  if (!Number.isFinite(sizePx) || sizePx <= 0) {
    throw new Error(`Invalid sizePx: ${sizePx}`);
  }

  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    // Await load first; some engines (Safari) refuse to decode until set.
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode SVG"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.drawImage(img, 0, 0, sizePx, sizePx);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob returned null"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Trigger a download of the given Blob with the requested filename. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // Some browsers require the anchor to be attached to the DOM
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Allow the browser to fetch the URL before we revoke it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Convert a server-fetched SVG string into an inline JSX snippet. We
 * normalise attributes that use hyphens (xmlns:xlink, stroke-width, …)
 * into camelCase where JSX requires it, and leave the rest untouched.
 *
 * Strictly an inline <svg> block — NO `<MaterialSymbol>` or other wrapper
 * component is emitted (SPEC-009 out-of-scope list / CISO fix).
 */
export function buildInlineJsxSnippet(
  svgText: string,
  iconName: string,
  className = "icon",
): string {
  let body = svgText.trim();

  // Strip XML prolog and any HTML/XML comments — not valid in JSX.
  body = body.replace(/^<\?xml[^>]*\?>\s*/i, "");
  body = body.replace(/<!--[\s\S]*?-->/g, "");

  // Apply a small set of HTML→JSX attribute renames. We deliberately keep
  // this conservative — Material Symbols SVGs use a tiny attribute surface.
  const jsxAttrMap: Record<string, string> = {
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "stroke-miterlimit": "strokeMiterlimit",
    "fill-rule": "fillRule",
    "clip-rule": "clipRule",
    "clip-path": "clipPath",
    "stop-color": "stopColor",
    "stop-opacity": "stopOpacity",
    "xmlns:xlink": "xmlnsXlink",
    "xlink:href": "xlinkHref",
  };
  for (const [from, to] of Object.entries(jsxAttrMap)) {
    body = body.replace(new RegExp(`\\b${from}=`, "g"), `${to}=`);
  }

  // Inject / overwrite the className attribute on the root <svg>. Accept
  // either "class" (HTML) or "className" (already JSX).
  if (/<svg\b[^>]*\sclassName=/.test(body)) {
    body = body.replace(/\sclassName="[^"]*"/, ` className="${className}"`);
  } else if (/<svg\b[^>]*\sclass=/.test(body)) {
    body = body.replace(/\sclass="[^"]*"/, ` className="${className}"`);
  } else {
    body = body.replace(/<svg\b/, `<svg className="${className}"`);
  }

  return `// ${iconName}\n${body}\n`;
}

/** Best-effort clipboard copy with an execCommand fallback. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Case-insensitive substring match across name, aliases, and tags. */
export function matchIcon(icon: {
  name: string;
  aliases: string[];
  tags: string[];
}, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (icon.name.toLowerCase().includes(q)) return true;
  for (const alias of icon.aliases) {
    if (alias.toLowerCase().includes(q)) return true;
  }
  for (const tag of icon.tags) {
    if (tag.toLowerCase().includes(q)) return true;
  }
  return false;
}
