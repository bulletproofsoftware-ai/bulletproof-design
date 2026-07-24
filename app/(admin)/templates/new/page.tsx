"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { MonacoEditor } from "@/components/features/MonacoEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/primitives/TagInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import * as api from "@/lib/api";
import type { Category } from "@/lib/api";

function buildSkeleton(category: string, name: string, description: string, tags: string[]) {
  const tagStr = tags.length > 0 ? tags.join(", ") : "";
  return `/**
 * @meta
 * category: ${category || "uncategorized"}
 * name: ${name || "new-template"}
 * description: ${description || ""}
 * tags: [${tagStr}]
 * source: manual
 */
import React from "react";
import { View, Text, Container, Button } from "reshaped";

export default function TemplateName() {
  return (
    <Container width="960px">
      <View padding={8} gap={6}>
        <Text variant="title-3" weight="bold">Template Name</Text>
      </View>
    </Container>
  );
}
`;
}

export default function NewTemplatePage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sourceCode, setSourceCode] = useState(() =>
    buildSkeleton("", "", "", [])
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  // Update the meta block in source code when metadata changes
  useEffect(() => {
    const effectiveCategory = category === "__new__" ? customCategory : category;
    const newSkeleton = buildSkeleton(effectiveCategory, name, description, tags);
    // Only update the meta block, not user code — check if user has modified beyond skeleton
    const metaRegex = /\/\*\*[\s\S]*?\*\//;
    const currentMeta = sourceCode.match(metaRegex);
    const skeletonMeta = newSkeleton.match(metaRegex);
    if (currentMeta && skeletonMeta) {
      setSourceCode(sourceCode.replace(metaRegex, skeletonMeta[0]));
    }
  }, [name, category, customCategory, description, tags]);

  async function handleSave() {
    const effectiveCategory = category === "__new__" ? customCategory : category;

    if (!effectiveCategory || !name) {
      setStatus({ type: "error", message: "Category and name are required" });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      await api.createTemplate({
        category: effectiveCategory,
        name,
        description,
        tags,
        sourceCode,
      });
      setStatus({ type: "success", message: "Template created" });
      setTimeout(() => router.push("/templates"), 1000);
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to create template" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/templates")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Templates", href: "/templates" }, { label: "New Template" }]} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={status.type === "success" ? "default" : "destructive"}>
              {status.message}
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Create
          </Button>
        </div>
      </header>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Monaco editor — 60% */}
        <div className="w-[60%] border-r">
          <MonacoEditor
            value={sourceCode}
            onChange={setSourceCode}
            language="typescript"
          />
        </div>

        {/* Metadata form — 40% */}
        <div className="edit-panel w-[40%] overflow-auto p-6">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="kebab-case-name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New category</SelectItem>
                </SelectContent>
              </Select>
              {category === "__new__" && (
                <Input
                  className="mt-2"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="new-category-name"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the template"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Tags</label>
              <TagInput tags={tags} onChange={setTags} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
