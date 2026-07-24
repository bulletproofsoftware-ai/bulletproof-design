"use client";

import { useState } from "react";

/**
 * ColorSwatch — single color card with click-to-copy.
 *
 * Click copies the hex to the clipboard and shows a brief in-card
 * "Copied" indicator for 1.2s. No toast library dependency — keeps the
 * portal bundle light and avoids a new provider requirement.
 *
 * Copy prefers `navigator.clipboard.writeText`; falls back to a hidden
 * `<textarea>` + `document.execCommand('copy')` for older browsers or
 * non-secure contexts where the async clipboard API is unavailable.
 */

export interface ColorSwatchProps {
  /** Display name (e.g. "Medium Blue"). */
  name: string;
  /** Hex value (e.g. "#1A73E8"). Copied verbatim when the card is clicked. */
  hex: string;
  /**
   * Optional RGB triple rendered beneath the hex. If omitted, the card
   * parses it from `hex`.
   */
  rgb?: [number, number, number];
}

export function ColorSwatch({ name, hex, rgb }: ColorSwatchProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedRgb = rgb ?? parseHexToRgb(hex);
  const rgbText = resolvedRgb ? resolvedRgb.join(", ") : "";

  async function handleCopy() {
    try {
      await copyToClipboard(hex);
      setError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      setError("Copy failed");
      // Ensure the error message fades too.
      setTimeout(() => setError(null), 1800);
      console.warn("ColorSwatch copy failed", err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]"
      aria-label={`${name} ${hex} — click to copy`}
    >
      <div
        className="h-[100px] w-full"
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />
      <div className="relative px-4 py-3">
        <div className="text-sm font-medium text-neutral-900">{name}</div>
        <div className="mt-1 font-mono text-xs text-neutral-500">
          <div>{hex}</div>
          {rgbText && <div className="mt-0.5">{rgbText}</div>}
        </div>

        {/* Copy indicator, absolutely positioned so the card height doesn't jump. */}
        {copied && (
          <span
            role="status"
            aria-live="polite"
            className="absolute right-3 top-3 rounded-full bg-[#1e8e3e] px-2 py-0.5 text-[10px] font-medium text-white"
          >
            Copied
          </span>
        )}
        {error && (
          <span
            role="status"
            aria-live="polite"
            className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white"
          >
            {error}
          </span>
        )}
      </div>
    </button>
  );
}

/** Parse `#RRGGBB` into `[r, g, b]`. Returns null on malformed input. */
function parseHexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if ([r, g, b].every((n) => Number.isFinite(n))) return [r, g, b];
    return null;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if ([r, g, b].every((n) => Number.isFinite(n))) return [r, g, b];
    return null;
  }
  return null;
}

/**
 * Copy `text` to the clipboard.
 *
 * Prefers the modern async API; falls back to a DOM textarea + execCommand
 * for non-secure contexts (`file://`, older iframe-sandboxed previews).
 */
async function copyToClipboard(text: string): Promise<void> {
  // Modern API — requires a secure context (https, localhost, or file://).
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback — hidden textarea + document.execCommand('copy').
  // eslint-disable-next-line no-restricted-globals
  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) throw new Error("No document available");

  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  doc.body.appendChild(ta);
  ta.select();
  try {
    const ok = doc.execCommand("copy");
    if (!ok) throw new Error("execCommand copy returned false");
  } finally {
    doc.body.removeChild(ta);
  }
}
