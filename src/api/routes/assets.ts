import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { validateParam, validateFilename, validateStringLength, MAX_RESULTS } from "../lib/validation";
import { resolveWithin, sanitizePathParam } from "../lib/sanitize";
import { publicAccess, requireApiKey } from "../middleware/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();
const ASSETS_DIR = process.env.ASSETS_DIR || "./assets";

const MIME_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const MAX_WALK_DEPTH = 10;
const MAX_WALK_FILES = 10_000;

function walkDir(dir: string, base: string = "", depth: number = 0): Array<{ path: string; name: string; folder: string; size: number; type: string; modifiedAt: string }> {
  if (depth > MAX_WALK_DEPTH) return [];
  const results: Array<{ path: string; name: string; folder: string; size: number; type: string; modifiedAt: string }> = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (results.length >= MAX_WALK_FILES) break;
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const sub = walkDir(fullPath, relPath, depth + 1);
      results.push(...sub);
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      const ext = path.extname(entry.name).toLowerCase();
      results.push({
        path: relPath,
        name: entry.name,
        folder: base || ".",
        size: stat.size,
        type: MIME_TYPES[ext] || "application/octet-stream",
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }
  return results;
}

/**
 * GET /api/assets
 * List all assets. Optional ?folder= filter.
 */
router.get("/", publicAccess, (req: Request, res: Response) => {
  const folderRaw = typeof req.query.folder === "string" ? req.query.folder : undefined;
  const folder = folderRaw && validateParam(folderRaw) ? folderRaw : undefined;
  let assets = walkDir(ASSETS_DIR);
  if (folder) {
    assets = assets.filter((a) => a.folder === folder || a.folder.startsWith(folder + "/"));
  }
  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_RESULTS * 10) : MAX_RESULTS * 10;
  const totalCount = assets.length;
  assets = assets.slice(0, limit);

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const withUrls = assets.map((a) => ({
    ...a,
    url: `${baseUrl}/assets/${a.path}`,
  }));
  res.json({ assets: withUrls, total: totalCount });
});

/**
 * GET /api/assets/folders
 * List all unique folders.
 */
router.get("/folders", publicAccess, (_req: Request, res: Response) => {
  const assets = walkDir(ASSETS_DIR);
  const folders = [...new Set(assets.map((a) => a.folder).filter((f) => f !== "."))].sort();
  res.json({ folders });
});

/**
 * POST /api/assets
 * Upload an asset. Accepts JSON: { folder, filename, data (base64) }
 */
router.post("/", requireApiKey, (req: Request, res: Response) => {
  const { folder, filename, data } = req.body;
  if (!folder || !filename || !data) {
    res.status(400).json({ error: "folder, filename, and data (base64) are required" });
    return;
  }
  if (!validateStringLength(data, 5_242_880)) {
    res.status(400).json({ error: "data must be a base64 string (max ~5 MB encoded)" });
    return;
  }
  if (!validateParam(folder)) {
    res.status(400).json({ error: "Invalid or missing field: folder" });
    return;
  }
  if (!validateFilename(filename)) {
    res.status(400).json({ error: "Invalid or missing field: filename" });
    return;
  }
  let sanitizedFolder: string;
  try {
    sanitizedFolder = sanitizePathParam(folder);
  } catch {
    res.status(400).json({ error: "Invalid folder path" });
    return;
  }
  const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, "");
  // Containment is asserted on the FINAL path, not just the directory: the old
  // check validated targetDir and then appended safeName unchecked, which left
  // the appended segment outside the guarantee (CodeQL js/path-injection).
  let targetDir: string;
  let filePath: string;
  try {
    targetDir = resolveWithin(ASSETS_DIR, sanitizedFolder);
    filePath = resolveWithin(ASSETS_DIR, sanitizedFolder, safeName);
  } catch {
    res.status(400).json({ error: "Invalid folder path" });
    return;
  }
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const buffer = Buffer.from(data, "base64");
    fs.writeFileSync(filePath, buffer);
    const stat = fs.statSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const relPath = `${sanitizedFolder}/${safeName}`;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    logAudit(req, "success");
    res.status(201).json({
      path: relPath,
      name: safeName,
      folder: sanitizedFolder,
      size: stat.size,
      type: MIME_TYPES[ext] || "application/octet-stream",
      url: `${baseUrl}/assets/${relPath}`,
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (err) {
    logAudit(req, "failure");
    throw err;
  }
});

/**
 * DELETE /api/assets/*
 * Delete an asset by relative path.
 */
router.delete("/*", requireApiKey, (req: Request, res: Response) => {
  const assetPath = req.params[0];
  if (!assetPath) {
    res.status(400).json({ error: "Asset path is required" });
    return;
  }
  // Reject null bytes and path traversal sequences before resolving

  if (assetPath.includes("\x00") || assetPath.includes("..")) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }
  const fullPath = path.resolve(ASSETS_DIR, assetPath);
  if (!fullPath.startsWith(path.resolve(ASSETS_DIR) + path.sep)) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }
  try {
    fs.unlinkSync(fullPath);
    logAudit(req, "success");
    res.json({ status: "deleted", path: assetPath });
  } catch {
    logAudit(req, "failure");
    res.status(404).json({ error: "Asset not found", path: assetPath });
  }
});

export default router;
