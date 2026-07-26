/**
 * templateGenerator.ts
 *
 * Fetches a URL, parses its HTML structure, and generates a Reshaped template
 * that reflects the actual page layout and content.
 *
 * SAFE Reshaped API (verified exports):
 * - View: direction, gap, align, justify, padding, grow, overflow, style
 * - Text: variant (title-3..6, body-1..3, caption-1..2), weight, color, style
 * - Card: padding, style
 * - Container: width
 * - Button: variant (solid/outline/ghost/faded), color, size
 * - Badge: color, variant, size
 * - Divider
 * - Tabs, Tabs.List, Tabs.Item, Tabs.Panel
 * - TextField, Select, Switch, Alert, Avatar, Table
 *
 * DO NOT use: Icon imports, as prop, textAlign, maxWidth, paddingBlock,
 *             wrap, borderWidth, backgroundColor (on View), display-*
 */

import { parse as parseHtml } from "node-html-parser";
import { sanitizeUrl, sanitizePathParam, fetchNoRebind } from "./sanitize";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Checks if HTML is likely a challenge/protection page rather than real content.
 */
function isChallengePage(html: string): boolean {
  const lower = html.toLowerCase();
  const markers = [
    "just a moment",
    "checking your browser",
    "cf-browser-verification",
    "challenge-platform",
    "enable javascript and cookies",
    "_cf_chl",
    "cloudflare",
    "ddos-guard",
    "attention required",
  ];
  const hasMarker = markers.some((m) => lower.includes(m));
  // Also flag pages with very little text content
  // Iterate the tag strip: removing one tag can join the surrounding text into
  // a new one, so `<<a>a href=x>` is not cleared in a single pass. This only
  // feeds a length heuristic rather than any output, but an under-stripped
  // string inflates the count and can mask a block page
  // (CodeQL js/incomplete-multi-character-sanitization).
  let stripped = html;
  let previousStripped: string;
  do {
    previousStripped = stripped;
    stripped = stripped.replace(/<[^>]+>/g, "");
  } while (stripped !== previousStripped);
  const textContent = stripped.replace(/\s+/g, " ").trim();
  const tooShort = textContent.length < 200;
  return hasMarker || tooShort;
}

interface RenderedPage {
  html: string;
  colors: string[];
  brandColors: string[];
  fonts: string[];
  computedStyles: Record<string, string>;
}

/**
 * Uses Playwright to render a page with JavaScript execution and extract
 * the full DOM, computed colors, and font information.
 */
async function fetchWithBrowser(url: string): Promise<RenderedPage> {
  let chromium;
  try {
    const pw = await import("playwright-core");
    chromium = pw.chromium;
  } catch (e: any) {
    console.error("[import] Cannot load playwright-core:", e?.message);
    return { html: "", colors: [], brandColors: [], fonts: [], computedStyles: {} };
  }

  let browser;
  try {
    console.log("[import] Launching browser for", url);
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait a bit for any remaining JS rendering
    await page.waitForTimeout(2000);

    // Extract rendered HTML
    const html = await page.content();

    // Extract design tokens — use page.evaluate with a string expression
    // to avoid tsx/esbuild transforming the callback and injecting __name
    const designData = await page.evaluate(`(() => {
      const colorCounts = {};
      const brandColors = [];
      const fonts = new Set();
      const styles = {};

      function addColor(c, weight) {
        if (!c || c === "rgba(0, 0, 0, 0)" || c === "transparent") return;
        colorCounts[c] = (colorCounts[c] || 0) + weight;
      }

      // HIGH PRIORITY: nav, header, logo area
      document.querySelectorAll("nav, header, [class*=logo], [class*=brand], [class*=navbar], [class*=header]").forEach(function(el) {
        var cs = window.getComputedStyle(el);
        addColor(cs.backgroundColor, 10);
        addColor(cs.color, 5);
        el.querySelectorAll("a, span, svg, img, div").forEach(function(child) {
          var ccs = window.getComputedStyle(child);
          addColor(ccs.backgroundColor, 8);
          addColor(ccs.color, 6);
        });
      });

      // HIGH PRIORITY: SVG fills (logos)
      document.querySelectorAll("svg path, svg rect, svg circle, svg polygon").forEach(function(el) {
        var fill = el.getAttribute("fill");
        if (fill && fill !== "none" && fill !== "currentColor" && fill.indexOf("url") !== 0) {
          brandColors.push(fill);
        }
      });

      // MEDIUM PRIORITY: buttons, CTAs
      document.querySelectorAll("button, [class*=btn], [class*=cta], a[class*=button], [role=button]").forEach(function(el) {
        var cs = window.getComputedStyle(el);
        addColor(cs.backgroundColor, 6);
        addColor(cs.color, 3);
      });

      // MEDIUM PRIORITY: headings
      document.querySelectorAll("h1, h2, h3").forEach(function(el) {
        addColor(window.getComputedStyle(el).color, 4);
      });

      // LOW PRIORITY: sections
      document.querySelectorAll("section, main, footer, p").forEach(function(el) {
        var cs = window.getComputedStyle(el);
        addColor(cs.backgroundColor, 2);
        addColor(cs.color, 1);
      });

      // Links — very low weight
      document.querySelectorAll("a").forEach(function(el) {
        addColor(window.getComputedStyle(el).color, 0.5);
      });

      // Fonts
      document.querySelectorAll("body, h1, h2, h3, nav, p").forEach(function(el) {
        var font = window.getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/['"]/g, "");
        if (font) fonts.add(font);
      });

      // Body styles
      var bodyCs = window.getComputedStyle(document.body);
      styles.bodyBg = bodyCs.backgroundColor;
      styles.bodyColor = bodyCs.color;
      styles.bodyFont = bodyCs.fontFamily;

      // Heading font
      var h1 = document.querySelector("h1");
      if (h1) {
        var h1Cs = window.getComputedStyle(h1);
        styles.headingFont = h1Cs.fontFamily;
        styles.headingColor = h1Cs.color;
      }

      // Sort by weight
      var sortedColors = Object.entries(colorCounts)
        .sort(function(a, b) { return b[1] - a[1]; })
        .map(function(e) { return e[0]; });

      return {
        colors: sortedColors,
        brandColors: brandColors,
        fonts: Array.from(fonts),
        styles: styles
      };
    })()`);

    await browser.close();

    return {
      html,
      colors: designData.colors,
      brandColors: designData.brandColors || [],
      fonts: designData.fonts,
      computedStyles: designData.styles,
    };
  } catch (err: any) {
    console.error("[import] Browser rendering failed:", err?.message || err);
    if (browser) await browser.close().catch(() => {});
    return { html: "", colors: [], brandColors: [], fonts: [], computedStyles: {} };
  }
}

