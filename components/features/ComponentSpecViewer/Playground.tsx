"use client";

/**
 * Client-side JSX playground (SPEC-008 REQ-022, item 5 — CISO F-PLAY-01 / F-PLAY-02).
 *
 * SECURITY POSTURE — read before modifying:
 *
 *   1. NO SERVER-SIDE JSX EXECUTION. There is no POST preview endpoint on
 *      the Express API. Transpilation happens ONLY in the admin's browser
 *      via `@babel/standalone`. Accepting JSX on the server would be a
 *      remote-code-execution vector against the Express host.
 *
 *   2. The transpiled code runs inside an `<iframe srcdoc="…">` with
 *      `sandbox="allow-scripts"` (NO `allow-same-origin`). This isolates
 *      the iframe from the parent document origin — it cannot read cookies
 *      or `localStorage`, cannot reach the parent DOM, and cannot access
 *      parent storage.
 *
 *   3. Sandbox alone does NOT block outbound network — `fetch`, XHR,
 *      WebSocket, `navigator.sendBeacon`, `<img src=…>`, `<form action=…>`
 *      all still work from a sandboxed iframe. The `srcdoc` document
 *      injected via `buildPlaygroundSrcdoc()` therefore emits a
 *      `<meta http-equiv="Content-Security-Policy">` tag as the first
 *      child of `<head>` with `connect-src 'none'` and friends. See
 *      `lib/playgroundSrcdoc.ts` for the directive rationale and the
 *      regression test in `__tests__/playgroundSrcdoc.test.ts`.
 *
 *   4. The iframe is reloaded via `srcdoc` reassignment on each Run. We
 *      set `srcdoc=""` first to force browsers to tear the old document
 *      down before installing the new one.
 */

import { useCallback, useRef, useState } from "react";
import { transform } from "@babel/standalone";

import { MonacoEditor } from "@/components/features/MonacoEditor";
import { Button } from "@/components/ui/button";

import { buildPlaygroundSrcdoc } from "@/lib/playgroundSrcdoc";

interface PlaygroundProps {
  componentName: string;
  initialCode?: string;
}

const DEFAULT_TEMPLATE = (name: string) => `// Edit JSX below and click "Run" to preview client-side.
// Network access is blocked inside the playground iframe.

function Demo() {
  return (
    <div style={{padding: '16px', fontFamily: 'system-ui'}}>
      <h2 style={{fontSize: '18px', marginBottom: '8px'}}>${name}</h2>
      <p>Your JSX renders here. Edit and click Run.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Demo />);
`;

export function Playground({ componentName, initialCode }: PlaygroundProps) {
  const [code, setCode] = useState(initialCode ?? DEFAULT_TEMPLATE(componentName));
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const run = useCallback(() => {
    setError(null);
    let transpiled: string;
    try {
      const out = transform(code, {
        presets: [["react", { development: false }]],
        filename: `${componentName}.playground.jsx`,
      });
      transpiled = out.code || "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    const srcdoc = buildPlaygroundSrcdoc({ transpiledJs: transpiled });
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Clear first to force a full re-parse. Some browsers ignore srcdoc
    // updates when the new value is structurally similar to the current one.
    iframe.srcdoc = "";
    // Next tick, install the new document.
    requestAnimationFrame(() => {
      if (iframeRef.current) iframeRef.current.srcdoc = srcdoc;
    });
  }, [code, componentName]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Client-side only. Transpile + render run in a sandboxed iframe with
          <code className="mx-1 rounded bg-muted px-1 py-0.5">connect-src 'none'</code>
          — no network requests from the playground.
        </p>
        <Button onClick={run} size="sm">
          Run
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="h-[320px] overflow-hidden rounded-lg border border-border">
          <MonacoEditor
            value={code}
            onChange={setCode}
            language="javascript"
            height="320px"
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <iframe
            ref={iframeRef}
            title={`${componentName} playground`}
            sandbox="allow-scripts"
            className="h-[320px] w-full"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs text-destructive whitespace-pre-wrap"
        >
          {error}
        </div>
      )}
    </div>
  );
}
