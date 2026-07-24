/**
 * SanitisedHtml — thin wrapper for content that has ALREADY been
 * sanitised server-side by the guidelines parser.
 *
 * The portal pages (SPEC-006) consume rendered-and-sanitised guidelines
 * HTML produced by `src/api/lib/guidelinesParser.ts`. That parser runs
 * markdown-it with `html:false` and then `sanitize-html` with an explicit
 * allowlist (F-GUIDE-01). The output is the single trusted rendering
 * path for guidelines markup.
 *
 * This component exists to centralise the review surface: if anyone
 * wants to render HTML in the portal, they go through `SanitisedHtml`,
 * and reviewers only need to audit this one file to confirm the
 * contract.
 *
 * DO NOT use this for arbitrary user input. It is ONLY for output of
 * the trusted server-side sanitiser.
 */

import React from "react";

export interface SanitisedHtmlProps {
  /** Pre-sanitised HTML string (from the server-side guidelines parser). */
  html: string;
  /** Optional container class. */
  className?: string;
}

export function SanitisedHtml({ html, className }: SanitisedHtmlProps) {
  // Server-sanitised HTML — see module-level comment for the contract.
  return React.createElement("div", {
    className,
    dangerouslySetInnerHTML: { __html: html },
  });
}
