import { Router, Request, Response } from "express";
import { getByCategory, getByName } from "../lib/templateIndex";
import { writeTemplate, deleteTemplate } from "../lib/templateWriter";
import { validateParam, sanitizeErrorMessage, validateStringLength, validateArray, MAX_SHORT_TEXT, MAX_ARRAY_ITEMS, MAX_TAG_LENGTH } from "../lib/validation";
import { sanitizePathParam } from "../lib/sanitize";
import { publicAccess, requireApiKey } from "../middleware/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

/**
 * GET /api/templates/:category
 *
 * Returns all templates in a category. Pass ?source=true to include full source code.
 *
 * Response:
 * {
 *   "category": "dashboards",
 *   "templates": [
 *     {
 *       "name": "analytics-dashboard",
 *       "description": "Analytics dashboard with chart widgets",
 *       "tags": ["dashboard", "charts"],
 *       "source": "generated",
 *       "filePath": "/app/templates/dashboards/analytics-dashboard.tsx",
 *       "sourceCode": "..." // only when ?source=true
 *     }
 *   ]
 * }
 */
router.get("/:category", publicAccess, (req: Request, res: Response) => {
  const { category } = req.params;
  if (!validateParam(category)) {
    res.status(400).json({ error: "Invalid parameter: category" });
    return;
  }
  const sourceParam = req.query.source;
  if (sourceParam !== undefined && sourceParam !== "true" && sourceParam !== "false") {
    res.status(400).json({ error: "Invalid query parameter: source (must be 'true' or 'false')" });
    return;
  }
  const includeSource = sourceParam === "true";
  const results = getByCategory(category);

  if (results.length === 0) {
    res.status(404).json({
      error: "Category not found or empty",
      category,
    });
    return;
  }

  const templates = results.map((t) => {
    const entry: Record<string, any> = {
      name: t.meta.name,
      description: t.meta.description,
      tags: t.meta.tags,
      source: t.meta.source,
      filePath: t.filePath,
    };
    if (includeSource) {
      entry.sourceCode = t.sourceCode;
    }
    return entry;
  });

  res.json({ category, templates });
});

/**
 * GET /api/templates/:category/:name
 *
 * Returns a single template with full source code and metadata.
 *
 * Response:
 * {
 *   "category": "dashboards",
 *   "name": "analytics-dashboard",
 *   "description": "...",
 *   "tags": [...],
 *   "source": "generated",
 *   "filePath": "...",
 *   "sourceCode": "..."
 * }
 */
router.get("/:category/:name", publicAccess, (req: Request, res: Response) => {
  const { category, name } = req.params;
  if (!validateParam(category)) {
    res.status(400).json({ error: "Invalid parameter: category" });
    return;
  }
  if (!validateParam(name)) {
    res.status(400).json({ error: "Invalid parameter: name" });
    return;
  }
  const result = getByName(category, name);

  if (!result) {
    res.status(404).json({
      error: "Template not found",
      category,
      name,
    });
    return;
  }

  res.json({
    category: result.meta.category,
    name: result.meta.name,
    description: result.meta.description,
    tags: result.meta.tags,
    source: result.meta.source,
    filePath: result.filePath,
    sourceCode: result.sourceCode,
  });
});

/**
 * POST /api/templates
 *
 * Creates a new template.
 *
 * Body: { category, name, description, tags, sourceCode }
 * Returns 201 with status, template info, and file paths on success.
 * Returns 400 if required fields are missing.
 * Returns 409 if a template with the same category/name already exists.
 */
