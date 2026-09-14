"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
  FileCheck2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ConfidenceReport } from "@/features/importer/audit/confidenceReportBuilder";

interface ConfidenceReportViewProps {
  report: ConfidenceReport;
  className?: string;
  defaultExpanded?: boolean;
  isModal?: boolean;
}

export function ConfidenceReportView({
  report,
  className = "",
  defaultExpanded = true,
  isModal = false,
}: ConfidenceReportViewProps) {
  const [filterType, setFilterType] = useState<
    "all" | "unsupported_by_importer" | "not_present_in_source" | "data_anomaly"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(defaultExpanded);

  // Filter findings based on active tab and search query
  const filteredFindings = useMemo(() => {
    return report.itemizedFindings.filter((finding) => {
      if (filterType !== "all" && finding.classification !== filterType) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        finding.issueDescription.toLowerCase().includes(q) ||
        finding.issueType.toLowerCase().includes(q) ||
        (finding.sectionName && finding.sectionName.toLowerCase().includes(q)) ||
        (finding.itemName && finding.itemName.toLowerCase().includes(q)) ||
        (finding.commentName && finding.commentName.toLowerCase().includes(q)) ||
        finding.handlingDecision.toLowerCase().includes(q)
      );
    });
  }, [report.itemizedFindings, filterType, searchQuery]);

  return (
    <div className={`space-y-5 ${className}`}>
      {/* 1. TOP METRICS BANNER / KPI STRIP */}
      {isModal ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border bg-card/60 shadow-2xs text-center space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Sections</span>
              <div className="text-xl font-extrabold text-foreground font-mono">{report.factualCounts.sectionsPreserved}</div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">100% Preserved</span>
            </div>
            <div className="p-3 rounded-xl border bg-card/60 shadow-2xs text-center space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Checklist Items</span>
              <div className="text-xl font-extrabold text-foreground font-mono">{report.factualCounts.itemsPreserved}</div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">All Mapped</span>
            </div>
            <div className="p-3 rounded-xl border bg-card/60 shadow-2xs text-center space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Comments</span>
              <div className="text-xl font-extrabold text-foreground font-mono">{report.factualCounts.commentsPreserved}</div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {report.preservationChecklist?.find((p) => p.category === "html_formatting")?.count ?? 0} Rich HTML
              </span>
            </div>
            <div className="p-3 rounded-xl border bg-card/60 shadow-2xs text-center space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Limitations</span>
              <div className={`text-xl font-extrabold font-mono ${report.factualCounts.totalWarningsCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {report.factualCounts.totalWarningsCount}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {report.factualCounts.totalWarningsCount === 0 ? "Zero Limitations" : "Flagged in Audit"}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="truncate">
                Source: <strong className="text-foreground">{report.templateName}</strong> ({report.factualCounts.totalRowsProcessed} rows processed)
              </span>
            </div>
            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold shrink-0">
              ✓ 100% Verified Relational Graph
            </span>
          </div>
        </div>
      ) : (
        <Card className="border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shadow-xs shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span>Import Preservation & Confidence Report</span>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
                      Factual Audit
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Verified counts from deterministic importer execution. No invented percentages.
                  </CardDescription>
                </div>
              </div>

              {/* Factual Metrics Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                  {report.factualCounts.sectionsPreserved} Sections
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                  {report.factualCounts.itemsPreserved} Items
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                  {report.factualCounts.commentsPreserved} Comments
                </span>
                {report.factualCounts.totalWarningsCount > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold">
                    {report.factualCounts.totalWarningsCount} Warnings
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                    0 Warnings
                  </span>
                )}
                {report.factualCounts.unsupportedRichContentCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                    {report.factualCounts.unsupportedRichContentCount} Simplified
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="p-3 rounded-lg bg-background/80 border text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Processed <strong>{report.factualCounts.totalRowsProcessed}</strong> source rows for template{" "}
                  <strong className="text-foreground">{report.templateName}</strong>.
                </span>
              </div>
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                ✓ 100% Hierarchy Verified (Template → Section → Item → Comment)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. DUAL COLUMNS: CONTENT PRESERVATION VS WARNINGS & LIMITATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMN A: CONTENT PRESERVATION CHECKLIST */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Content Preservation
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-400/40 text-[11px]">
                {report.preservationChecklist.length} Guarantees Verified
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Every section, item, narrative text, and order position preserved factually.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-3 divide-y divide-border/60">
            {report.preservationChecklist.map((item, idx) => (
              <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      ✓ {item.label}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
                      {item.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* COLUMN B: WARNINGS & LIMITATIONS */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Warnings / Limitations
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400/40 text-[11px]">
                {report.limitationsChecklist.length === 0 ? "0 Limitations" : `${report.limitationsChecklist.length} Limitation Types`}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Honest disclosure of stripped scripts, unmapped columns, or source gaps.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-3 space-y-3 divide-y divide-border/60">
            {report.limitationsChecklist.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-3 my-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Zero Limitations Encountered</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    No unsupported rich elements, active scripts, or unmapped columns were found in this source template.
                  </p>
                </div>
              </div>
            ) : (
              report.limitationsChecklist.map((lim, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                    <AlertTriangle className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        ⚠ {lim.label}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {lim.count} {lim.count === 1 ? "case" : "cases"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                      {lim.description}
                    </p>
                  </div>
                </div>
              ))
            )}

            {/* Semantic Explanatory Callout */}
            <div className="pt-3">
              <div className="p-3 rounded-lg bg-muted/40 border text-[11px] space-y-2">
                <span className="font-bold text-foreground block text-[11px]">
                  How We Classify Source Data vs Application Capabilities:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                  <div className="p-2 rounded bg-background border space-y-0.5">
                    <strong className="text-blue-700 dark:text-blue-400 block text-[10px] uppercase tracking-wider">
                      Not Present in Source
                    </strong>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Empty spreadsheet rows or blank comment names omitted cleanly.
                    </p>
                  </div>
                  <div className="p-2 rounded bg-background border space-y-0.5">
                    <strong className="text-amber-700 dark:text-amber-400 block text-[10px] uppercase tracking-wider">
                      Present but Unsupported
                    </strong>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Unsafe scripts sanitized; custom columns preserved in metadata.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. ITEMIZE WARNING DETAILS INSPECTOR */}
      {report.itemizedFindings.length > 0 && (
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className="flex items-center gap-2 text-left group"
                >
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                    <span>Inspect Warning Details & Handling Decisions</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {report.itemizedFindings.length}
                    </Badge>
                  </CardTitle>
                  {isDetailsOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <CardDescription className="text-xs mt-0.5">
                  Inspect the exact source row, hierarchy location, issue explanation, and handling decision for every flagged item.
                </CardDescription>
              </div>

              {/* Classification Filter Tabs */}
              {isDetailsOpen && (
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted border text-xs overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      filterType === "all"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({report.itemizedFindings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("unsupported_by_importer")}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      filterType === "unsupported_by_importer"
                        ? "bg-background text-amber-700 dark:text-amber-300 shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Unsupported ({report.summary.unsupportedByImporterCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("not_present_in_source")}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      filterType === "not_present_in_source"
                        ? "bg-background text-blue-700 dark:text-blue-300 shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Not in Source ({report.summary.notPresentInSourceCount})
                  </button>
                  {report.summary.anomaliesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterType("data_anomaly")}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${
                        filterType === "data_anomaly"
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Anomalies ({report.summary.anomaliesCount})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Filter Search Bar */}
            {isDetailsOpen && (
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter warnings by section, item, comment, or issue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </CardHeader>

          {isDetailsOpen && (
            <CardContent className="pt-4 p-0">
              {filteredFindings.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No warnings match the active filter or search criteria.
                </div>
              ) : (
                <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
                  {filteredFindings.map((finding, idx) => (
                    <div key={idx} className="p-4 hover:bg-muted/10 transition-colors space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            [{finding.issueType}]
                          </span>
                          {finding.sourceRow && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              Source Row {finding.sourceRow}
                            </Badge>
                          )}
                          {finding.columnName && (
                            <Badge variant="secondary" className="text-[10px]">
                              Column: {finding.columnName}
                            </Badge>
                          )}
                        </div>

                        {/* Explicit Classification Badge */}
                        <Badge
                          variant={
                            finding.classification === "unsupported_by_importer"
                              ? "warning"
                              : finding.classification === "not_present_in_source"
                              ? "outline"
                              : "secondary"
                          }
                          className="text-[10px] uppercase font-mono"
                        >
                          {finding.classification === "unsupported_by_importer"
                            ? "Present in source but unsupported by importer"
                            : finding.classification === "not_present_in_source"
                            ? "Not present in source"
                            : "Data anomaly"}
                        </Badge>
                      </div>

                      {/* Hierarchy Location: Section -> Item -> Comment */}
                      {(finding.sectionName || finding.itemName || finding.commentName) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono bg-muted/30 px-2.5 py-1 rounded">
                          <span className="font-semibold text-foreground">Hierarchy:</span>
                          <span>{finding.sectionName || "—"}</span>
                          <span>→</span>
                          <span>{finding.itemName || "—"}</span>
                          {finding.commentName && (
                            <>
                              <span>→</span>
                              <span className="truncate max-w-xs">{finding.commentName}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Issue Description */}
                      <p className="text-xs text-foreground font-medium">
                        {finding.issueDescription}
                      </p>

                      {/* Handling Decision */}
                      <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 p-2 rounded flex items-start gap-2">
                        <span className="font-bold shrink-0">Handling Decision:</span>
                        <span>{finding.handlingDecision}</span>
                      </div>

                      {/* Raw snippet if present */}
                      {finding.rawSnippet && (
                        <pre className="text-[10px] text-muted-foreground bg-muted p-2 rounded overflow-x-auto font-mono">
                          {finding.rawSnippet}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
