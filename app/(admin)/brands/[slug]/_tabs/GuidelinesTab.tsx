"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MonacoEditor } from "@/components/features/MonacoEditor";
import { Loader2, Save } from "lucide-react";
import * as api from "@/lib/api";

const GUIDELINES_MAX_BYTES = 100 * 1024;

/**
 * Guidelines tab — Monaco markdown editor wired to SPEC-002's
 * `GET ?raw=1` / `PUT` endpoints (REQ-017).
 *
 * Behaviour:
 *  - On mount: fetch raw markdown. 404 → empty string (brand has no
 *    guidelines.md yet; the first save creates the file).
 *  - Dirty tracking: compare against the last-saved snapshot. The
 *    "Save" button is enabled only when dirty and an API key is present.
 *  - Navigation guard: a `beforeunload` listener prompts when there are
 *    unsaved edits. We don't intercept client-side route changes (no
 *    next/navigation hook for that); users rely on the visible dirty
 *    badge instead.
 *  - Size check: we warn when the body approaches the server's 100 KB
 *    cap so the save doesn't fail with a 413 after typing.
 */
export function GuidelinesTab({
  slug,
  apiKey,
}: {
  slug: string;
  apiKey: string;
}) {
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = value !== savedValue;
  const bytes = new Blob([value]).size;
  const overLimit = bytes > GUIDELINES_MAX_BYTES;

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await api.getGuidelinesRaw(slug);
        if (cancelled) return;
        setValue(raw);
        setSavedValue(raw);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Prevent accidental page close with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome/Firefox require returnValue to be set.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const handleSave = useCallback(async () => {
    if (!apiKey) {
      setError("API key is required to save guidelines.");
      return;
    }
    if (overLimit) {
      setError(
        `Guidelines exceed ${GUIDELINES_MAX_BYTES / 1024} KB limit.`,
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.putGuidelines(slug, value, apiKey);
      setSavedValue(value);
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [slug, value, apiKey, overLimit]);

  return (
    <Card className="flex flex-col overflow-hidden p-0" data-testid="guidelines-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Brand Guidelines</h2>
          <p className="text-xs text-muted-foreground">
            Markdown — saved to{" "}
            <code className="font-mono">brands/{slug}/guidelines.md</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono ${
              overLimit
                ? "text-destructive"
                : bytes > GUIDELINES_MAX_BYTES * 0.9
                  ? "text-amber-600"
                  : "text-muted-foreground"
            }`}
          >
            {bytes.toLocaleString()} / {GUIDELINES_MAX_BYTES.toLocaleString()}{" "}
            bytes
          </span>
          {dirty && <Badge variant="secondary">Unsaved</Badge>}
          {!dirty && savedAt && (
            <Badge variant="outline" className="text-xs">
              Saved {savedAt.toLocaleTimeString()}
            </Badge>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty || !apiKey || overLimit}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {error && (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {!apiKey && !error && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Enter an API key in the header above to save changes.
        </div>
      )}

      <div className="h-[600px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading guidelines…
          </div>
        ) : (
          <MonacoEditor
            value={value}
            onChange={setValue}
            language="markdown"
            height="100%"
          />
        )}
      </div>
    </Card>
  );
}
