"use client";

/**
 * Virtualized icon grid (SPEC-009 / REQ-065).
 *
 * Renders a windowed grid over the full pre-fetched icon catalogue
 * (~7,500 entries). Only rows within the viewport + overscan are mounted,
 * so SVG <img> requests only fire for cells the user is looking at.
 *
 * Sizing model:
 *   - Container width is observed via ResizeObserver.
 *   - `columnCount = floor((width + gap) / (cellMinWidth + gap))`
 *     clamped to >= 1.
 *   - Row height = cellMinHeight (label + spacing accounted for by the cell).
 *
 * Keeps a stable total row count so virtualizer measurements don't thrash
 * when filters change; `filteredIcons` is always treated as the source.
 */

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { getIconSvgUrl, type IconMetadata, type IconStyle } from "@/lib/api";

export interface VirtualIconGridProps {
  icons: IconMetadata[];
  /** Pixel size used for preview rendering (24 / 36 / 48). */
  previewSize: 24 | 36 | 48;
  /** Which style to render in the grid. */
  style: IconStyle;
  /** Called with the selected icon's name when a cell is clicked. */
  onSelect: (icon: IconMetadata) => void;
  /** Optional test hook — injected cell renderer for deterministic tests. */
  renderCell?: (icon: IconMetadata) => React.ReactNode;
}

/** Cell sizing constants. */
const CELL_MIN_WIDTH = 104; // px — enough for 48px icon + label
const CELL_GAP = 8; // px — gutter between cells
const ROW_HEIGHT = 116; // px — icon + caption + padding
const OVERSCAN_ROWS = 6;

export function VirtualIconGrid({
  icons,
  previewSize,
  style,
  onSelect,
  renderCell,
}: VirtualIconGridProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Observe width so column count updates when the sidebar opens/closes
    // or the viewport resizes.
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const columnCount = Math.max(
    1,
    Math.floor((containerWidth + CELL_GAP) / (CELL_MIN_WIDTH + CELL_GAP)),
  );
  const rowCount = Math.ceil(icons.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
  });

  return (
    <div
      ref={scrollRef}
      className="relative h-full overflow-auto"
      data-testid="icon-grid-scroll"
    >
      {icons.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No icons match your search.
        </div>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const start = virtualRow.index * columnCount;
            const rowIcons = icons.slice(start, start + columnCount);
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                className="absolute left-0 right-0 flex items-stretch"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${ROW_HEIGHT}px`,
                  gap: `${CELL_GAP}px`,
                  padding: `0 ${CELL_GAP}px`,
                }}
              >
                {rowIcons.map((icon) => (
                  <IconCell
                    key={icon.name}
                    icon={icon}
                    style={style}
                    previewSize={previewSize}
                    onSelect={onSelect}
                    render={renderCell}
                  />
                ))}
                {/* Fill the row with blanks so flex doesn't stretch the last cell. */}
                {rowIcons.length < columnCount
                  ? Array.from({ length: columnCount - rowIcons.length }).map(
                      (_, i) => (
                        <div
                          key={`blank-${i}`}
                          aria-hidden
                          className="flex-1"
                          style={{ minWidth: CELL_MIN_WIDTH }}
                        />
                      ),
                    )
                  : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface IconCellProps {
  icon: IconMetadata;
  style: IconStyle;
  previewSize: number;
  onSelect: (icon: IconMetadata) => void;
  render?: (icon: IconMetadata) => React.ReactNode;
}

function IconCell({ icon, style, previewSize, onSelect, render }: IconCellProps) {
  if (render) {
    return (
      <button
        type="button"
        onClick={() => onSelect(icon)}
        className="flex-1"
        data-testid={`icon-cell-${icon.name}`}
      >
        {render(icon)}
      </button>
    );
  }

  // If the requested style isn't declared for this icon, fall back to
  // outlined so we still render a preview.
  const effectiveStyle: IconStyle = icon.styles.includes(style)
    ? style
    : icon.styles[0] ?? "outlined";

  return (
    <button
      type="button"
      onClick={() => onSelect(icon)}
      data-testid={`icon-cell-${icon.name}`}
      className={cn(
        "group flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-transparent p-2 text-xs",
        "hover:border-border hover:bg-accent/50 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
      )}
      style={{ minWidth: CELL_MIN_WIDTH }}
      aria-label={`Icon ${icon.name}, category ${icon.category}`}
    >
      <div
        className="flex items-center justify-center text-foreground"
        style={{ width: previewSize, height: previewSize }}
      >
        {/* Plain <img> (not next/image) because every cell hits a
            per-request endpoint on :8096 — next/image would proxy through
            Next and double the round-trips for no benefit. loading="lazy"
            lets the browser skip any offscreen fetches that slip past the
            virtualizer's unmounting. */}
        <img
          src={getIconSvgUrl(icon.name, effectiveStyle)}
          alt=""
          width={previewSize}
          height={previewSize}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ width: previewSize, height: previewSize }}
        />
      </div>
      <span
        className="w-full truncate text-center text-muted-foreground group-hover:text-foreground"
        title={icon.name}
      >
        {icon.name}
      </span>
    </button>
  );
}
