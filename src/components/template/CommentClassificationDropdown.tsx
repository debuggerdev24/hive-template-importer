"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface ClassificationOption {
  id: string;
  label: string;
  category: string;
  type: string;
  dot: string;
}

export const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  { id: "defect", label: "Defect", category: "Defect", type: "defect", dot: "bg-rose-500" },
  { id: "safety", label: "Safety Hazard", category: "Safety", type: "safety", dot: "bg-red-600" },
  { id: "recommendation", label: "Recommendation", category: "Recommendation", type: "recommendation", dot: "bg-amber-500" },
  { id: "limitation", label: "Limitation", category: "Limitation", type: "limit", dot: "bg-blue-500" },
  { id: "maintenance", label: "Maintenance", category: "Maintenance", type: "maintenance", dot: "bg-orange-500" },
  { id: "info", label: "Information", category: "Info", type: "info", dot: "bg-slate-400" },
];

interface CommentClassificationDropdownProps {
  category?: string | null;
  type?: string | null;
  onChange: (category: string, type: string) => void;
  disabled?: boolean;
}

export function CommentClassificationDropdown({
  category,
  type,
  onChange,
  disabled = false,
}: CommentClassificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedCat = (category || "").toLowerCase().trim();
  const normalizedType = (type || "").toLowerCase().trim();

  const matched = CLASSIFICATION_OPTIONS.find((opt) => {
    const optCat = opt.category.toLowerCase();
    const optType = opt.type.toLowerCase();
    return (
      optCat === normalizedCat ||
      optType === normalizedType ||
      (opt.id === "limitation" && (normalizedType === "limitation" || normalizedType === "limit" || normalizedCat === "limitation")) ||
      (opt.id === "safety" && (normalizedCat === "safety hazard" || normalizedCat === "safety" || normalizedType === "safety")) ||
      (opt.id === "info" && (normalizedCat === "information" || normalizedCat === "info" || normalizedType === "information" || normalizedType === "info")) ||
      (opt.id === "recommendation" && (normalizedCat === "recommendation" || normalizedType === "recommendation")) ||
      (opt.id === "maintenance" && (normalizedCat === "maintenance" || normalizedType === "maintenance")) ||
      (opt.id === "defect" && (normalizedCat === "defect" || normalizedType === "defect"))
    );
  });

  const activeLabel = matched ? matched.label : category || type || "Information";
  const activeDot = matched ? matched.dot : "bg-primary";

  // Check available viewport space to automatically position dropdown above or below
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const calculatePlacement = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownEstimatedHeight = 210; // 6 items (~32px each) + padding + border
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If not enough room below and more room above, flip upward
      if (spaceBelow < dropdownEstimatedHeight && spaceAbove > spaceBelow) {
        setPlacement("top");
      } else {
        setPlacement("bottom");
      }
    };

    calculatePlacement();
    window.addEventListener("resize", calculatePlacement);
    window.addEventListener("scroll", calculatePlacement, true);

    return () => {
      window.removeEventListener("resize", calculatePlacement);
      window.removeEventListener("scroll", calculatePlacement, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Compact Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="h-7 px-2.5 rounded border border-input bg-background hover:bg-muted/50 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer select-none focus:outline-none"
      >
        <span className={`h-2 w-2 rounded-full ${activeDot} shrink-0`} />
        <span>{activeLabel}</span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Simple, Compact Floating Menu with Auto-Flip Positioning */}
      {isOpen && (
        <div
          className={`absolute right-0 w-44 rounded-md border border-border bg-popover py-1 shadow-md z-50 animate-in fade-in-0 zoom-in-95 duration-70 ${
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {CLASSIFICATION_OPTIONS.map((opt) => {
            const isSelected = matched?.id === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.category, opt.type);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${opt.dot} shrink-0`} />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