/**
 * Escapes extracted text to prevent JSX/JS injection when interpolated
 * into generated .tsx template strings.
 */
function escapeTemplateText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/`/g, "")
    .replace(/\$\{/g, "");
}

function toPascalCase(str: string): string {
  const pascalName = str
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  return pascalName;
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function cleanText(text: string): string {
  return escapeTemplateText(text.replace(/\s+/g, " ").trim().slice(0, 120));
}

interface PageSection {
  type: "nav" | "hero" | "features" | "content" | "cta" | "footer" | "form" | "stats" | "testimonials" | "pricing";
  heading?: string;
  text?: string;
  items?: string[];
  links?: string[];
}

function analyzeHtml(html: string): {
  title: string;
  sections: PageSection[];
  navLinks: string[];
  headings: string[];
  images: number;
  forms: number;
  buttons: string[];
  stats: string[];
  extractedColors?: string[];
  extractedFonts?: string[];
  brandColors?: string[];
  computedStyles?: Record<string, string>;
} {
  const root = parseHtml(html);

  // Extract title
  const titleEl = root.querySelector("title");
  const title = titleEl ? cleanText(titleEl.text) : "";

  // Nav links
  const navEls = root.querySelectorAll("nav a, header a, [role=navigation] a");
  const navLinks = [...new Set(navEls.map((a) => cleanText(a.text)).filter((t) => t.length > 0 && t.length < 30))].slice(0, 8);

  // All headings
  const headingEls = root.querySelectorAll("h1, h2, h3, h4");
  const headings = headingEls.map((h) => cleanText(h.text)).filter((t) => t.length > 2).slice(0, 15);

  // Buttons
  const buttonEls = root.querySelectorAll("button, a[class*=btn], a[class*=button], [role=button]");
  const buttons = [...new Set(buttonEls.map((b) => cleanText(b.text)).filter((t) => t.length > 0 && t.length < 40))].slice(0, 10);

  // Images count
  const images = root.querySelectorAll("img, picture, [role=img], svg").length;

  // Forms count
  const forms = root.querySelectorAll("form, input[type=email], input[type=text]").length;

  // Look for stat-like numbers
  const allText = root.text;
  const statMatches = allText.match(/\d+[,.]?\d*[+%kKmMbB]?\s*(?:users?|customers?|downloads?|projects?|years?|countries|clients|reviews?|stars?|employees?)/gi) || [];
  const stats = [...new Set(statMatches.map((s) => s.trim()))].slice(0, 6);

  // Build sections by analyzing page structure
  const sections: PageSection[] = [];

  // Detect hero (first h1 or large heading area)
  const h1 = root.querySelector("h1");
  if (h1) {
    const heroText = h1.parentNode ? cleanText(h1.parentNode.text).slice(0, 200) : "";
    sections.push({
      type: "hero",
      heading: cleanText(h1.text),
      text: heroText !== cleanText(h1.text) ? heroText : undefined,
    });
  }

  // Detect nav
  if (navLinks.length > 0) {
    sections.push({ type: "nav", links: navLinks });
  }

  // Detect feature sections (repeated card-like structures)
  const cardEls = root.querySelectorAll("[class*=card], [class*=feature], [class*=benefit], [class*=service]");
  if (cardEls.length >= 2) {
    const items = cardEls
      .map((el) => {
        const h = el.querySelector("h2, h3, h4, strong");
        return h ? cleanText(h.text) : "";
      })
      .filter((t) => t.length > 0)
      .slice(0, 6);
    if (items.length >= 2) {
      sections.push({ type: "features", items });
    }
  }

  // Detect pricing
  const pricingEls = root.querySelectorAll("[class*=price], [class*=pricing], [class*=plan]");
  if (pricingEls.length >= 2) {
    const items = pricingEls
      .map((el) => cleanText(el.text).slice(0, 60))
      .filter((t) => t.length > 0)
      .slice(0, 4);
    sections.push({ type: "pricing", items });
  }

  // Detect forms
  if (forms > 0) {
    sections.push({ type: "form" });
  }

  // Detect stats
  if (stats.length >= 2) {
    sections.push({ type: "stats", items: stats });
  }

  // Detect testimonials
  const testimonialEls = root.querySelectorAll("[class*=testimonial], [class*=review], [class*=quote], blockquote");
  if (testimonialEls.length >= 1) {
    const items = testimonialEls
      .map((el) => cleanText(el.text).slice(0, 100))
      .filter((t) => t.length > 10)
      .slice(0, 3);
    if (items.length > 0) {
      sections.push({ type: "testimonials", items });
    }
  }

  // Detect footer
  const footer = root.querySelector("footer");
  if (footer) {
    const footerLinks = footer.querySelectorAll("a")
      .map((a) => cleanText(a.text))
      .filter((t) => t.length > 0 && t.length < 30)
      .slice(0, 8);
    sections.push({ type: "footer", links: footerLinks });
  }

  // Remaining headings become content sections
  const usedHeadings = new Set(sections.filter((s) => s.heading).map((s) => s.heading));
  const remainingHeadings = headings.filter((h) => !usedHeadings.has(h)).slice(0, 4);
  for (const heading of remainingHeadings) {
    sections.push({ type: "content", heading });
  }

  // If we got nothing useful, add defaults
  if (sections.length === 0) {
    sections.push(
      { type: "hero", heading: title || "Welcome" },
      { type: "features", items: ["Feature One", "Feature Two", "Feature Three"] },
    );
  }

  return { title, sections, navLinks, headings, images, forms, buttons, stats };
}

/**
 * Converts an rgb(...) string to hex.
 */
function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;
  const [, r, g, b] = match.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Computes relative luminance of a hex color.
 */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Computes color saturation from hex.
 */
function saturation(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

interface Theme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
}

/**
 * Derives a semantic theme from extracted colors and fonts.
 * Colors are pre-sorted by visual prominence (most prominent first).
 * brandColors are SVG fills from logos and icons.
 */
function deriveTheme(
  colors: string[],
  fonts: string[],
  computedStyles: Record<string, string>,
  brandColors?: string[]
): Theme {
  // Convert all colors to hex
  const hexColors = colors
    .map((c) => (c.startsWith("rgb") ? rgbToHex(c) : c))
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));

  // Convert brand colors (SVG fills) to hex
  const hexBrandColors = (brandColors || [])
    .map((c) => (c.startsWith("rgb") ? rgbToHex(c) : c))
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
    .filter((c) => saturation(c) > 0.2 && luminance(c) > 0.1 && luminance(c) < 0.85);

  // Filter to only chromatic (saturated) colors, keeping prominence order
  const chromatic = hexColors.filter((c) => saturation(c) > 0.25 && luminance(c) > 0.1 && luminance(c) < 0.85);

  // Primary: first choice is brand color from SVG, second is most prominent chromatic color
  // This favors logo/header colors over generic link blues
  const primary = hexBrandColors[0] || chromatic[0] || "#3b82f6";

  // Accent: pick a different chromatic color than primary
  const accent = chromatic.find((c) => c !== primary) || hexBrandColors.find((c) => c !== primary) || primary;

  // Separate by luminance for bg/surface/text
  const light = hexColors.filter((c) => luminance(c) > 0.7).sort((a, b) => luminance(b) - luminance(a));
  const dark = hexColors.filter((c) => luminance(c) < 0.3).sort((a, b) => luminance(a) - luminance(b));

  const background = light[0] || "#ffffff";
  const surface = light[1] || light[0] || "#f8f8f8";
  const text = dark[0] || "#1a1a1a";
  const muted = hexColors.find((c) => luminance(c) > 0.3 && luminance(c) < 0.6 && saturation(c) < 0.2)
    || "#6b7280";

  // Fonts
  const headingFont = computedStyles.headingFont?.split(",")[0]?.trim()?.replace(/['"]/g, "")
    || fonts[0] || "inherit";
  const bodyFont = computedStyles.bodyFont?.split(",")[0]?.trim()?.replace(/['"]/g, "")
    || fonts[1] || fonts[0] || "inherit";

  return { primary, accent, background, surface, text, muted, headingFont, bodyFont };
}

function generateNavSection(links: string[], theme?: Theme): string {
  const t = theme;
  const navBg = t ? ` style={{ backgroundColor: "${t.primary}", padding: "12px 24px", borderRadius: 8 }}` : "";
  const linkStyle = t ? ` style={{ color: "${t.background}" }}` : "";
  const brandStyle = t ? ` style={{ color: "${t.background}", fontFamily: "${t.headingFont}" }}` : "";

  const linkButtons = links
    .slice(0, 5)
    .map((link) => t
      ? `            <Button variant="ghost"${linkStyle}>${link}</Button>`
      : `            <Button variant="ghost" color="neutral">${link}</Button>`)
    .join("\n");

  return `
        {/* Navigation */}
        <View direction="row" align="center" justify="space-between"${navBg}>
          <Text variant="title-5" weight="bold"${brandStyle}>{/* Logo */}Brand</Text>
          <View direction="row" gap={2}>
