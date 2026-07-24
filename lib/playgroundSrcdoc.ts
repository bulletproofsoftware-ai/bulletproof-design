/**
 * Playground srcdoc builder (SPEC-008 REQ-022, CISO F-PLAY-02).
 *
 * Produces the HTML document injected into the interactive playground's
 * `<iframe srcdoc="...">` on the `/components/:name` detail page. Pulled out
 * of the React component so it can be unit-tested without jsdom.
 *
 * The document MUST satisfy these properties (regression-tested in
 * __tests__/playgroundSrcdoc.test.ts):
 *
 *   1. The first element of <head> is a <meta http-equiv="Content-Security-Policy">
 *      that blocks ALL outbound network (`connect-src 'none'`, no `img-src` host
 *      except data:, no `font-src`, no `frame-src`) — the iframe uses
 *      `sandbox="allow-scripts"` (NO `allow-same-origin`) but sandbox alone does
 *      NOT prevent `fetch`/XHR/WebSocket/`<img src>` to arbitrary origins.
 *   2. The transpiled JS is embedded inline — no remote <script src>.
 *   3. React, ReactDOM, and Tailwind are NOT loaded from a CDN here (doing so
 *      would require relaxing `script-src` / `style-src` to allow that CDN,
 *      widening the exfil surface). Instead the playground renders raw JSX
 *      into a <div id="root"> via a minimal inline shim that creates DOM
 *      elements using document.createElement from the transpiled
 *      `React.createElement(...)` calls. `@babel/standalone` with
 *      `preset-react` produces `React.createElement` calls; the shim below
 *      implements a tiny React.createElement that renders to real DOM.
 *
 * This is deliberately minimalist — the playground is for previewing JSX
 * shape and props, not a full React runtime. For rich component preview the
 * variants gallery (same page) uses server-rendered iframes from SPEC-005.
 */

/**
 * Exact meta CSP emitted as the first child of <head>. Kept as a module
 * constant so tests can assert it character-for-character and so code
 * reviewers can audit the directive set in one place.
 *
 * Directive rationale:
 *   - script-src 'unsafe-eval' 'unsafe-inline'
 *       `@babel/standalone` runs in the PARENT document — only the
 *       transpiled output is injected here, so the iframe only needs
 *       `'unsafe-inline'` to run its bootstrap <script>. `'unsafe-eval'`
 *       is included defensively for any Function/eval usage in shim code.
 *   - style-src 'unsafe-inline' — inline <style> tags inside srcdoc.
 *   - img-src data: — base64 demo images allowed; HTTP(S) pixels blocked.
 *   - connect-src 'none' — PRIMARY exfil block. Blocks fetch, XHR,
 *     WebSocket, EventSource, navigator.sendBeacon.
 *   - font-src 'none', frame-src 'none', object-src 'none' — no external
 *     subresource loading.
 *   - base-uri 'none' — prevents <base href> redirecting relative URLs.
 *   - form-action 'none' — prevents <form action> as exfil channel.
 */
export const PLAYGROUND_META_CSP =
  "default-src 'none'; " +
  "script-src 'unsafe-eval' 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; " +
  "img-src data:; " +
  "connect-src 'none'; " +
  "font-src 'none'; " +
  "frame-src 'none'; " +
  "object-src 'none'; " +
  "base-uri 'none'; " +
  "form-action 'none';";

/**
 * Escape a string for safe interpolation inside a <script> tag body.
 *
 * The transpiled JSX is user-supplied (an admin paste into Monaco). We're
 * already sandboxed with meta CSP + `sandbox="allow-scripts"`, but defence
 * in depth: prevent `</script>` injection from breaking out of the <script>
 * block and reaching the srcdoc parser, which would let malicious input
 * inject new tags (e.g., a form with action=… still blocked by form-action
 * 'none' but the fewer escape hatches, the better).
 *
 * We only need to neutralise the literal substring `</script` — everything
 * else is already a JS string in the transpile output.
 */
function escapeScriptBody(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

export interface BuildPlaygroundSrcdocOptions {
  /** Transpiled JS (output of `@babel/standalone` with preset-react). */
  transpiledJs: string;
}

/**
 * Produce the srcdoc HTML for the playground iframe. The meta CSP is
 * emitted as the FIRST child of <head> so the browser parses it before any
 * subsequent tags attempt network I/O.
 */
export function buildPlaygroundSrcdoc(opts: BuildPlaygroundSrcdocOptions): string {
  const safeJs = escapeScriptBody(opts.transpiledJs);

  // Tiny React shim: supports function components and intrinsic tags, plus
  // children + className + style + onClick. Rendered into #root via a
  // createRoot-like call. No reconciler — one-shot render, which is all the
  // playground needs.
  const shim = `
(function(){
  var React = {
    createElement: function(type, props) {
      var children = Array.prototype.slice.call(arguments, 2);
      if (typeof type === 'function') {
        var p = Object.assign({}, props || {}, { children: children.length <= 1 ? children[0] : children });
        return React.createElement.call(null, 'div', null, type(p));
      }
      var el = document.createElement(type);
      if (props) {
        for (var k in props) {
          if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
          var v = props[k];
          if (k === 'className') { el.setAttribute('class', String(v)); }
          else if (k === 'style' && v && typeof v === 'object') {
            for (var sk in v) { if (Object.prototype.hasOwnProperty.call(v, sk)) el.style[sk] = v[sk]; }
          }
          else if (k.indexOf('on') === 0 && typeof v === 'function') {
            el.addEventListener(k.slice(2).toLowerCase(), v);
          }
          else if (k === 'children') { /* handled below */ }
          else if (v !== false && v != null) { el.setAttribute(k, String(v)); }
        }
      }
      function appendChild(c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) { c.forEach(appendChild); return; }
        if (c instanceof Node) { el.appendChild(c); return; }
        el.appendChild(document.createTextNode(String(c)));
      }
      children.forEach(appendChild);
      return el;
    },
    Fragment: function(props){ return props && props.children; }
  };
  window.React = React;
  window.ReactDOM = {
    createRoot: function(container){
      return {
        render: function(node){
          container.textContent = '';
          if (node instanceof Node) container.appendChild(node);
          else if (node != null) container.appendChild(document.createTextNode(String(node)));
        }
      };
    }
  };
})();`;

  const userBootstrap = `
(function(){
  var root = document.getElementById('root');
  var err = document.getElementById('err');
  try {
    var exports = {};
    var module = { exports: exports };
    (function(){
      ${safeJs}
    })();
    // Convention: user code should render by returning JSX at top level
    // OR by calling ReactDOM.createRoot(root).render(<App/>). If nothing
    // rendered, show a friendly hint.
    if (!root.hasChildNodes()) {
      root.textContent = 'Playground loaded. Call ReactDOM.createRoot(document.getElementById("root")).render(<YourComponent/>) to preview.';
    }
  } catch (e) {
    err.style.display = 'block';
    err.textContent = 'Runtime error: ' + (e && e.message ? e.message : String(e));
  }
})();`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Security-Policy" content="${PLAYGROUND_META_CSP}">
<meta charset="utf-8">
<title>Playground</title>
<style>
  html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#fff;color:#111;}
  #root{padding:16px;}
  #err{display:none;padding:12px 16px;background:#fee2e2;color:#991b1b;border-top:1px solid #fca5a5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;}
</style>
</head>
<body>
<div id="root"></div>
<pre id="err" role="alert" aria-live="polite"></pre>
<script>${shim}</script>
<script>${userBootstrap}</script>
</body>
</html>`;
}
