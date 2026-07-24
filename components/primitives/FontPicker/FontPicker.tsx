"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const FONT_OPTIONS = [
  { name: "Inter", stack: "Inter, sans-serif", category: "Sans Serif" },
  { name: "Roboto", stack: "Roboto, sans-serif", category: "Sans Serif" },
  { name: "Open Sans", stack: "'Open Sans', sans-serif", category: "Sans Serif" },
  { name: "Poppins", stack: "Poppins, sans-serif", category: "Sans Serif" },
  { name: "DM Sans", stack: "'DM Sans', sans-serif", category: "Sans Serif" },
  { name: "Space Grotesk", stack: "'Space Grotesk', sans-serif", category: "Sans Serif" },
  { name: "Plus Jakarta Sans", stack: "'Plus Jakarta Sans', sans-serif", category: "Sans Serif" },
  { name: "Manrope", stack: "Manrope, sans-serif", category: "Sans Serif" },
  { name: "Outfit", stack: "Outfit, sans-serif", category: "Sans Serif" },
  { name: "Sora", stack: "Sora, sans-serif", category: "Sans Serif" },
  { name: "Geist", stack: "Geist, sans-serif", category: "Sans Serif" },
  { name: "Merriweather", stack: "Merriweather, serif", category: "Serif" },
  { name: "Playfair Display", stack: "'Playfair Display', serif", category: "Serif" },
  { name: "Lora", stack: "Lora, serif", category: "Serif" },
  { name: "Georgia", stack: "Georgia, serif", category: "Serif" },
  { name: "JetBrains Mono", stack: "'JetBrains Mono', monospace", category: "Monospace" },
  { name: "Fira Code", stack: "'Fira Code', monospace", category: "Monospace" },
  { name: "Source Code Pro", stack: "'Source Code Pro', monospace", category: "Monospace" },
  { name: "IBM Plex Mono", stack: "'IBM Plex Mono', monospace", category: "Monospace" },
  { name: "system-ui", stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", category: "System" },
  { name: "ui-monospace", stack: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace", category: "System" },
];

interface FontPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  filter?: "all" | "sans" | "serif" | "mono";
}

export function FontPicker({ label, value, onChange, filter = "all" }: FontPickerProps) {
  const [custom, setCustom] = useState(false);

  const filteredFonts = FONT_OPTIONS.filter((f) => {
    if (filter === "all") return true;
    if (filter === "sans") return f.category === "Sans Serif" || f.category === "System";
    if (filter === "serif") return f.category === "Serif";
    if (filter === "mono") return f.category === "Monospace" || f.category === "System";
    return true;
  });

  // Check if current value matches a known font
  const isKnown = FONT_OPTIONS.some((f) => f.name === value);

  if (custom || (!isKnown && value)) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-muted-foreground">{label}</label>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs"
            placeholder="Font name or stack"
          />
          <button
            onClick={() => setCustom(false)}
            className="shrink-0 text-xs text-primary hover:underline"
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Choose a font">
            <span style={{ fontFamily: FONT_OPTIONS.find((f) => f.name === value)?.stack || value }}>
              {value || "Choose a font"}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {["Sans Serif", "Serif", "Monospace", "System"].map((cat) => {
            const fonts = filteredFonts.filter((f) => f.category === cat);
            if (fonts.length === 0) return null;
            return (
              <div key={cat}>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </div>
                {fonts.map((font) => (
                  <SelectItem key={font.name} value={font.name}>
                    <span className="flex items-center gap-3">
                      <span
                        className="text-sm"
                        style={{ fontFamily: font.stack }}
                      >
                        {font.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Aa Bb Cc 123
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </div>
            );
          })}
          <div className="border-t px-2 py-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                setCustom(true);
              }}
              className="w-full text-left text-xs text-primary hover:underline"
            >
              Enter custom font...
            </button>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