${linkButtons}
          </View>
        </View>
        <Divider />`;
}

function generateHeroSection(heading: string, text?: string, buttons?: string[], theme?: Theme): string {
  const t = theme;
  const heroBg = t ? ` style={{ backgroundColor: "${t.surface}", borderRadius: 12, padding: 40 }}` : "";
  const headingStyle = t ? ` style={{ textAlign: "center", color: "${t.text}", fontFamily: "${t.headingFont}" }}` : ` style={{ textAlign: "center" }}`;
  const subtextStyle = t ? ` style={{ textAlign: "center", maxWidth: 600, color: "${t.muted}", fontFamily: "${t.bodyFont}" }}` : ` style={{ textAlign: "center", maxWidth: 600 }}`;
  const primaryBtnStyle = t ? ` style={{ backgroundColor: "${t.primary}", color: "${t.background}", borderRadius: 6 }}` : "";
  const outlineBtnStyle = t ? ` style={{ borderColor: "${t.primary}", color: "${t.primary}", borderRadius: 6 }}` : "";

  const ctaButtons = (buttons && buttons.length > 0)
    ? buttons.slice(0, 2).map((b, i) =>
        i === 0
          ? `            <Button variant="solid" color="primary"${primaryBtnStyle}>${b}</Button>`
          : `            <Button variant="outline" color="primary"${outlineBtnStyle}>${b}</Button>`
      ).join("\n")
    : `            <Button variant="solid" color="primary"${primaryBtnStyle}>Get Started</Button>\n            <Button variant="outline" color="primary"${outlineBtnStyle}>Learn More</Button>`;

  return `
        {/* Hero */}
        <View gap={4} align="center"${heroBg}>
          <Text variant="title-3" weight="bold"${headingStyle}>${heading}</Text>${text ? `\n          <Text variant="body-1"${subtextStyle}>${text}</Text>` : ""}
          <View direction="row" gap={3}>
