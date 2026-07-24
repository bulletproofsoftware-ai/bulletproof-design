import { Router, Request, Response } from "express";
import { getByName } from "../lib/templateIndex";
import { validateParam } from "../lib/validation";
import { sanitizePathParam } from "../lib/sanitize";
import { publicAccess } from "../middleware/auth";

const router = Router();

router.get("/:category/:name", publicAccess, (req: Request, res: Response) => {
  const { category, name } = req.params;
  if (!validateParam(category)) {
    res.status(400).send("Invalid parameter: category");
    return;
  }
  if (!validateParam(name)) {
    res.status(400).send("Invalid parameter: name");
    return;
  }

  let safeCategory: string;
  let safeName: string;
  try {
    safeCategory = sanitizePathParam(category);
    safeName = sanitizePathParam(name);
  } catch {
    res.status(400).send("Invalid parameter");
    return;
  }

  const template = getByName(safeCategory, safeName);

  if (!template) {
    res.status(404).send("Template not found");
    return;
  }

  const visual = buildVisualPreview(template.sourceCode, template.meta);

  // Extract @design tokens from source code for auto-theming
  const designTokens = extractDesignTokens(template.sourceCode);

  // Read optional brand token overrides from query params
  // Validate: only allow safe CSS-value characters (hex colors, font names, px values)
  const safeCssValue = (v: unknown): string => {
    const s = typeof v === "string" ? v : "";
    return /^[a-zA-Z0-9#(),.\-_ ]+$/.test(s) && s.length <= 100 ? s : "";
  };
  const tokenOverrides = {
    primary: safeCssValue(req.query.primary),
    secondary: safeCssValue(req.query.secondary),
    accent: safeCssValue(req.query.accent),
    bg: safeCssValue(req.query.bg),
    surface: safeCssValue(req.query.surface),
    text: safeCssValue(req.query.text),
    textMuted: safeCssValue(req.query.textMuted),
    border: safeCssValue(req.query.border),
    fontHeading: safeCssValue(req.query.fontHeading),
    fontBody: safeCssValue(req.query.fontBody),
    radius: safeCssValue(req.query.radius),
  };

  // Auto-apply design tokens if no query param overrides were provided
  if (!tokenOverrides.primary && designTokens.primary) {
    tokenOverrides.primary = designTokens.primary;
    tokenOverrides.accent = designTokens.accent || "";
    tokenOverrides.bg = designTokens.background || "";
    tokenOverrides.surface = designTokens.surface || "";
    tokenOverrides.text = designTokens.text || "";
    tokenOverrides.textMuted = designTokens.muted || "";
    tokenOverrides.fontHeading = designTokens.headingFont || "";
    tokenOverrides.fontBody = designTokens.bodyFont || "";
  }

  // Build override CSS
  let overrideCss = "";
  if (tokenOverrides.primary) {
    const accent = tokenOverrides.accent || tokenOverrides.primary;
    overrideCss = `<style>
    body { background: ${esc(tokenOverrides.bg || '#f8fafc')} !important; color: ${esc(tokenOverrides.text || '#0f172a')} !important; font-family: '${esc(tokenOverrides.fontBody || 'Inter')}', sans-serif !important; }
    h1,h2,h3,h4,h5,h6 { font-family: '${esc(tokenOverrides.fontHeading || 'Inter')}', sans-serif !important; color: ${esc(tokenOverrides.text || '#0f172a')} !important; }
    .card { background: ${esc(tokenOverrides.surface || '#fff')} !important; border-color: ${esc(tokenOverrides.border || '#e2e8f0')} !important; border-radius: ${esc(tokenOverrides.radius || '12px')} !important; }
    .btn-p { background: ${esc(tokenOverrides.primary)} !important; }
    .btn, .inp { border-radius: ${esc(tokenOverrides.radius || '8px')} !important; }
    .nav { border-color: ${esc(tokenOverrides.border || '#e2e8f0')} !important; background: ${esc(tokenOverrides.primary)} !important; padding: 12px 16px !important; border-radius: 8px !important; }
    .nav .bold { color: #fff !important; }
    .nav .btn-g { color: rgba(255,255,255,0.9) !important; }
    .nav .btn-p { background: ${esc(accent)} !important; }
    .badge.b-blue { background: ${esc(tokenOverrides.primary)}20 !important; color: ${esc(tokenOverrides.primary)} !important; }
    .badge.b-green { background: ${esc(accent)}20 !important; color: ${esc(accent)} !important; }
    p, .desc, .muted, .stat-l { color: ${esc(tokenOverrides.textMuted || '#64748b')} !important; }
    .divider, .footer { border-color: ${esc(tokenOverrides.border || '#e2e8f0')} !important; }
    .tab.active { color: ${esc(tokenOverrides.primary)} !important; border-bottom-color: ${esc(tokenOverrides.primary)} !important; }
    .hero h1 { color: ${esc(tokenOverrides.primary)} !important; }
    .stat-v { color: ${esc(accent)} !important; }
    .section-h { color: ${esc(accent)} !important; }
    .card h3 { color: ${esc(tokenOverrides.text || '#0f172a')} !important; }
    a { color: ${esc(tokenOverrides.primary)} !important; }
  </style>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(template.meta.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700${tokenOverrides.fontHeading ? `&family=${encodeURIComponent(tokenOverrides.fontHeading)}:wght@400;500;600;700` : ""}${tokenOverrides.fontBody && tokenOverrides.fontBody !== tokenOverrides.fontHeading ? `&family=${encodeURIComponent(tokenOverrides.fontBody)}:wght@400;500;600;700` : ""}&display=swap" rel="stylesheet">
  <style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f8fafc;color:#0f172a;line-height:1.6}
.frame{max-width:960px;margin:0 auto;padding:32px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.row{display:flex;gap:16px;margin-bottom:16px}
.row>.card{flex:1;margin:0}
h1{font-size:2rem;font-weight:700;margin-bottom:8px}
h2{font-size:1.25rem;font-weight:600;margin-bottom:6px}
h3{font-size:1rem;font-weight:600;margin-bottom:4px}
p,.desc{color:#64748b;font-size:.875rem}
.sm{font-size:.875rem}.xs{font-size:.75rem}
.muted{color:#64748b}
.bold{font-weight:700}.medium{font-weight:500}
.badge{display:inline-block;padding:2px 10px;border-radius:9999px;font-size:.75rem;font-weight:500;margin-right:4px}
.b-blue{background:#eff6ff;color:#1e40af}.b-green{background:#f0fdf4;color:#166534}
.b-gray{background:#f1f5f9;color:#475569}.b-red{background:#fef2f2;color:#991b1b}
.b-purple{background:#faf5ff;color:#6b21a8}.b-amber{background:#fffbeb;color:#92400e}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:.875rem;font-weight:500;cursor:pointer;border:none}
.btn-p{background:#3b82f6;color:#fff}.btn-o{background:#fff;color:#0f172a;border:1px solid #e2e8f0}
.btn-g{background:transparent;color:#64748b}
.nav{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid #e2e8f0;margin-bottom:24px}
.nav-r{display:flex;gap:8px}
.hero{text-align:center;padding:48px 0}
.hero h1{font-size:2.25rem}.hero p{max-width:560px;margin:8px auto 20px;font-size:1rem}
.hero-a{display:flex;gap:12px;justify-content:center}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:20px}
.stat-v{font-size:1.5rem;font-weight:700}.stat-l{font-size:.75rem;color:#64748b}
.stat-c{font-size:.75rem}.up{color:#16a34a}.dn{color:#dc2626}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;font-size:.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0}
td{padding:10px 12px;font-size:.875rem;border-bottom:1px solid #f1f5f9}
.inp{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:.875rem;background:#fff}
.avatar{width:36px;height:36px;border-radius:50%;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:600;color:#64748b;flex-shrink:0}
.divider{height:1px;background:#e2e8f0;margin:24px 0}
.footer{padding:20px 0;border-top:1px solid #e2e8f0;margin-top:32px;display:flex;justify-content:space-between;color:#94a3b8;font-size:.75rem}
.tabs{display:flex;gap:0;border-bottom:1px solid #e2e8f0;margin-bottom:16px}
.tab{padding:8px 16px;font-size:.875rem;color:#64748b;cursor:pointer;border-bottom:2px solid transparent}
.tab.active{color:#3b82f6;border-bottom-color:#3b82f6;font-weight:500}
.section-h{font-size:.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:12px}
.chat-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:12px}
.chat-bubble{padding:10px 14px;border-radius:12px;font-size:.875rem;max-width:70%}
.chat-ai{background:#f1f5f9;color:#0f172a}.chat-user{background:#3b82f6;color:#fff;margin-left:auto}
.switch{width:36px;height:20px;background:#e2e8f0;border-radius:10px;position:relative;display:inline-block}
.switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%}
.switch.on{background:#3b82f6}.switch.on::after{left:18px}
  </style>
${overrideCss}
</head>
<body><div class="frame">${visual}</div></body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;
  const [, r, g, b] = match.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function colorLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorSaturation(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

interface DesignTokens {
  primary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
  headingFont?: string;
  bodyFont?: string;
}

function extractDesignTokens(sourceCode: string): DesignTokens {
  // First try: extract from the theme const in the source code
  const themeMatch = sourceCode.match(/const theme\s*=\s*\{([^}]+)\}/);
  if (themeMatch) {
    const themeBlock = themeMatch[1];
    const extract = (key: string): string | undefined => {
      const m = themeBlock.match(new RegExp(`${key}:\\s*"([^"]+)"`));
      return m ? m[1] : undefined;
    };
    return {
      primary: extract("primary"),
      accent: extract("accent"),
      background: extract("background"),
      surface: extract("surface"),
      text: extract("text"),
      muted: extract("muted"),
      headingFont: extract("headingFont"),
      bodyFont: extract("bodyFont"),
    };
  }

  // Fallback: extract from @design block in meta comment
  const designMatch = sourceCode.match(/@design[\s\S]*?\*\//);
  if (!designMatch) return {};

  const block = designMatch[0];
  const fontsMatch = block.match(/fonts:\s*\[([^\]]+)\]/);
  const colorsMatch = block.match(/colors:\s*\[([^\]]+)\]/);

  const fonts = fontsMatch
    ? fontsMatch[1].split(",").map((f) => f.trim())
    : [];
  const rawColors = colorsMatch
    ? colorsMatch[1].split(/,\s*(?=rgb)/).map((c) => c.trim())
    : [];

  // Convert to hex
  const hexColors = rawColors
    .map((c) => (c.startsWith("rgb") ? rgbToHex(c) : c))
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));

  if (hexColors.length === 0 && fonts.length === 0) return {};

  // Derive semantic tokens
  const saturated = hexColors.filter((c) => colorSaturation(c) > 0.3).sort((a, b) => colorSaturation(b) - colorSaturation(a));
  const light = hexColors.filter((c) => colorLuminance(c) > 0.7).sort((a, b) => colorLuminance(b) - colorLuminance(a));
  const dark = hexColors.filter((c) => colorLuminance(c) < 0.3).sort((a, b) => colorLuminance(a) - colorLuminance(b));

  return {
    primary: saturated[0],
    accent: saturated[1] || saturated[0],
    background: light[0] || "#ffffff",
    surface: light[1] || light[0] || "#f8f8f8",
    text: dark[0] || "#1a1a1a",
    muted: hexColors.find((c) => colorLuminance(c) > 0.3 && colorLuminance(c) < 0.6 && colorSaturation(c) < 0.2),
    headingFont: fonts[0],
    bodyFont: fonts[1] || fonts[0],
  };
}

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function titleCase(s: string): string {
  return s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function extractQuotes(src: string): string[] {
  return (src.match(/"([^"]{3,60})"/g) || []).map(m => m.slice(1,-1)).filter(s => !/import|from|reshaped|react|\.tsx|\.ts|\.js|function|const|let|var|export|default|type|interface/.test(s));
}

/**
 * Converts Reshaped JSX source code to plain HTML for iframe preview.
 * Parses the component's JSX and converts View/Text/Card/Button/etc to HTML divs with inline styles.
 */
function jsxToHtml(src: string, _tokens: DesignTokens): string | null {
  // Only attempt for templates with a theme const (AI-generated imports)
  if (!src.includes("const theme =")) return null;

  // Extract the JSX body between return ( ... )
  const returnMatch = src.match(/return\s*\(\s*([\s\S]*)\s*\);\s*\}/);
  if (!returnMatch) return null;

  let jsx = returnMatch[1];

  // Extract theme values from source
  const themeVals: Record<string, string> = {};
  const themeBlock = src.match(/const theme\s*=\s*\{([^}]+)\}/);
  if (themeBlock) {
    const entries = themeBlock[1].matchAll(/(\w+):\s*"([^"]+)"/g);
    for (const m of entries) {
      themeVals[m[1]] = m[2];
    }
  }

  // Replace theme.X references with actual values
  for (const [key, val] of Object.entries(themeVals)) {
    jsx = jsx.replace(new RegExp(`theme\\.${key}`, "g"), `"${val}"`);
  }

  // Remove JSX comments {/* ... */}
  jsx = jsx.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // Convert Reshaped components to HTML
  // Container -> div
  jsx = jsx.replace(/<Container[^>]*>/g, '<div style="max-width:960px;margin:0 auto">');
  jsx = jsx.replace(/<\/Container>/g, "</div>");

  // View -> div with flex
  jsx = jsx.replace(/<View\s+([^>]*)>/g, (_, attrs) => {
    const styles: string[] = ["display:flex"];
    if (/direction="row"/.test(attrs)) styles.push("flex-direction:row");
    else styles.push("flex-direction:column");
    const gapMatch = attrs.match(/gap=\{(\d+)\}/);
    if (gapMatch) styles.push(`gap:${parseInt(gapMatch[1]) * 4}px`);
    if (/align="center"/.test(attrs)) styles.push("align-items:center");
    if (/justify="center"/.test(attrs)) styles.push("justify-content:center");
    if (/justify="space-between"/.test(attrs)) styles.push("justify-content:space-between");
    const padMatch = attrs.match(/padding=\{(\d+)\}/);
    if (padMatch) styles.push(`padding:${parseInt(padMatch[1]) * 4}px`);
    // Extract inline style
    const styleMatch = attrs.match(/style=\{\{([^}]+)\}\}/);
    if (styleMatch) {
      const inlineStyles = styleMatch[1]
        .replace(/,\s*$/,"")
        .split(",")
        .map((s: string) => {
          const [k, v] = s.split(":").map((x: string) => x.trim());
          if (!k || !v) return "";
          const cssKey = k.replace(/([A-Z])/g, "-$1").toLowerCase();
          const cssVal = v.replace(/"/g, "").replace(/'/g, "");
          return `${cssKey}:${cssVal}`;
        })
        .filter(Boolean);
      styles.push(...inlineStyles);
    }
    return `<div style="${styles.join(";")}">`;
  });
  jsx = jsx.replace(/<\/View>/g, "</div>");

  // Text -> span/p/h with styling
  jsx = jsx.replace(/<Text\s+([^>]*)>([\s\S]*?)<\/Text>/g, (_, attrs, content) => {
    const isTitle = /variant="title-[345]"/.test(attrs);
    const isBold = /weight="bold"/.test(attrs);
    const tag = isTitle ? (/title-3/.test(attrs) ? "h1" : /title-4/.test(attrs) ? "h2" : "h3") : "p";
    const styles: string[] = [];
    if (isBold) styles.push("font-weight:700");
    if (/variant="caption"/.test(attrs)) styles.push("font-size:0.75rem");
    if (/variant="body-2"/.test(attrs)) styles.push("font-size:0.875rem");
    // Extract inline style
    const styleMatch = attrs.match(/style=\{\{([^}]+)\}\}/);
    if (styleMatch) {
      const inlineStyles = styleMatch[1]
        .replace(/,\s*$/,"")
        .split(",")
        .map((s: string) => {
          const [k, v] = s.split(":").map((x: string) => x.trim());
          if (!k || !v) return "";
          const cssKey = k.replace(/([A-Z])/g, "-$1").toLowerCase();
          const cssVal = v.replace(/"/g, "").replace(/'/g, "");
          return `${cssKey}:${cssVal}`;
        })
        .filter(Boolean);
      styles.push(...inlineStyles);
    }
    const styleStr = styles.length ? ` style="${styles.join(";")}"` : "";
    return `<${tag}${styleStr}>${content.trim()}</${tag}>`;
  });

  // Card -> div.card
  jsx = jsx.replace(/<Card\s+([^>]*)>/g, (_, attrs) => {
    const styles: string[] = ["background:#fff", "border:1px solid #e2e8f0", "border-radius:12px", "box-shadow:0 1px 3px rgba(0,0,0,.04)"];
    const padMatch = attrs.match(/padding=\{(\d+)\}/);
    if (padMatch) styles.push(`padding:${parseInt(padMatch[1]) * 4}px`);
    const styleMatch = attrs.match(/style=\{\{([^}]+)\}\}/);
    if (styleMatch) {
      const inlineStyles = styleMatch[1]
        .replace(/,\s*$/,"")
        .split(",")
        .map((s: string) => {
          const [k, v] = s.split(":").map((x: string) => x.trim());
          if (!k || !v) return "";
          const cssKey = k.replace(/([A-Z])/g, "-$1").toLowerCase();
          const cssVal = v.replace(/"/g, "").replace(/'/g, "");
          return `${cssKey}:${cssVal}`;
        })
        .filter(Boolean);
      styles.push(...inlineStyles);
    }
    return `<div style="${styles.join(";")}">`;
  });
  jsx = jsx.replace(/<\/Card>/g, "</div>");

  // Button -> button
  jsx = jsx.replace(/<Button\s+([^>]*)>([\s\S]*?)<\/Button>/g, (_, attrs, content) => {
    const isSolid = /variant="solid"/.test(attrs);
    const styles: string[] = ["display:inline-flex", "align-items:center", "gap:6px", "padding:8px 16px", "border-radius:8px", "font-size:0.875rem", "font-weight:500", "cursor:pointer", "border:none"];
    if (isSolid) {
      styles.push(`background:${themeVals.primary || "#3b82f6"}`, "color:#fff");
    } else {
      styles.push("background:transparent", `color:${themeVals.text || "#333"}`, "border:1px solid #e2e8f0");
    }
    const styleMatch = attrs.match(/style=\{\{([^}]+)\}\}/);
    if (styleMatch) {
      const inlineStyles = styleMatch[1]
        .replace(/,\s*$/,"")
        .split(",")
        .map((s: string) => {
          const [k, v] = s.split(":").map((x: string) => x.trim());
          if (!k || !v) return "";
          const cssKey = k.replace(/([A-Z])/g, "-$1").toLowerCase();
          const cssVal = v.replace(/"/g, "").replace(/'/g, "");
          return `${cssKey}:${cssVal}`;
        })
        .filter(Boolean);
      styles.push(...inlineStyles);
    }
    return `<button style="${styles.join(";")}">${content.trim()}</button>`;
  });

  // Badge -> span
  jsx = jsx.replace(/<Badge\s+([^>]*)>([\s\S]*?)<\/Badge>/g, (_, _attrs, content) => {
    return `<span class="badge b-gray">${content.trim()}</span>`;
  });

  // Divider -> hr
  jsx = jsx.replace(/<Divider\s*\/>/g, '<div class="divider"></div>');

  // TextField -> input
  jsx = jsx.replace(/<TextField\s+([^>]*?)\/>/g, (_, attrs) => {
    const nameMatch = attrs.match(/name="([^"]+)"/);
    const placeholderMatch = attrs.match(/placeholder="([^"]+)"/);
    const isMultiline = /multiline/.test(attrs);
    if (isMultiline) {
      return `<textarea class="inp" rows="3" placeholder="${placeholderMatch?.[1] || ""}" style="resize:none"></textarea>`;
    }
    return `<input class="inp" name="${nameMatch?.[1] || ""}" placeholder="${placeholderMatch?.[1] || ""}"/>`;
  });

  // Clean up remaining JSX artifacts
  jsx = jsx.replace(/\{`[^`]*`\}/g, ""); // template literals
  jsx = jsx.replace(/\{[^}]*\}/g, ""); // remaining JSX expressions

  return jsx;
}

function buildVisualPreview(src: string, meta: any): string {
  // For imported templates with AI-generated code, convert JSX to HTML directly
  const tokens = extractDesignTokens(src);
  const jsxHtml = jsxToHtml(src, tokens);
  if (jsxHtml) {
    // Add footer
    const cat = meta.category || "";
    const nm = meta.name || "";
    return jsxHtml + `\n<div class="footer"><span>${esc(cat)} / ${esc(nm)}</span><span>${esc(meta.source || "")}</span></div>`;
  }

  // FALLBACK: Pattern-based preview for non-imported templates
  const cat = meta.category || "";
  const nm = meta.name || "";
  const desc = meta.description || "";
  const tags: string[] = meta.tags || [];
  const quotes = extractQuotes(src);
  const titles = quotes.filter(s => s.length < 35 && /^[A-Z]/.test(s));
  const parts: string[] = [];

  // Detect patterns
  const isDash = /dashboard|analytics|admin|overview/i.test(nm + cat);
  const isAuth = /login|signup|sign.?up|forgot|password/i.test(nm);
  const isLanding = /landing|hero|website|agency|saas|startup/i.test(nm + cat);
  const isChat = /chat|message|thread|chatbot/i.test(nm);
  const isTable = /table|list|invoice|user.?manage/i.test(nm);
  const isForm = /form|setting|wizard|contact|edit/i.test(nm);
  const isPricing = /pricing|price|plan/i.test(nm);
  const isPortfolio = /portfolio|resume|blog/i.test(nm + cat);
  const isEcom = /store|shop|product|cart|checkout|ecommerce/i.test(nm + cat);

  // Nav
  parts.push(`<div class="nav"><span class="bold">${esc(titleCase(nm))}</span><div class="nav-r"><button class="btn btn-g">Features</button><button class="btn btn-g">About</button><button class="btn btn-p">Get Started</button></div></div>`);

  // Dashboard
  if (isDash) {
    const stats = extractStats(src) || [{l:"Revenue",v:"$48,200",c:"+12.5%"},{l:"Users",v:"2,847",c:"+8.1%"},{l:"Conversion",v:"3.24%",c:"-0.4%"},{l:"Sessions",v:"12.4K",c:"+5.2%"}];
    parts.push(`<div class="g4">${stats.map(s => `<div class="card"><div class="stat-l">${esc(s.l)}</div><div class="stat-v">${esc(s.v)}</div><div class="stat-c ${s.c.startsWith("+")?"up":"dn"}">${esc(s.c)}</div></div>`).join("")}</div>`);
    parts.push(`<div class="card"><div class="tabs"><span class="tab active">Overview</span><span class="tab">Analytics</span><span class="tab">Reports</span></div><div style="height:160px;background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:.875rem">Chart Area</div></div>`);
    parts.push(buildTable());
  }
  // Auth
  else if (isAuth) {
    parts.push(`<div style="max-width:400px;margin:40px auto"><div class="card" style="padding:32px"><h2 style="text-align:center;margin-bottom:24px">${/signup|sign.?up/i.test(nm) ? "Create Account" : "Welcome Back"}</h2><div style="display:flex;flex-direction:column;gap:12px"><div><label class="xs muted" style="display:block;margin-bottom:4px">Email</label><input class="inp" placeholder="you@example.com"/></div><div><label class="xs muted" style="display:block;margin-bottom:4px">Password</label><input class="inp" type="password" placeholder="••••••••"/></div>${/signup|sign.?up/i.test(nm) ? '<div><label class="xs muted" style="display:block;margin-bottom:4px">Confirm Password</label><input class="inp" type="password" placeholder="••••••••"/></div>' : '<div style="display:flex;justify-content:space-between;align-items:center"><label style="display:flex;align-items:center;gap:6px;font-size:.875rem"><input type="checkbox"/> Remember me</label><a href="#" style="font-size:.875rem;color:#3b82f6">Forgot password?</a></div>'}<button class="btn btn-p" style="width:100%;justify-content:center;padding:10px">${/signup/i.test(nm) ? "Sign Up" : "Sign In"}</button></div><div class="divider"></div><p style="text-align:center;font-size:.875rem;color:#64748b">${/signup/i.test(nm) ? "Already have an account?" : "Don't have an account?"} <a href="#" style="color:#3b82f6">Click here</a></p></div></div>`);
  }
  // Landing
  else if (isLanding || isPortfolio) {
    const heroTitle = titles[0] || titleCase(nm);
    parts.push(`<div class="hero"><span class="badge b-blue">New</span><h1>${esc(heroTitle)}</h1><p>${esc(desc)}</p><div class="hero-a"><button class="btn btn-p">Get Started</button><button class="btn btn-o">Learn More</button></div></div><div class="divider"></div>`);
    parts.push(`<div class="section-h">Features</div><div class="g3">${["Fast & Reliable","Easy to Use","Secure by Design"].map((f,i) => `<div class="card"><span class="badge ${["b-blue","b-green","b-purple"][i]}">${["Speed","UX","Security"][i]}</span><h3 style="margin-top:12px">${f}</h3><p style="margin-top:8px">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod.</p></div>`).join("")}</div>`);
  }
  // Chat
  else if (isChat) {
    parts.push(`<div class="card" style="max-width:640px;margin:0 auto"><h2 style="margin-bottom:16px">Messages</h2><div class="chat-row"><div class="avatar">AI</div><div class="chat-bubble chat-ai">Hello! How can I help you today?</div></div><div class="chat-row" style="justify-content:flex-end"><div class="chat-bubble chat-user">Show me the dashboard templates</div><div class="avatar">You</div></div><div class="chat-row"><div class="avatar">AI</div><div class="chat-bubble chat-ai">Here are 6 dashboard templates available in the library. Would you like to preview any?</div></div><div style="margin-top:16px;display:flex;gap:8px"><input class="inp" style="flex:1" placeholder="Type a message..."/><button class="btn btn-p">Send</button></div></div>`);
  }
  // Table
  else if (isTable) {
    parts.push(`<div class="row"><div class="card" style="flex:1"><h2>All Items</h2><p class="muted xs">${desc}</p></div><button class="btn btn-p" style="align-self:start;margin-top:20px">Add New</button></div>`);
    parts.push(buildTable());
  }
  // E-commerce
  else if (isEcom) {
    if (/cart|checkout/i.test(nm)) {
      parts.push(`<h2 class="mb-4">Shopping Cart</h2>`);
      parts.push(`<div class="g2"><div>${buildTable()}</div><div class="card"><h3>Order Summary</h3><div style="margin-top:12px"><div class="row" style="justify-content:space-between"><span class="sm muted">Subtotal</span><span class="sm bold">$299.00</span></div><div class="row" style="justify-content:space-between"><span class="sm muted">Shipping</span><span class="sm bold">$9.99</span></div><div class="divider" style="margin:12px 0"></div><div class="row" style="justify-content:space-between"><span class="bold">Total</span><span class="bold">$308.99</span></div><button class="btn btn-p" style="width:100%;justify-content:center;margin-top:16px">Checkout</button></div></div></div>`);
    } else {
      parts.push(`<div class="hero" style="padding:32px 0"><h1>${esc(titleCase(nm))}</h1><p>${esc(desc)}</p></div>`);
      parts.push(`<div class="g3">${[1,2,3].map(i => `<div class="card" style="padding:0;overflow:hidden"><div style="height:160px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8">Product Image</div><div style="padding:16px"><h3>Product ${i}</h3><p class="muted sm" style="margin:4px 0">Product description</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="bold">$${i * 29 + 20}</span><button class="btn btn-p" style="padding:6px 12px;font-size:.75rem">Add to Cart</button></div></div></div>`).join("")}</div>`);
    }
  }
  // Form / Settings
  else if (isForm) {
    parts.push(`<div class="card"><h2>${esc(titleCase(nm))}</h2><p class="muted sm" style="margin-bottom:20px">${esc(desc)}</p><div class="g2"><div><label class="xs muted" style="display:block;margin-bottom:4px">Full Name</label><input class="inp" value="John Doe"/></div><div><label class="xs muted" style="display:block;margin-bottom:4px">Email</label><input class="inp" value="john@example.com"/></div></div><div style="margin-top:16px"><label class="xs muted" style="display:block;margin-bottom:4px">Description</label><textarea class="inp" rows="3" style="resize:none">Enter description here...</textarea></div><div style="margin-top:16px;display:flex;gap:12px;justify-content:flex-end"><button class="btn btn-o">Cancel</button><button class="btn btn-p">Save Changes</button></div></div>`);
    if (/setting/i.test(nm)) {
      parts.push(`<div class="card"><h3>Notifications</h3><div style="margin-top:12px">${["Email notifications","Push notifications","Weekly digest"].map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9"><span class="sm">${s}</span><span class="switch on"></span></div>`).join("")}</div></div>`);
    }
  }
  // Pricing
  else if (isPricing) {
    parts.push(`<div class="hero" style="padding:32px 0"><h1>Pricing</h1><p>Choose the plan that works for you</p></div>`);
    parts.push(`<div class="g3">${[{n:"Starter",p:"$9",pop:false},{n:"Pro",p:"$29",pop:true},{n:"Enterprise",p:"$99",pop:false}].map(pl => `<div class="card" style="${pl.pop ? "border-color:#3b82f6;box-shadow:0 4px 12px rgba(59,130,246,.15)" : ""}">${pl.pop ? '<span class="badge b-blue" style="display:block;text-align:center;margin-bottom:8px">Most Popular</span>' : ""}<h2 style="text-align:center">${pl.n}</h2><div style="text-align:center;font-size:2.5rem;font-weight:700;margin:12px 0">${pl.p}<span class="muted sm">/mo</span></div><ul style="list-style:none;padding:0;margin:0 0 20px">${["Feature one","Feature two","Feature three","Priority support"].map(f => `<li style="padding:6px 0;font-size:.875rem;color:#475569">✓ ${f}</li>`).join("")}</ul><button class="btn ${pl.pop ? "btn-p" : "btn-o"}" style="width:100%;justify-content:center">Choose ${pl.n}</button></div>`).join("")}</div>`);
  }
  // Generic fallback
  else {
    parts.push(`<div class="hero" style="padding:24px 0"><h1>${esc(titleCase(nm))}</h1><p>${esc(desc)}</p><div style="margin-top:12px">${tags.map(t => `<span class="badge b-gray">${esc(t)}</span>`).join("")}</div></div><div class="divider"></div>`);
    const cardTitles = titles.length >= 3 ? titles.slice(0,3) : ["Section One","Section Two","Section Three"];
    parts.push(`<div class="g3">${cardTitles.map(t => `<div class="card"><h3>${esc(t)}</h3><p style="margin-top:8px">Content for this section. Replace with actual content.</p></div>`).join("")}</div>`);
  }

  // Footer
  parts.push(`<div class="footer"><span>${esc(cat)} / ${esc(nm)}</span><span>${esc(meta.source || "")}</span></div>`);

  return parts.join("\n");
}

