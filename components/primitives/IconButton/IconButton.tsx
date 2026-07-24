"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
  icon: LucideIcon;
  label: string;
  iconSize?: number;
}

export function IconButton({ icon: Icon, label, iconSize = 16, className, ...props }: IconButtonProps) {
  return (
    <Button aria-label={label} className={cn("gap-2", className)} {...props}>
      <Icon size={iconSize} />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
