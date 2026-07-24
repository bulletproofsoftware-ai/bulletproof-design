"use client";

import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { FileIcon, ImageIcon } from "lucide-react";

interface AssetCardProps {
  name: string;
  url: string;
  size: number;
  mimeType: string;
  onClick?: () => void;
}

export function AssetCard({
  name,
  url,
  size,
  mimeType,
  onClick,
}: AssetCardProps) {
  const isImage = mimeType.startsWith("image/");

  return (
    <div className="template-card overflow-hidden !p-0" onClick={onClick}>
      <div className="flex items-center justify-center bg-muted/30 p-4" style={{ minHeight: 80 }}>
        {isImage ? (
          <img
            src={url}
            alt={name}
            style={{ maxWidth: "100%", height: "auto" }}
          />
        ) : (
          <FileIcon className="size-10 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {formatBytes(size)}
          </Badge>
          {isImage && (
            <ImageIcon className="size-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}
