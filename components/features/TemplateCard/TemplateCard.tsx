import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TemplateCardProps {
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  onClick?: () => void;
  className?: string;
}

export function TemplateCard({
  name,
  description,
  category,
  tags = [],
  onClick,
  className,
}: TemplateCardProps) {
  return (
    <div
      className={cn("template-card", className)}
      onClick={onClick}
    >
      <h3 className="text-sm font-semibold text-foreground">{name}</h3>
      {description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] hover:bg-blue-100">
          {category}
        </Badge>
        {tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-500 border-0 text-[10px]">
            {tag}
          </Badge>
        ))}
        {tags.length > 3 && (
          <Badge variant="secondary" className="bg-slate-50 text-slate-400 border-0 text-[10px]">
            +{tags.length - 3}
          </Badge>
        )}
      </div>
    </div>
  );
}
