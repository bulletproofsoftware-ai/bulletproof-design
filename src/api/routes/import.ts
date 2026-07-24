import { Router, Request, Response } from "express";
import { generateTemplateFromUrl } from "../lib/templateGenerator";
import { writeTemplate } from "../lib/templateWriter";
import { validateParam, sanitizeErrorMessage, validateStringLength, MAX_SHORT_TEXT } from "../lib/validation";
import { sanitizePathParam, sanitizeUrl } from "../lib/sanitize";
import { requireApiKey } from "../middleware/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

/**
 * POST /api/import
 *
 * Generates a Reshaped template skeleton from a URL.
 *
 * Body: { url, category, name, description?, save? }
 *
 * - url (required): the source URL to import from
 * - category (required): template category
 * - name (required): template name in kebab-case
 * - description (optional): human-readable description
 * - save (optional, boolean): if true, persists the template to disk and returns 201;
 *   otherwise returns 200 with the generated sourceCode only
 *
 * Response (save=false, 200):
 * {
 *   "status": "generated",
 *   "category": "landing-pages",
 *   "name": "my-template",
 *   "sourceCode": "..."
 * }
 *
 * Response (save=true, 201):
 * {
 *   "status": "created",
 *   "category": "landing-pages",
 *   "name": "my-template",
 *   "sourceCode": "...",
 *   ...writeTemplate result fields
 * }
 */
router.post("/", requireApiKey, async (req: Request, res: Response) => {
  const { url, category, name, description, save } = req.body;

  // Validate url
  if (!url) {
    res.status(400).json({ error: "Missing required field: url" });
    return;
  }
  let sanitizedUrl: string;
  try {
    sanitizedUrl = await sanitizeUrl(url);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  // Validate description length
  if (description !== undefined && !validateStringLength(description, MAX_SHORT_TEXT)) {
    res.status(400).json({ error: `description must be a string (max ${MAX_SHORT_TEXT} chars)` });
    return;
  }

  // Validate category and name
  if (!category || !name) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["url", "category", "name"],
    });
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

  let sanitizedCategory: string;
  let sanitizedName: string;
  try {
    sanitizedCategory = sanitizePathParam(category);
    sanitizedName = sanitizePathParam(name);
  } catch {
    res.status(400).json({ error: "Invalid category or name parameter" });
    return;
  }

  try {
    const sourceCode = await generateTemplateFromUrl(sanitizedUrl, sanitizedCategory, sanitizedName, description);

    if (save) {
      const result = writeTemplate(sanitizedCategory, sanitizedName, sourceCode);
      logAudit(req, "success");
      res.status(201).json({
        status: "created",
        category: sanitizedCategory,
        name: sanitizedName,
        sourceCode,
        ...result,
      });
    } else {
      logAudit(req, "success");
      res.json({
        status: "generated",
        category: sanitizedCategory,
        name: sanitizedName,
        sourceCode,
      });
    }
  } catch (err: any) {
    logAudit(req, "failure");
    res.status(500).json({ error: "Failed to generate template", details: sanitizeErrorMessage(err.message) });
  }
});

export default router;
