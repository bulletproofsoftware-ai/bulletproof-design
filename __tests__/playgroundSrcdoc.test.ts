/**
 * Regression guards for the playground srcdoc builder (CISO F-PLAY-02).
 *
 * The playground iframe uses `sandbox="allow-scripts"` (NO
 * `allow-same-origin`) but the sandbox does not block `fetch` / XHR /
 * WebSocket / `<img src>` to arbitrary origins. The meta CSP emitted as
 * the first child of `<head>` closes that exfil gap. These tests lock the
 * exact directive set so nobody can accidentally loosen it.
 *
 * See `lib/playgroundSrcdoc.ts` for directive-level commentary.
 */

import { describe, it, expect } from "@jest/globals";
import {
  buildPlaygroundSrcdoc,
  PLAYGROUND_META_CSP,
} from "../lib/playgroundSrcdoc";

describe("playground srcdoc builder", () => {
  const HELLO = "const x = 1;";

  it("includes a meta CSP as the first tag inside <head>", () => {
    const html = buildPlaygroundSrcdoc({ transpiledJs: HELLO });
    const headMatch = html.match(/<head>\s*([\s\S]*?)<\/head>/);
    expect(headMatch).not.toBeNull();
    const headInner = headMatch![1].trim();
    // The very first element in <head> must be the meta CSP.
    expect(headInner.startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
  });

  it("meta CSP exact string matches the PLAYGROUND_META_CSP constant", () => {
    const html = buildPlaygroundSrcdoc({ transpiledJs: HELLO });
    const metaMatch = html.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/,
    );
    expect(metaMatch).not.toBeNull();
    expect(metaMatch![1]).toBe(PLAYGROUND_META_CSP);
  });

  it("CSP blocks all outbound network via connect-src 'none'", () => {
    expect(PLAYGROUND_META_CSP).toContain("connect-src 'none'");
  });

  it("CSP restricts img-src to data: only (no HTTP beacons)", () => {
    expect(PLAYGROUND_META_CSP).toContain("img-src data:");
    expect(PLAYGROUND_META_CSP).not.toMatch(/img-src[^;]*https?:/);
  });

  it("CSP forbids external fonts, frames, and objects", () => {
    expect(PLAYGROUND_META_CSP).toContain("font-src 'none'");
    expect(PLAYGROUND_META_CSP).toContain("frame-src 'none'");
    expect(PLAYGROUND_META_CSP).toContain("object-src 'none'");
  });

  it("CSP locks base-uri and form-action to 'none'", () => {
    expect(PLAYGROUND_META_CSP).toContain("base-uri 'none'");
    expect(PLAYGROUND_META_CSP).toContain("form-action 'none'");
  });

  it("CSP default-src is 'none' — everything must be explicitly allowed", () => {
    expect(PLAYGROUND_META_CSP).toContain("default-src 'none'");
  });

  it("CSP allows 'unsafe-inline' and 'unsafe-eval' in script-src (required by playground bootstrap)", () => {
    // These are deliberate — @babel/standalone is not in the iframe, but
    // the bootstrap shim runs as an inline script. Documented tradeoff.
    expect(PLAYGROUND_META_CSP).toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(PLAYGROUND_META_CSP).toMatch(/script-src[^;]*'unsafe-eval'/);
  });

  it("escapes </script sequences in transpiled JS to prevent tag-break injection", () => {
    const malicious = "var a = '</script><img src=x onerror=alert(1)>';";
    const html = buildPlaygroundSrcdoc({ transpiledJs: malicious });
    // The literal `</script` must not appear inside the user bootstrap
    // script (escaped form `<\/script` is OK).
    const bootstrapSection = html.split("</script>").slice(0, -1).join("</script>");
    // Any `</script` in the file would split the <script> tag early. The
    // real check: once we remove the closing `</script>` of each script
    // block, no raw `</script` should remain from the user payload.
    expect(bootstrapSection.toLowerCase()).not.toContain("</script><img");
  });

  it("produces a document with #root and #err mount points", () => {
    const html = buildPlaygroundSrcdoc({ transpiledJs: HELLO });
    expect(html).toContain('<div id="root">');
    expect(html).toContain('id="err"');
  });

  it("is deterministic for the same input", () => {
    const a = buildPlaygroundSrcdoc({ transpiledJs: HELLO });
    const b = buildPlaygroundSrcdoc({ transpiledJs: HELLO });
    expect(a).toBe(b);
  });
});