${ctaButtons}
          </View>
        </View>
        <Divider />`;
}

function generateFeaturesSection(items: string[], theme?: Theme): string {
  const t = theme;
  const cardStyle = t
    ? ` style={{ flex: 1, minWidth: 200, borderLeft: "3px solid ${t.primary}", backgroundColor: "${t.surface}" }}`
    : ` style={{ flex: 1, minWidth: 200 }}`;
  const titleStyle = t ? ` style={{ color: "${t.text}", fontFamily: "${t.headingFont}" }}` : "";
  const descStyle = t ? ` style={{ color: "${t.muted}", fontFamily: "${t.bodyFont}" }}` : "";
  const sectionTitleStyle = t ? ` style={{ color: "${t.primary}", fontFamily: "${t.headingFont}" }}` : "";

  const cards = items
    .map((item) => `              <Card key="${item}" padding={5}${cardStyle}>
                <View gap={2}>
                  <Text variant="body-1" weight="medium"${titleStyle}>${item}</Text>
                  <Text variant="body-2"${descStyle}>Description for ${item.toLowerCase()}.</Text>
                </View>
              </Card>`)
    .join("\n");

  return `
        {/* Features */}
        <View gap={4}>
          <Text variant="title-5" weight="bold"${sectionTitleStyle}>Features</Text>
          <View direction="row" gap={4} style={{ flexWrap: "wrap" }}>
${cards}
          </View>
        </View>
        <Divider />`;
}

function generateStatsSection(stats: string[], theme?: Theme): string {
  const t = theme;
  const numStyle = t ? ` style={{ color: "${t.primary}" }}` : "";
  const labelStyle = t ? ` style={{ color: "${t.muted}" }}` : "";
  const cardStyle = t ? ` style={{ flex: 1, minWidth: 140, backgroundColor: "${t.surface}" }}` : ` style={{ flex: 1, minWidth: 140 }}`;

  const cards = stats
    .map((stat) => {
      const numMatch = stat.match(/[\d,]+[+%kKmMbB]?/);
      const num = numMatch ? numMatch[0] : stat;
      const label = stat.replace(num, "").trim();
      return `              <Card padding={5}${cardStyle}>
                <View gap={1} align="center">
                  <Text variant="title-4" weight="bold"${numStyle}>${num}</Text>
                  <Text variant="caption-1"${labelStyle}>${label || "Metric"}</Text>
                </View>
              </Card>`;
    })
    .join("\n");

  return `
        {/* Stats */}
        <View direction="row" gap={4} style={{ flexWrap: "wrap" }}>
${cards}
        </View>
        <Divider />`;
}

function generateTestimonialsSection(items: string[], theme?: Theme): string {
  const t = theme;
  const cardStyle = t ? ` style={{ flex: 1, minWidth: 240, borderTop: "3px solid ${t.accent}", backgroundColor: "${t.surface}" }}` : ` style={{ flex: 1, minWidth: 240 }}`;
  const quoteStyle = t ? ` style={{ fontStyle: "italic", color: "${t.text}", fontFamily: "${t.bodyFont}" }}` : ` style={{ fontStyle: "italic" }}`;

  const cards = items
    .map((quote, i) => `              <Card padding={5}${cardStyle}>
                <View gap={3}>
                  <Text variant="body-2"${quoteStyle}>"${quote}"</Text>
                  <View direction="row" align="center" gap={2}>
                    <Badge color="neutral" variant="faded">Customer ${i + 1}</Badge>
                  </View>
                </View>
              </Card>`)
    .join("\n");

  return `
        {/* Testimonials */}
        <View gap={4}>
          <Text variant="title-5" weight="bold"${t ? ` style={{ color: "${t.primary}" }}` : ""}>What People Say</Text>
          <View direction="row" gap={4} style={{ flexWrap: "wrap" }}>
