"use client";

import { useState, useEffect, useRef } from "react";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Copy, Trash2, FolderOpen } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { AssetCard } from "@/components/features/AssetCard";
import * as api from "@/lib/api";

export default function AssetsPage() {
  const [assets, setAssets] = useState<api.AssetInfo[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [folderFilter, setFolderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<api.AssetInfo | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAssets() {
    try {
      const [assetList, folderList] = await Promise.all([
        api.getAssets(),
        api.getAssetFolders(),
      ]);
      setAssets(assetList);
      setFolders(folderList);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  const filtered = assets.filter((a) => {
    const matchesFolder =
      folderFilter === "all" || a.folder === folderFilter;
    const matchesSearch =
      !search || a.name.toLowerCase().includes(search.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const [dragOver, setDragOver] = useState(false);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFiles(files: FileList | File[]) {
    const folder = folderFilter !== "all" ? folderFilter : "templates";
    setUploading(true);
    setError("");

    try {
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        await api.uploadAsset(folder, file.name, base64);
      }
      await loadAssets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function openPreview(asset: api.AssetInfo) {
    setSelectedAsset(asset);
    setDialogOpen(true);
  }

  async function handleCopyUrl() {
    if (!selectedAsset) return;
    try {
      await navigator.clipboard.writeText(selectedAsset.url);
    } catch {
      // fallback: select text
    }
  }

  async function handleDelete() {
    if (!selectedAsset) return;
    if (!confirm(`Delete "${selectedAsset.name}"?`)) return;

    try {
      await api.deleteAsset(selectedAsset.path);
      setDialogOpen(false);
      setSelectedAsset(null);
      await loadAssets();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Assets" }]} />
      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-gradient text-3xl font-bold">Assets</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="w-40">
              <FolderOpen className="size-4" />
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />

          <Button onClick={handleUploadClick} disabled={uploading}>
            <Upload className="size-4" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Grid with drag-and-drop */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-xl transition-all ${dragOver ? "ring-2 ring-primary ring-offset-2 bg-primary/5" : ""}`}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 border-2 border-dashed border-primary">
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8 text-primary mb-2" />
              <p className="text-sm font-medium text-primary">Drop files here to upload</p>
            </div>
          </div>
        )}
      {filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground">
          <div className="text-center">
            <Upload className="mx-auto h-6 w-6 mb-2 text-muted-foreground" />
            <p>{assets.length === 0 ? "No assets yet. Drag files here or click Upload." : "No assets match your filters."}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.path}
              name={asset.name}
              url={asset.url}
              size={asset.size}
              mimeType={asset.mimeType}
              onClick={() => openPreview(asset)}
            />
          ))}
        </div>
      )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setZoom(1); }}>
        <DialogContent className="sm:max-w-2xl" style={{ backgroundColor: "#e0e4e8" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{selectedAsset?.name}</span>
              {selectedAsset?.mimeType.startsWith("image/") && (
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>−</Button>
                  <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(1)}>Reset</Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedAsset && (
            <div className="space-y-4">
              {/* Zoomable preview */}
              <div
                className="overflow-auto rounded-lg bg-white border border-border"
                style={{ maxHeight: 400, cursor: selectedAsset.mimeType.startsWith("image/") ? "zoom-in" : "default" }}
                onClick={() => {
                  if (selectedAsset.mimeType.startsWith("image/")) {
                    setZoom((z) => z < 2 ? z + 0.5 : 1);
                  }
                }}
              >
                <div className="flex items-center justify-center p-4" style={{ minHeight: 200 }}>
                  {selectedAsset.mimeType.startsWith("image/") ? (
                    <img
                      src={selectedAsset.url}
                      alt={selectedAsset.name}
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: "center center",
                        transition: "transform 0.2s ease",
                        maxWidth: zoom <= 1 ? "100%" : "none",
                      }}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No preview available
                    </div>
                  )}
                </div>
              </div>

              {/* URL */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">URL</label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={selectedAsset.url}
                    className="flex-1 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                    <Copy className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  {formatBytes(selectedAsset.size)}
                </Badge>
                <Badge variant="outline">{selectedAsset.folder}</Badge>
                <Badge variant="outline">{selectedAsset.mimeType}</Badge>
              </div>

              {/* Delete */}
              <div className="flex justify-end">
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
