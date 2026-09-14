import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center space-x-1.5 text-xs text-muted-foreground mb-4", className)}
    >
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Templates Dashboard</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            {isLast || !item.href ? (
              <span
                className={cn(
                  "truncate max-w-[240px] md:max-w-md font-medium",
                  isLast ? "text-foreground" : "text-muted-foreground"
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors truncate max-w-[160px]"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