${cards}
          </View>
        </View>
        <Divider />`;
}

function generatePricingSection(items: string[], theme?: Theme): string {
  const t = theme;
  const cards = items
    .map((item, i) => {
      const priceMatch = item.match(/\$[\d,.]+/);
      const price = priceMatch ? priceMatch[0] : i === 0 ? "Free" : `$${(i + 1) * 19}/mo`;
      const isPopular = i === 1;
      const cardStyle = t
        ? isPopular
          ? ` style={{ flex: 1, minWidth: 200, border: "2px solid ${t.primary}", backgroundColor: "${t.surface}" }}`
          : ` style={{ flex: 1, minWidth: 200, backgroundColor: "${t.surface}" }}`
        : ` style={{ flex: 1, minWidth: 200 }}`;
      const btnStyle = t && isPopular ? ` style={{ backgroundColor: "${t.primary}", color: "${t.background}" }}` : "";
      return `              <Card padding={6}${cardStyle}>
                <View gap={3} align="center">
                  ${isPopular ? `<Badge color="primary" variant="solid"${t ? ` style={{ backgroundColor: "${t.accent}" }}` : ""}>Popular</Badge>` : ""}
                  <Text variant="title-5" weight="bold"${t ? ` style={{ color: "${t.text}" }}` : ""}>Plan ${i + 1}</Text>
                  <Text variant="title-4" weight="bold"${t ? ` style={{ color: "${t.primary}" }}` : ""}>${price}</Text>
                  <Button variant="${isPopular ? "solid" : "outline"}" color="primary"${btnStyle}>Choose Plan</Button>
                </View>
              </Card>`;
    })
    .join("\n");

  return `
        {/* Pricing */}
        <View gap={4}>
          <Text variant="title-5" weight="bold" style={{ textAlign: "center"${t ? `, color: "${t.primary}"` : ""} }}>Pricing</Text>
          <View direction="row" gap={4} style={{ flexWrap: "wrap" }}>
${cards}
          </View>
        </View>
        <Divider />`;
}

function generateFormSection(theme?: Theme): string {
  const t = theme;
  const cardStyle = t ? ` style={{ backgroundColor: "${t.surface}" }}` : "";
  const titleStyle = t ? ` style={{ color: "${t.text}", fontFamily: "${t.headingFont}" }}` : "";
  const btnStyle = t ? ` style={{ backgroundColor: "${t.primary}", color: "${t.background}" }}` : "";

  return `
        {/* Contact / Form */}
        <Card padding={6}${cardStyle}>
          <View gap={4}>
            <Text variant="title-5" weight="bold"${titleStyle}>Get in Touch</Text>
            <View direction="row" gap={4}>
              <View style={{ flex: 1 }}>
                <TextField name="name" placeholder="Your name" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField name="email" placeholder="Email address" />
              </View>
            </View>
            <TextField name="message" placeholder="Your message" multiline />
            <Button variant="solid" color="primary"${btnStyle}>Send Message</Button>
          </View>
        </Card>
        <Divider />`;
}

function generateContentSection(heading: string, theme?: Theme): string {
  const t = theme;
  const headStyle = t ? ` style={{ color: "${t.primary}", fontFamily: "${t.headingFont}" }}` : "";
  const bodyStyle = t ? ` style={{ color: "${t.muted}", fontFamily: "${t.bodyFont}" }}` : "";

  return `
        {/* ${heading} */}
        <View gap={3}>
          <Text variant="title-5" weight="bold"${headStyle}>${heading}</Text>
          <Text variant="body-1"${bodyStyle}>Content section for ${heading.toLowerCase()}. Replace with actual content from the source.</Text>
        </View>
        <Divider />`;
}

function generateFooterSection(links: string[], theme?: Theme): string {
  const t = theme;
  const footerBg = t ? ` style={{ backgroundColor: "${t.text}", borderRadius: 8, padding: "16px 24px" }}` : "";
  const footerTextStyle = t ? ` style={{ color: "${t.muted}" }}` : "";
  const linkStyle = t ? ` style={{ color: "${t.surface}" }}` : "";

  const linkEls = links.length > 0
    ? links.slice(0, 6).map((l) => `            <Text variant="caption-1"${linkStyle}>${l}</Text>`).join("\n")
    : `            <Text variant="caption-1"${linkStyle}>Privacy</Text>\n            <Text variant="caption-1"${linkStyle}>Terms</Text>\n            <Text variant="caption-1"${linkStyle}>Contact</Text>`;

  return `
        {/* Footer */}
        <View direction="row" justify="space-between" align="center" padding={4}${footerBg}>
          <Text variant="caption-1"${footerTextStyle}>All rights reserved.</Text>
          <View direction="row" gap={4}>
