"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LivePreviewProps {
  url: string;
  className?: string;
}

export function LivePreview({ url, className }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function refresh() {
    if (iframeRef.current) {
      setLoading(true);
      setError(false);
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = currentSrc;
    }
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/10">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Preview unavailable</p>
          <Button variant="ghost" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        sandbox="allow-scripts"
        className={cn("h-full w-full border-0", error && "hidden")}
        title="Template preview"
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
      />
      {!error && (
        <Button
          variant="ghost"
          size="icon"
          onClick={refresh}
          title="Refresh preview"
          className="absolute right-3 top-3 bg-background/80 backdrop-blur-sm hover:bg-background"
        >
          <RefreshCw className="size-4" />
        </Button>
      )}
    </div>
  );
}
