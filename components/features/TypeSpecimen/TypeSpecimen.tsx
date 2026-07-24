/**
 * TypeSpecimen — renders a live typography specimen row with metadata.
 *
 * A single row corresponds to one scale entry (e.g., h1 / 48px / 700). The
 * sample text is rendered in the declared `family`, `size`, `lineHeight`,
 * and `weight`; the right column shows that metadata in monospace so a
 * brand designer can verify the values match the source of truth.
 *
 * Pure server component — no client state. Used by
 * `app/portal/[slug]/typography/page.tsx`.
 */

export interface TypeSpecimenProps {
  /** Label to show in the metadata column (e.g. "H1" or "Large"). */
  label: string;
  /** Sample text rendered in the specimen. */
  sample: string;
  /** Font family (CSS shorthand, already resolved). */
  family: string;
  /** Font size (CSS value — px, rem, etc.). */
  size: string;
  /** Line height (CSS value — "1.2", "56px", etc.). */
  lineHeight: string;
  /** Font weight (numeric per CSS — 400, 500, 700). */
  weight: number | string;
}

export function TypeSpecimen({
  label,
  sample,
  family,
  size,
  lineHeight,
  weight,
}: TypeSpecimenProps) {
  const weightLabel = typeof weight === "number" ? formatWeight(weight) : weight;

  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-neutral-100 py-3 last:border-b-0">
      <div
        className="min-w-0 flex-1 text-neutral-900"
        style={{
          fontFamily: family,
          fontSize: size,
          fontWeight: weight,
          lineHeight: lineHeight,
        }}
      >
        {sample}
      </div>
      <div className="min-w-[160px] text-right font-mono text-xs text-neutral-500">
        <div>
          {label} / {size}
        </div>
        <div>{weightLabel}</div>
        <div>Line height {lineHeight}</div>
      </div>
    </div>
  );
}

function formatWeight(weight: number): string {
  if (weight <= 100) return `Thin ${weight}`;
  if (weight <= 200) return `Extra Light ${weight}`;
  if (weight <= 300) return `Light ${weight}`;
  if (weight <= 400) return `Regular ${weight}`;
  if (weight <= 500) return `Medium ${weight}`;
  if (weight <= 600) return `Semi Bold ${weight}`;
  if (weight <= 700) return `Bold ${weight}`;
  if (weight <= 800) return `Extra Bold ${weight}`;
  return `Black ${weight}`;
}