${linkEls}
          </View>
        </View>`;
}

/**
 * Downloads a single image from a URL and saves it to disk.
 * Returns the relative path (from assets dir) on success, or null on failure.
 */
async function downloadAsset(
  imageUrl: string,
  destDir: string,
  filename: string
): Promise<string | null> {
  try {
    const safeUrl = await sanitizeUrl(imageUrl);
    const controller = new AbortController();
    const timeout = setTimeout(function abortTimeout() { controller.abort(); }, 10000);
    // fetchNoRebind re-runs sanitizeUrl on every redirect hop; plain
    // redirect:"follow" would let a permitted host bounce us to 127.0.0.1
    // or a metadata endpoint with none of those checks reapplied
    // (CodeQL js/request-forgery).
    const resp = await fetchNoRebind(safeUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/*,*/*",
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.startsWith("image/") && !contentType.includes("svg")) {
      return null;
    }

    // Limit to 5MB per asset
    const contentLength = parseInt(resp.headers.get("content-length") || "0", 10);
    if (contentLength > 5 * 1024 * 1024) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024 || buffer.length === 0) return null;

    // Determine extension from content type
    let ext = ".png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = ".jpg";
    else if (contentType.includes("svg")) ext = ".svg";
    else if (contentType.includes("webp")) ext = ".webp";
    else if (contentType.includes("gif")) ext = ".gif";
    else if (contentType.includes("png")) ext = ".png";

    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "asset";
    const filePath = path.join(destDir, safeName + ext);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Extracts and downloads key assets (images, SVGs) from a rendered page.
 * Returns a list of saved file paths relative to the assets directory.
 */
async function capturePageAssets(
  page: any,
  url: string,
  templateName: string
): Promise<string[]> {
  const assetsDir = process.env.ASSETS_DIR || "/app/assets";
  const destDir = path.join(assetsDir, "imported", templateName);
  const savedPaths: string[] = [];

  try {
    // Ensure destination directory exists
    fs.mkdirSync(destDir, { recursive: true });

    // Extract image info and SVG markup from the page using a string template
    // to avoid tsx/esbuild __name transform issues
    const pageAssets: {
      images: Array<{ src: string; width: number; height: number; alt: string }>;
      svgs: Array<{ markup: string; width: number; height: number; id: string }>;
    } = await page.evaluate(`(function() {
      var images = [];
      var svgs = [];
      var seenSrcs = {};

      // Collect img elements with dimensions
      var imgEls = document.querySelectorAll("img");
      for (var i = 0; i < imgEls.length; i++) {
        var img = imgEls[i];
        var src = img.src || img.getAttribute("data-src") || "";
        if (!src || src.startsWith("data:") || seenSrcs[src]) continue;
        var rect = img.getBoundingClientRect();
        var w = rect.width || img.naturalWidth || 0;
        var h = rect.height || img.naturalHeight || 0;
        if (w < 50 || h < 50) continue;
        seenSrcs[src] = true;
        images.push({
          src: src,
          width: Math.round(w),
          height: Math.round(h),
          alt: (img.alt || "").slice(0, 100)
        });
      }

      // Sort by area descending (largest/most prominent first)
      images.sort(function(a, b) { return (b.width * b.height) - (a.width * a.height); });

      // Collect meaningful SVG elements (skip tiny icons under 50x50)
      var svgEls = document.querySelectorAll("svg");
      for (var j = 0; j < svgEls.length; j++) {
        var svg = svgEls[j];
        var svgRect = svg.getBoundingClientRect();
        var sw = svgRect.width || 0;
        var sh = svgRect.height || 0;
        if (sw < 50 || sh < 50) continue;
        // Check if SVG has meaningful content (not just empty or single-path decorations)
        var pathCount = svg.querySelectorAll("path, circle, rect, polygon, polyline, text, image").length;
        if (pathCount < 1) continue;
        var markup = svg.outerHTML;
        if (markup.length > 100000) continue; // skip absurdly large SVGs
        var svgId = svg.id || svg.getAttribute("aria-label") || ("svg-" + j);
        svgs.push({
          markup: markup,
          width: Math.round(sw),
          height: Math.round(sh),
          id: svgId
        });
      }

      return { images: images.slice(0, 15), svgs: svgs.slice(0, 10) };
    })()`);

    // Download top 10 raster images
    let imageCount = 0;
    for (const img of pageAssets.images) {
      if (imageCount >= 10) break;
      try {
        // Resolve relative URLs against the page URL
        let absoluteSrc = img.src;
        try {
          absoluteSrc = new URL(img.src, url).href;
        } catch {
          continue;
        }

        const altSlug = img.alt
          ? img.alt.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40)
          : "";
        const filename = altSlug
          ? "img-" + altSlug
          : "img-" + imageCount + "-" + img.width + "x" + img.height;

        const result = await downloadAsset(absoluteSrc, destDir, filename);
        if (result) {
          savedPaths.push(path.relative(assetsDir, result));
          imageCount++;
        }
      } catch {
        // Skip individual image failures
      }
    }

    // Save SVG markup directly
    let svgCount = 0;
    for (const svg of pageAssets.svgs) {
      if (svgCount >= 10 - imageCount) break; // Stay within 10 total assets
      try {
        const svgId = svg.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || ("svg-" + svgCount);
        const filePath = path.join(destDir, svgId + ".svg");
        fs.writeFileSync(filePath, svg.markup, "utf-8");
        savedPaths.push(path.relative(assetsDir, filePath));
        svgCount++;
      } catch {
        // Skip individual SVG failures
      }
    }
  } catch (err: any) {
    console.error("[import] Asset capture failed:", err?.message || err);
    // Non-fatal — return whatever we managed to save
  }

  return savedPaths;
}

/**
 * Takes a screenshot of a URL using Playwright and returns it as base64 JPEG,
 * along with any downloaded assets from the page.
 */
async function captureScreenshot(
  url: string,
  templateName?: string
): Promise<{ screenshot: string; title: string; assets: string[] } | null> {
  let chromium;
  try {
    const pw = await import("playwright-core");
    chromium = pw.chromium;
  } catch {
    return null;
  }

  let browser;
  try {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    const screenshotBuffer = await page.screenshot({ fullPage: true, type: "jpeg", quality: 80 });
    const screenshot = screenshotBuffer.toString("base64");

    // Capture page assets if a template name was provided
    let assets: string[] = [];
    if (templateName) {
      assets = await capturePageAssets(page, url, templateName);
    }

    await browser.close();
    return { screenshot, title, assets };
  } catch (err: any) {
    console.error("[import] Screenshot capture failed:", err?.message);
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}

/**
 * Uses Gemini vision API to analyze a screenshot and generate a Reshaped template.
 */
async function generateWithVision(
  screenshot: string,
  url: string,
  category: string,
  name: string,
  componentName: string,
  description?: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[import] No GEMINI_API_KEY set, skipping vision-based generation");
    return null;
  }

  const prompt = `You are a frontend developer. Analyze this screenshot of ${url} and generate a React component using the Reshaped UI library that recreates the visual design as faithfully as possible.

