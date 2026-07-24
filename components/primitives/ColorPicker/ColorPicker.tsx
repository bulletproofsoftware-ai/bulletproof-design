"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        {/* Clickable swatch — opens native color picker */}
        <div
          className="relative h-9 w-9 shrink-0 cursor-pointer rounded-lg border-2 border-border shadow-sm transition-all hover:scale-110 hover:shadow-md active:scale-95"
          style={{ backgroundColor: value }}
          onClick={() => colorInputRef.current?.click()}
          title={`Click to pick color for ${label}`}
        >
          {/* Hidden native color input */}
          <input
            ref={colorInputRef}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        {/* Hex text input */}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
