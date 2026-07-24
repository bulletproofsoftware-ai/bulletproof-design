/**
 * SPEC-004 SVG sanitizer — attack vector regression tests.
 *
 * Each CISO-catalogued attack vector (F-UPLOAD-01, F-UPLOAD-02, F-STATIC-02)
 * is covered by at least one test. Every `expect(output).not.toMatch(…)`
 * assertion proves the sanitizer stripped the dangerous payload; `modified`
 * is asserted `true` so the route handler's `sanitize-on-read-mismatch`
 * audit event will fire.
 */

import { sanitizeSvg } from "../src/api/lib/svgSanitizer";

const WRAP = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;

describe("sanitizeSvg — script elements (CISO F-UPLOAD-01)", () => {
  test("<script> lowercase is stripped", () => {
    const { output, modified } = sanitizeSvg(WRAP('<script>alert(1)</script>'));
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<SCRIPT> uppercase is stripped", () => {
    const { output, modified } = sanitizeSvg(WRAP('<SCRIPT>alert(1)</SCRIPT>'));
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<script\\t> with whitespace in tag is stripped", () => {
    const { output, modified } = sanitizeSvg(WRAP('<script\t>alert(1)</script>'));
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<svg:script> namespaced is stripped", () => {
    const { output, modified } = sanitizeSvg(WRAP('<svg:script>alert(1)</svg:script>'));
    expect(output).not.toMatch(/<(?:svg:)?script/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });
});

describe("sanitizeSvg — event handler attributes (CISO F-UPLOAD-01)", () => {
  test("<svg onload='…'> — onload stripped", () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 10 10"></svg>`;
    const { output, modified } = sanitizeSvg(input);
    expect(output).not.toMatch(/onload/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<circle onclick='…' onmouseover='…'> — both stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<circle cx="5" cy="5" r="4" onclick="alert(1)" onmouseover="alert(2)"/>'),
    );
    expect(output).not.toMatch(/onclick/i);
    expect(output).not.toMatch(/onmouseover/i);
    expect(output).not.toMatch(/alert\(/);
    expect(modified).toBe(true);
    // Circle itself should survive.
    expect(output).toMatch(/<circle/i);
  });

  test("<animate onbegin='…' onend='…'> — SMIL event handlers stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<animate attributeName="x" from="0" to="10" dur="1s" onbegin="alert(1)" onend="alert(2)"/>'),
    );
    expect(output).not.toMatch(/onbegin/i);
    expect(output).not.toMatch(/onend/i);
    expect(output).not.toMatch(/alert\(/);
    expect(modified).toBe(true);
  });
});

describe("sanitizeSvg — foreignObject, iframe, embed, object (CISO F-UPLOAD-01)", () => {
  test("<foreignObject> containing <body onload='…'> is entirely stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<foreignObject width="100" height="100"><body onload="alert(1)"/></foreignObject>'),
    );
    expect(output).not.toMatch(/foreignObject/i);
    expect(output).not.toMatch(/<body/i);
    expect(output).not.toMatch(/onload/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<iframe> is stripped", () => {
    const { output, modified } = sanitizeSvg(WRAP('<iframe src="https://evil.com"></iframe>'));
    expect(output).not.toMatch(/<iframe/i);
    expect(output).not.toMatch(/evil\.com/);
    expect(modified).toBe(true);
  });

  test("<embed> is stripped", () => {
    const { output, modified } = sanitizeSvg(WRAP('<embed src="https://evil.com"/>'));
    expect(output).not.toMatch(/<embed/i);
    expect(output).not.toMatch(/evil\.com/);
    expect(modified).toBe(true);
  });

  test("<object> is stripped", () => {
    const { output, modified } = sanitizeSvg(WRAP('<object data="https://evil.com"></object>'));
    expect(output).not.toMatch(/<object/i);
    expect(output).not.toMatch(/evil\.com/);
    expect(modified).toBe(true);
  });
});

describe("sanitizeSvg — <use> and href scheme guards", () => {
  test("<use href='https://evil.com/icons.svg#pwn'> — external use stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<use href="https://evil.com/icons.svg#pwn" x="0" y="0"/>'),
    );
    // `<use>` may survive as the element, but the external href MUST NOT.
    expect(output).not.toMatch(/evil\.com/);
    // The tag may be retained empty or fully stripped — either is acceptable.
    expect(modified).toBe(true);
  });

  test("<use href='#local-icon'> — local fragment preserved", () => {
    const { output } = sanitizeSvg(WRAP('<use href="#local-icon" x="0" y="0"/>'));
    expect(output).toMatch(/<use[^>]*href="#local-icon"/);
  });

  test("<a xlink:href='javascript:alert(1)'> — xlink:href stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<a xlink:href="javascript:alert(1)"><rect width="10" height="10"/></a>'),
    );
    expect(output).not.toMatch(/javascript:/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<image href='javascript:alert(1)'> — dangerous href stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<image href="javascript:alert(1)" width="10" height="10"/>'),
    );
    expect(output).not.toMatch(/javascript:/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<image href='data:image/png;base64,iVBOR…'> — image data URI preserved", () => {
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const { output } = sanitizeSvg(
      WRAP(`<image href="${dataUri}" width="10" height="10"/>`),
    );
    expect(output).toMatch(/data:image\/png;base64/);
  });

  test("<image href='data:text/html,<script>…'> — non-image data URI stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<image href="data:text/html,<script>alert(1)</script>" width="10" height="10"/>'),
    );
    expect(output).not.toMatch(/data:text\/html/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });
});