function extractStats(src: string): Array<{l:string;v:string;c:string}> | null {
  const pat = /label:\s*["']([^"']+)["'].*?value:\s*["']([^"']+)["'].*?change:\s*["']([^"']+)["']/gs;
  const r: Array<{l:string;v:string;c:string}> = [];
  let m;
  while ((m = pat.exec(src)) !== null) r.push({l:m[1],v:m[2],c:m[3]});
  return r.length >= 2 ? r.slice(0,4) : null;
}

function buildTable(): string {
  return `<div class="card" style="padding:0;overflow:hidden"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody><tr><td><div style="display:flex;align-items:center;gap:8px"><span class="avatar">SC</span>Sarah Chen</div></td><td class="muted sm">sarah@example.com</td><td class="sm">Admin</td><td><span class="badge b-green">Active</span></td></tr><tr><td><div style="display:flex;align-items:center;gap:8px"><span class="avatar">JW</span>James Wilson</div></td><td class="muted sm">james@example.com</td><td class="sm">Editor</td><td><span class="badge b-green">Active</span></td></tr><tr><td><div style="display:flex;align-items:center;gap:8px"><span class="avatar">MG</span>Maria Garcia</div></td><td class="muted sm">maria@example.com</td><td class="sm">Viewer</td><td><span class="badge b-gray">Inactive</span></td></tr></tbody></table></div>`;
}

export default router;
