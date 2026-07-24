import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

/**
 * LogoLockupCard — single logo card for the portal overview page.
 *
 * Displays a logo image on a neutral background with the label, usage
 * copy, an optional "Preferred" badge, and a download button that uses
 * the native `download` attribute to trigger a file save.
 *
 * The `url` is expected to resolve directly to the asset file served by
 * the API (e.g. `/assets/brands/<slug>/<file>.svg`). No iframe, no
 * inline <script> — portal pages are CSP-safe (REQ-081).
 */

export interface LogoLockupCardProps {
  /** Asset URL — rendered in an <img> and used as the download target. */
  url: string;
  /** Human-readable label (e.g. "Horizontal logo lockup"). */
  label: string;
  /** Usage guidance shown below the label. */
  usage: string;
  /** If true, render a green "Preferred" badge next to the label. */
  preferred?: boolean;
  /** Filename to suggest when downloading. Optional. */
  downloadName?: string;
}

export function LogoLockupCard({
  url,
  label,
  usage,
  preferred,
  downloadName,
}: LogoLockupCardProps) {
  return (
    <section className="mb-12">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
          <span>{label}</span>
          {preferred && (
            <Badge
              variant="secondary"
              className="border-0 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10"
            >
              Preferred
            </Badge>
          )}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{usage}</p>
      </header>

      <div className="relative flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-card p-12">
        <a
          href={url}
          download={downloadName ?? true}
          className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted/40"
          aria-label={`Download ${label}`}
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          <span>{getExtension(url)}</span>
        </a>

        {/* Plain <img> — no iframes, CSP-safe. <img> over next/image
            because asset URLs are cross-origin (API at :8096) and
            Next's image optimiser would need an explicit loader. */}
        <img
          src={url}
          alt={label}
          className="max-h-32 max-w-full object-contain"
        />
      </div>
    </section>
  );
}

/**
 * Extract a short file-type tag for the download button label.
 * Falls back to "Download" when the URL doesn't end with a recognised
 * image extension.
 */
function getExtension(url: string): string {
  const match = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
  if (!match) return "Download";
  const ext = match[1].toUpperCase();
  if (["SVG", "PNG", "JPG", "JPEG", "WEBP", "GIF", "PDF"].includes(ext)) {
    return `\u2193 ${ext}`;
  }
  return "Download";
}