CRITICAL REQUIREMENTS:
1. Match the EXACT color scheme from the screenshot. Extract the primary brand color, accent colors, background colors, and text colors. Use inline styles with hex values.
2. Match the typography - identify heading and body fonts from the visual style.
3. Recreate the actual layout structure: navigation, hero sections, content cards, feature grids, CTAs, footers.
4. Use the REAL text content visible in the screenshot (even if in another language).
5. The component must be a single self-contained .tsx file.

RESHAPED API (use ONLY these - they are the only verified exports):
- View: direction="row"|"column", gap={n}, align, justify, padding={n}, style={{}}
- Text: variant="title-3"|"title-4"|"title-5"|"body-1"|"body-2"|"caption-1", weight="bold"|"medium", style={{}}
- Card: padding={n}, style={{}}
- Container: width="960px"
- Button: variant="solid"|"outline"|"ghost", color="primary"|"neutral", style={{}}
- Badge: color, variant="solid"|"faded", style={{}}
- Divider
- TextField: name, placeholder

OUTPUT FORMAT - Return ONLY the .tsx code, no markdown fences:

/**
 * @meta
 * category: ${category}
 * name: ${name}
 * description: [describe the page]
 * tags: [imported, ${category}]
 * source: ${url}
 * @design
 * primary: [hex]
 * accent: [hex]
 * background: [hex]
 */
import React from "react";
import { View, Card, Text, Container, Button, Badge, Divider } from "reshaped";

const theme = {
  primary: "[hex from screenshot]",
  accent: "[hex from screenshot]",
  background: "[hex]",
  surface: "[hex]",
  text: "[hex]",
  muted: "[hex]",
  headingFont: "[font name]",
  bodyFont: "[font name]",
};

export default function ${componentName}() {
  return (
    <Container width="960px">
      <View padding={6} gap={6} style={{ backgroundColor: theme.background, fontFamily: theme.bodyFont }}>
        {/* Recreate the layout from the screenshot */}
      </View>
    </Container>
  );
}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: screenshot } }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          }
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[import] Gemini API error:", resp.status, errText.slice(0, 200));
      return null;
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[import] Gemini returned no text");
      return null;
    }

    // Strip markdown code fences if present
    let code = text.trim();
    if (code.startsWith("```")) {
      code = code.replace(/^```(?:tsx|typescript|jsx|javascript)?\n?/, "").replace(/\n?```$/, "");
    }

    // Validate it looks like a real component
    if (!code.includes("export default function") || !code.includes("reshaped")) {
      console.error("[import] Gemini output doesn't look like a valid component");
      return null;
    }

    console.log("[import] Vision-generated template:", code.length, "chars");
    return code;
  } catch (err: any) {
    console.error("[import] Gemini API call failed:", err?.message);
    return null;
  }
}

