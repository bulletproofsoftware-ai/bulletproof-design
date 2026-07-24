import { Router, Request, Response } from "express";
import { getCategories } from "../lib/templateIndex";
import { publicAccess } from "../middleware/auth";

const router = Router();

/**
 * GET /api/categories
 *
 * Returns all template categories with their template counts.
 *
 * Response:
 * {
 *   "categories": [
 *     { "name": "auth", "count": 3 },
 *     { "name": "dashboards", "count": 2 }
 *   ]
 * }
 */
router.get("/", publicAccess, (_req: Request, res: Response) => {
  const categories = getCategories();
  res.json({ categories });
});

export default router;