router.post("/", requireApiKey, async (req: Request, res: Response) => {
  const { category, name, description, tags, sourceCode } = req.body;

  if (!category || !name || !sourceCode) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["category", "name", "sourceCode"],
    });
    return;
  }

  if (!validateStringLength(sourceCode, 1_048_576)) {
    res.status(400).json({ error: "sourceCode must be a string (max 1 MB)" });
    return;
  }
  if (description !== undefined && !validateStringLength(description, MAX_SHORT_TEXT)) {
    res.status(400).json({ error: `description must be a string (max ${MAX_SHORT_TEXT} chars)` });
    return;
  }
  if (tags !== undefined && !validateArray(tags, MAX_ARRAY_ITEMS, MAX_TAG_LENGTH)) {
    res.status(400).json({ error: `tags must be an array of strings (max ${MAX_ARRAY_ITEMS} items, ${MAX_TAG_LENGTH} chars each)` });
    return;
  }

  if (!validateParam(category)) {
    res.status(400).json({ error: "Invalid or missing field: category" });
    return;
  }
  if (!validateParam(name)) {
    res.status(400).json({ error: "Invalid or missing field: name" });
    return;
  }

  let safeCategory: string;
  let safeName: string;
  try {
    safeCategory = sanitizePathParam(category);
    safeName = sanitizePathParam(name);
  } catch {
    res.status(400).json({ error: "Invalid category or name parameter" });
    return;
  }

  const existing = getByName(safeCategory, safeName);
  if (existing) {
    res.status(409).json({
      error: "Template already exists",
      category: safeCategory,
      name: safeName,
      filePath: existing.filePath,
    });
    return;
  }

  try {
    const result = writeTemplate(safeCategory, safeName, sourceCode);
    logAudit(req, "success");
    res.status(201).json({
      status: "created",
      category: safeCategory,
      name: safeName,
      description: description ?? null,
      tags: tags ?? [],
      ...result,
    });
  } catch (err: any) {
    logAudit(req, "failure");
    res.status(500).json({ error: "Failed to write template", details: sanitizeErrorMessage(err.message) });
  }
});

/**
 * PUT /api/templates/:category/:name
 *
 * Updates (overwrites) an existing template's source code.
 *
 * Body: { sourceCode } (required)
 * Returns 200 on success.
 */
router.put("/:category/:name", requireApiKey, async (req: Request, res: Response) => {
  const { category, name } = req.params;
  if (!validateParam(category)) {
    res.status(400).json({ error: "Invalid parameter: category" });
    return;
  }
  if (!validateParam(name)) {
    res.status(400).json({ error: "Invalid parameter: name" });
    return;
  }

  let safeCategory: string;
  let safeName: string;
  try {
    safeCategory = sanitizePathParam(category);
    safeName = sanitizePathParam(name);
  } catch {
    res.status(400).json({ error: "Invalid category or name parameter" });
    return;
  }

  const { sourceCode } = req.body;

  if (!sourceCode) {
    res.status(400).json({
      error: "Missing required field: sourceCode",
    });
    return;
  }
  if (!validateStringLength(sourceCode, 1_048_576)) {
    res.status(400).json({ error: "sourceCode must be a string (max 1 MB)" });
    return;
  }

  try {
    const result = writeTemplate(safeCategory, safeName, sourceCode);
    logAudit(req, "success");
    res.json({
      status: "updated",
      category: safeCategory,
      name: safeName,
      ...result,
    });
  } catch (err: any) {
    logAudit(req, "failure");
    res.status(500).json({ error: "Failed to write template", details: sanitizeErrorMessage(err.message) });
  }
});

/**
 * DELETE /api/templates/:category/:name
 *
 * Deletes a template.
 *
 * Returns 200 on success, 404 if template does not exist.
 */
router.delete("/:category/:name", requireApiKey, async (req: Request, res: Response) => {
  const { category, name } = req.params;
  if (!validateParam(category)) {
    res.status(400).json({ error: "Invalid parameter: category" });
    return;
  }
  if (!validateParam(name)) {
    res.status(400).json({ error: "Invalid parameter: name" });
    return;
  }

  let safeCategory: string;
  let safeName: string;
  try {
    safeCategory = sanitizePathParam(category);
    safeName = sanitizePathParam(name);
  } catch {
    res.status(400).json({ error: "Invalid category or name parameter" });
    return;
  }

  try {
    const deleted = deleteTemplate(safeCategory, safeName);
    if (!deleted) {
      res.status(404).json({ error: "Template not found", category: safeCategory, name: safeName });
      return;
    }
    logAudit(req, "success");
    res.json({ status: "deleted", category: safeCategory, name: safeName });
  } catch (err: any) {
    logAudit(req, "failure");
    res.status(500).json({ error: "Failed to delete template", details: sanitizeErrorMessage(err.message) });
  }
});

export default router;