describe("sanitizeSvg — <style> blocks (CSS XSS vectors)", () => {
  test("<style> with url(javascript:…) stripped entirely", () => {
    const { output, modified } = sanitizeSvg(
      WRAP("<style>* { background: url(javascript:alert(1)) }</style>"),
    );
    expect(output).not.toMatch(/<style/i);
    expect(output).not.toMatch(/javascript:/i);
    expect(output).not.toMatch(/alert\(1\)/);
    expect(modified).toBe(true);
  });

  test("<style> with @import stripped entirely", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<style>@import "https://evil.com/x.css";</style>'),
    );
    expect(output).not.toMatch(/<style/i);
    expect(output).not.toMatch(/@import/);
    expect(output).not.toMatch(/evil\.com/);
    expect(modified).toBe(true);
  });
});

describe("sanitizeSvg — DOCTYPE and ENTITY (CISO F-UPLOAD-02 XXE)", () => {
  test("DOCTYPE with ENTITY declarations is stripped", () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <text>&xxe;</text>
</svg>`;
    const { output, modified } = sanitizeSvg(xxe);
    expect(output).not.toMatch(/<!DOCTYPE/i);
    expect(output).not.toMatch(/<!ENTITY/i);
    expect(output).not.toMatch(/file:\/\/\/etc\/passwd/);
    expect(modified).toBe(true);
  });

  test("parameter-entity variant is stripped", () => {
    const xxe = `<!DOCTYPE svg [<!ENTITY % xxe SYSTEM "http://attacker/x.dtd"> %xxe;]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>`;
    const { output, modified } = sanitizeSvg(xxe);
    expect(output).not.toMatch(/<!DOCTYPE/i);
    expect(output).not.toMatch(/<!ENTITY/i);
    expect(output).not.toMatch(/attacker/);
    expect(modified).toBe(true);
  });
});

describe("sanitizeSvg — non-SVG UI elements", () => {
  test("<form> and <input> are stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<form action="/evil"><input name="x"/></form>'),
    );
    expect(output).not.toMatch(/<form/i);
    expect(output).not.toMatch(/<input/i);
    expect(output).not.toMatch(/evil/);
    expect(modified).toBe(true);
  });

  test("<meta> and <link> are stripped", () => {
    const { output, modified } = sanitizeSvg(
      WRAP('<meta http-equiv="refresh" content="0;url=https://evil.com"/><link rel="stylesheet" href="https://evil.com/x.css"/>'),
    );
    expect(output).not.toMatch(/<meta/i);
    expect(output).not.toMatch(/<link/i);
    expect(output).not.toMatch(/evil\.com/);
    expect(modified).toBe(true);
  });
});

describe("sanitizeSvg — clean input is unchanged", () => {
  test("plain shape SVG passes through (modified=false or whitespace-only diff)", () => {
    const clean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#0057B8"/></svg>`;
    const { output } = sanitizeSvg(clean);
    expect(output).toMatch(/<circle/);
    expect(output).toMatch(/fill="#0057B8"/);
    expect(output).not.toMatch(/<script/i);
  });

  test("HTML-encoded <script> (entities) is preserved as text, not executed", () => {
    // &lt;script&gt; should survive as literal text — it's not a live element.
    const escaped = WRAP("<text>&lt;script&gt;alert(1)&lt;/script&gt;</text>");
    const { output } = sanitizeSvg(escaped);
    // No live <script> surface
    expect(output).not.toMatch(/<script/i);
    // Entity text is preserved somewhere in the output
    expect(output).toMatch(/(?:&lt;|<)script(?:&gt;|>)?/i);
  });
});

describe("sanitizeSvg — input validation", () => {
  test("throws on non-SVG input", () => {
    expect(() => sanitizeSvg("<html><body>not svg</body></html>")).toThrow(
      /<svg> root/,
    );
  });

  test("throws on oversized input", () => {
    const huge = WRAP("<rect/>".repeat(1_000_000));
    expect(() => sanitizeSvg(huge)).toThrow(/maximum size/);
  });

  test("accepts Buffer input as well as string", () => {
    const buf = Buffer.from(WRAP('<rect width="5" height="5"/>'), "utf-8");
    const { output } = sanitizeSvg(buf);
    expect(output).toMatch(/<rect/);
  });
});