export async function generateTemplateFromUrl(
  url: string,
  category: string,
  name: string,
  description?: string
): Promise<string> {
  const safeUrl = await sanitizeUrl(url);
  const safeCategory = sanitizePathParam(category);
  const safeName = sanitizePathParam(name);
  const componentName = toPascalCase(safeName) || "ImportedTemplate";
  const hostname = extractHostname(safeUrl);

  // PRIMARY PATH: Screenshot + AI vision
  console.log(`[import] Capturing screenshot of ${hostname}...`);
  const capture = await captureScreenshot(safeUrl, safeName);

  if (capture?.screenshot) {
    if (capture.assets.length > 0) {
      console.log(`[import] Saved ${capture.assets.length} assets to assets/imported/${safeName}/`);
    }
    console.log(`[import] Screenshot captured (${Math.round(capture.screenshot.length / 1024)}KB), sending to Gemini vision...`);
    const aiTemplate = await generateWithVision(
      capture.screenshot,
      safeUrl,
      safeCategory,
      safeName,
      componentName,
      description || capture.title
    );

    if (aiTemplate) {
      return aiTemplate;
    }
    console.log("[import] Vision generation failed, falling back to DOM analysis...");
  }

  // FALLBACK: DOM scraping approach (when screenshot/AI unavailable)
  console.log(`[import] Using DOM analysis fallback for ${hostname}`);
  let html = "";
  let extractedColors: string[] = [];
  let extractedFonts: string[] = [];
  let brandColors: string[] = [];
  let computedStyles: Record<string, string> = {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    // Redirect hops are re-validated — see fetchNoRebind.
    const resp = await fetchNoRebind(safeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    html = await resp.text();
  } catch {
    html = "";
  }

  if (!html || isChallengePage(html)) {
    const rendered = await fetchWithBrowser(safeUrl);
    if (rendered.html) {
      html = rendered.html;
      extractedColors = rendered.colors;
      extractedFonts = rendered.fonts;
      computedStyles = rendered.computedStyles;
      brandColors = rendered.brandColors;
    }
  }

  const analysis = html
    ? analyzeHtml(html)
    : { title: hostname, sections: [], navLinks: [], headings: [], images: 0, forms: 0, buttons: [], stats: [] };

  if (extractedFonts.length > 0) analysis.extractedFonts = extractedFonts;
  if (extractedColors.length > 0) analysis.extractedColors = extractedColors;
  if (brandColors.length > 0) analysis.brandColors = brandColors;
  if (Object.keys(computedStyles).length > 0) analysis.computedStyles = computedStyles;

  const desc = escapeTemplateText(
    (description ? description.slice(0, 200) : "") || analysis.title || `Imported from ${hostname}`
  );

  const theme = (analysis.extractedColors?.length || analysis.extractedFonts?.length)
    ? deriveTheme(analysis.extractedColors || [], analysis.extractedFonts || [], analysis.computedStyles || {}, analysis.brandColors)
    : undefined;

  const sectionCode: string[] = [];
  for (const section of analysis.sections) {
    switch (section.type) {
      case "nav": sectionCode.push(generateNavSection(section.links || analysis.navLinks, theme)); break;
      case "hero": sectionCode.push(generateHeroSection(section.heading || analysis.title || "Welcome", section.text, analysis.buttons, theme)); break;
      case "features": sectionCode.push(generateFeaturesSection(section.items || [], theme)); break;
      case "stats": sectionCode.push(generateStatsSection(section.items || analysis.stats, theme)); break;
      case "testimonials": sectionCode.push(generateTestimonialsSection(section.items || [], theme)); break;
      case "pricing": sectionCode.push(generatePricingSection(section.items || [], theme)); break;
      case "form": sectionCode.push(generateFormSection(theme)); break;
      case "content": sectionCode.push(generateContentSection(section.heading || "Section", theme)); break;
      case "footer": sectionCode.push(generateFooterSection(section.links || [], theme)); break;
    }
  }

  if (sectionCode.length === 0) {
    sectionCode.push(generateNavSection(["Home", "About", "Services", "Contact"], theme));
    sectionCode.push(generateHeroSection(analysis.title || componentName, desc, analysis.buttons, theme));
    sectionCode.push(generateFeaturesSection(["Feature One", "Feature Two", "Feature Three"], theme));
    sectionCode.push(generateFooterSection([], theme));
  }

  const allCode = sectionCode.join("");
  const imports = ["View", "Card", "Text", "Container", "Button", "Badge", "Divider",
    ...(allCode.includes("TextField") ? ["TextField"] : []),
  ];

  const designComment = (analysis.extractedColors?.length || analysis.extractedFonts?.length)
    ? `\n * @design\n${analysis.extractedFonts?.length ? ` * fonts: [${analysis.extractedFonts.slice(0, 5).join(", ")}]\n` : ""}${analysis.extractedColors?.length ? ` * colors: [${analysis.extractedColors.slice(0, 10).join(", ")}]\n` : ""}`
    : "";

  const themeConst = theme ? `\nconst theme = {
  primary: "${theme.primary}",
  accent: "${theme.accent}",
  background: "${theme.background}",
  surface: "${theme.surface}",
  text: "${theme.text}",
  muted: "${theme.muted}",
  headingFont: "${theme.headingFont}",
  bodyFont: "${theme.bodyFont}",
};\n` : "";

  return `/**
 * @meta
 * category: ${safeCategory}
 * name: ${safeName}
 * description: ${desc}
 * tags: [imported, ${safeCategory}]
 * source: ${safeUrl}${designComment}
 */
import React from "react";
import { ${imports.join(", ")} } from "reshaped";
${themeConst}
export default function ${componentName}() {
  return (
    <Container width="960px">
      <View padding={6} gap={6}${theme ? ` style={{ backgroundColor: theme.background, fontFamily: theme.bodyFont }}` : ""}>
${sectionCode.join("\n")}
      </View>
    </Container>
  );
}
`;
}
