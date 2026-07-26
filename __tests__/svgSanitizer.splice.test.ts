import { sanitizeSvg } from "../src/api/lib/svgSanitizer";

/**
 * Payloads that survive a single-pass strip: removing the inner match splices
 * the surrounding text into a fresh, intact element. The pre-pass must iterate
 * to a fixed point (CodeQL js/incomplete-multi-character-sanitization).
 */
const PAYLOADS: Array<[string, string]> = [
  ["spliced script", `<svg xmlns="http://www.w3.org/2000/svg"><scr<script>ipt>alert(1)</script>ipt>alert(2)</script></svg>`],
  ["nested script", `<svg xmlns="http://www.w3.org/2000/svg"><script><script>alert(1)</script></script></svg>`],
  ["spliced style", `<svg xmlns="http://www.w3.org/2000/svg"><sty<style>le>x{}</style>le>body{}</style></svg>`],
  ["spliced iframe", `<svg xmlns="http://www.w3.org/2000/svg"><ifr<iframe>ame src=x></iframe>ame src=y></iframe></svg>`],
  ["mixed case script", `<svg xmlns="http://www.w3.org/2000/svg"><ScR<ScRiPt>iPt>alert(1)</ScRiPt>iPt>alert(2)</ScRiPt></svg>`],
];

describe("sanitizeSvg resists spliced multi-character payloads", () => {
  for (const [name, svg] of PAYLOADS) {
    it(name, () => {
      const { output } = sanitizeSvg(svg);
      const lower = output.toLowerCase();
      expect(lower).not.toContain("<script");
      expect(lower).not.toContain("<style");
      expect(lower).not.toContain("<iframe");
      expect(output).not.toContain("alert(");
    });
  }
});
