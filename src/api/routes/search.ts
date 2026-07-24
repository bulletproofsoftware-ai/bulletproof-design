import { Router, Request, Response } from "express";
import { search as searchTemplates } from "../lib/templateIndex";
import { validateSearchQuery, MAX_RESULTS } from "../lib/validation";
import { publicAccess } from "../middleware/auth";

const router = Router();

const STORYBOOK_BASE = "http://localhost:8095";

/**
 * GET /api/search?q=keyword
 *
 * Searches across template name, description, tags, and category.
 * Returns matching templates with storybook URLs.
 *
 * Response:
 * {
 *   "query": "dashboard",
 *   "count": 2,
 *   "results": [
 *     {
 *       "category": "dashboards",
 *       "name": "analytics-dashboard",
 *       "description": "...",
 *       "tags": [...],
 *       "storybookUrl": "http://localhost:8095/?path=/story/...",
 *       "filePath": "..."
 *     }
 *   ]
 * }
 */
router.get("/", publicAccess, (req: Request, res: Response) => {
  const query = (req.query.q as string) || "";

  if (!query.trim()) {
    res.status(400).json({
      error: "Missing required query parameter: q",
    });
    return;
  }

  if (!validateSearchQuery(query)) {
    res.status(400).json({ error: "Invalid query parameter: q" });
    return;
  }

  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_RESULTS) : MAX_RESULTS;

  const matches = searchTemplates(query);

  const results = matches.slice(0, limit).map((t) => ({
    category: t.meta.category,
    name: t.meta.name,
    description: t.meta.description,
    tags: t.meta.tags,
    storybookUrl: `${STORYBOOK_BASE}/?path=/story/templates-${encodeURIComponent(t.meta.category)}-${encodeURIComponent(t.meta.name)}`,
    filePath: t.filePath,
  }));

  res.json({
    query,
    count: results.length,
    total: matches.length,
    results,
  });
});

export default router;
