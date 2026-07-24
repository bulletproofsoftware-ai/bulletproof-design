"use client";

/**
 * Icon detail sheet (SPEC-009 / REQ-028 / REQ-068).
 *
 * Slides in from the right and shows all three style variants
 * (outlined / rounded / sharp) side-by-side with copy and download
 * actions. PNG downloads are rendered client-side via canvas — see
 * `icon-utils.ts` for the REQ-068 rationale. No `<MaterialSymbol>`
 * component is referenced: the Copy React JSX affordance emits an
 * inline `<svg>` snippet only (SPEC-009 out-of-scope list).
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getIconSvg,
  getIconSvgUrl,
  type IconMetadata,
  type IconStyle,
} from "@/lib/api";
import {
  buildInlineJsxSnippet,
  copyTextToClipboard,
  svgToPngBlob,
  triggerBlobDownload,
} from "./icon-utils";

const ALL_STYLES: IconStyle[] = ["outlined", "rounded", "sharp"];

export interface IconDetailSheetProps {
  icon: IconMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Size used for PNG export (matches the grid's preview selector). */
  previewSize: 24 | 36 | 48;
}

type ActionState = "idle" | "busy" | "ok" | "error";

export function IconDetailSheet({
  icon,
  open,
  onOpenChange,
  previewSize,
}: IconDetailSheetProps) {
  // Track per-style action feedback so the buttons can briefly flash
  // "Copied" / "Downloaded" without any toast infra.
  const [feedback, setFeedback] = React.useState<
    Record<string, { state: ActionState; message?: string }>
  >({});

  React.useEffect(() => {
    // Reset feedback when the selected icon changes so stale "Copied"
    // state from a previous icon doesn't carry over.
    setFeedback({});
  }, [icon?.name]);

  function markFeedback(key: string, state: ActionState, message?: string) {
    setFeedback((prev) => ({ ...prev, [key]: { state, message } }));
    if (state === "ok" || state === "error") {
      window.setTimeout(() => {
        setFeedback((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2000);
    }
  }

  async function handleCopySvg(style: IconStyle) {
    if (!icon) return;
    const key = `copy-svg-${style}`;
    markFeedback(key, "busy");
    try {
      const svg = await getIconSvg(icon.name, style);
      const ok = await copyTextToClipboard(svg);
      markFeedback(key, ok ? "ok" : "error", ok ? "Copied" : "Copy failed");
    } catch (err) {
      markFeedback(key, "error", (err as Error).message);
    }
  }

  async function handleCopyJsx(style: IconStyle) {
    if (!icon) return;
    const key = `copy-jsx-${style}`;
    markFeedback(key, "busy");
    try {
      const svg = await getIconSvg(icon.name, style);
      const snippet = buildInlineJsxSnippet(svg, `${icon.name} (${style})`);
      const ok = await copyTextToClipboard(snippet);
      markFeedback(key, ok ? "ok" : "error", ok ? "Copied" : "Copy failed");
    } catch (err) {
      markFeedback(key, "error", (err as Error).message);
    }
  }

  async function handleDownloadPng(style: IconStyle) {
    if (!icon) return;
    const key = `png-${style}`;
    markFeedback(key, "busy");
    try {
      const svg = await getIconSvg(icon.name, style);
      const blob = await svgToPngBlob(svg, previewSize);
      triggerBlobDownload(blob, `${icon.name}-${style}-${previewSize}.png`);
      markFeedback(key, "ok", "Downloaded");
    } catch (err) {
      markFeedback(key, "error", (err as Error).message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl"
        data-testid="icon-detail-sheet"
      >
        {icon ? (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{icon.name}</SheetTitle>
              <SheetDescription>Category: {icon.category}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-auto px-4 pb-6">
              {/* Side-by-side previews */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                {ALL_STYLES.map((style) => {
                  const available = icon.styles.includes(style);
                  return (
                    <div
                      key={style}
                      className="flex flex-col items-center rounded-md border bg-card p-4"
                      data-testid={`icon-detail-style-${style}`}
                    >
                      <div
                        className="flex items-center justify-center text-foreground"
                        style={{ width: 96, height: 96 }}
                      >
                        {available ? (
                          <img
                            src={getIconSvgUrl(icon.name, style)}
                            alt={`${icon.name} ${style}`}
                            width={96}
                            height={96}
                            style={{ width: 96, height: 96 }}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not available
                          </span>
                        )}
                      </div>
                      <span className="mt-2 text-xs font-medium capitalize">
                        {style}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Metadata */}
              <div className="mb-6 space-y-3">
                {icon.aliases.length > 0 ? (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Aliases
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {icon.aliases.map((alias) => (
                        <Badge key={alias} variant="secondary">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {icon.tags.length > 0 ? (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {icon.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Per-style actions */}
              <div className="space-y-4">
                {ALL_STYLES.map((style) => {
                  const available = icon.styles.includes(style);
                  return (
                    <div
                      key={style}
                      className="rounded-md border p-3"
                      data-testid={`icon-detail-actions-${style}`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold capitalize">
                          {style}
                        </span>
                        {!available ? (
                          <Badge variant="outline">Not available</Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!available}
                          onClick={() => handleCopySvg(style)}
                          data-testid={`copy-svg-${style}`}
                        >
                          {renderLabel(
                            feedback[`copy-svg-${style}`],
                            "Copy SVG",
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!available}
                          onClick={() => handleCopyJsx(style)}
                          data-testid={`copy-jsx-${style}`}
                        >
                          {renderLabel(
                            feedback[`copy-jsx-${style}`],
                            "Copy React JSX",
                          )}
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          disabled={!available}
                        >
                          <a
                            href={getIconSvgUrl(icon.name, style)}
                            download={`${icon.name}-${style}.svg`}
                            data-testid={`download-svg-${style}`}
                            aria-disabled={!available}
                            onClick={(e) => {
                              if (!available) e.preventDefault();
                            }}
                          >
                            Download SVG
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!available}
                          onClick={() => handleDownloadPng(style)}
                          data-testid={`download-png-${style}`}
                        >
                          {renderLabel(
                            feedback[`png-${style}`],
                            `Download PNG (${previewSize}px)`,
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            No icon selected.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function renderLabel(
  fb: { state: ActionState; message?: string } | undefined,
  idle: string,
): React.ReactNode {
  if (!fb || fb.state === "idle") return idle;
  if (fb.state === "busy") return "Working…";
  if (fb.state === "ok") return fb.message ?? "Done";
  if (fb.state === "error") return fb.message ?? "Error";
  return idle;
}
