"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Upload,
  Copy,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
  X,
} from "lucide-react";
import { TemplateSummary } from "@/types/template";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function TemplatesDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<TemplateSummary | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load templates: ${res.statusText}`);
      }
      const data: TemplateSummary[] = await res.json();
      setTemplates(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load templates from the database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && deleteCandidate) {
        setDeleteCandidate(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteCandidate]);

  // --- Duplicate Handler ---
  const handleDuplicate = async (id: string, name: string) => {
    setActionLoadingId(`dup-${id}`);
    try {
      setBannerError(null);
      const res = await fetch(`/api/templates/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${name} (Independent Copy)` }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Duplication failed.");
      }

      const duplicated = await res.json().catch(() => null);
      if (duplicated && duplicated.id) {
        const summary: TemplateSummary = {
          id: duplicated.id,
          name: duplicated.name,
          description: duplicated.description,
          originalSource: duplicated.originalSource,
          sourceFilename: duplicated.sourceFilename,
          createdAt: duplicated.createdAt,
          updatedAt: duplicated.updatedAt,
          sectionCount: (duplicated.sections || []).length,
          itemCount: (duplicated.sections || []).reduce((acc: number, s: any) => acc + (s.items || []).length, 0),
          commentCount: (duplicated.sections || []).reduce(
            (acc: number, s: any) =>
              acc + (s.items || []).reduce((cAcc: number, it: any) => cAcc + (it.comments || []).length, 0),
            0
          ),
        };
        setTemplates((prev) => [summary, ...prev.filter((t) => t.id !== summary.id)]);
      }

      await fetchTemplates();
      toast.success(`Template "${name}" duplicated successfully.`, "Duplication Complete");
    } catch (err: any) {
      const msg = err?.message || "Duplication failed. Please try again.";
      setBannerError(`Could not duplicate template: ${msg}`);
      toast.error(msg, "Duplication Failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;

    setActionLoadingId(`del-${deleteCandidate.id}`);
    try {
      setBannerError(null);
      const res = await fetch(`/api/templates/${deleteCandidate.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Deletion failed.");
      }

      const deletedName = deleteCandidate.name;
      setDeleteCandidate(null);
      await fetchTemplates();
      toast.success(`Template "${deletedName}" deleted successfully.`, "Template Deleted");
    } catch (err: any) {
      const msg = err?.message || "Deletion failed. Please try again.";
      setBannerError(`Could not delete template: ${msg}`);
      toast.error(msg, "Deletion Failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2">
      <Breadcrumbs items={[{ label: "Templates" }]} />

      <PageHeader
        title="Inspection Templates"
        description="Review, customize, and clone your imported Spectora home inspection templates. Every duplicate is completely decoupled."
      >
        <div className="flex items-center gap-2.5">
          <Button
            onClick={fetchTemplates}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex items-center gap-1.5 h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button asChild size="sm" className="flex items-center gap-1.5 h-9 bg-blue-600 hover:bg-blue-700 shadow-xs">
            <Link href="/import">
              <Upload className="h-3.5 w-3.5" />
              <span>Import Spectora File</span>
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* Action Error Banner */}
      {bannerError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-900 dark:text-rose-200 flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-medium">{bannerError}</span>
          </div>
          <button
            onClick={() => setBannerError(null)}
            className="text-rose-600 hover:text-rose-800 dark:hover:text-rose-100 p-1 rounded-md transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Boundary Banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <Button onClick={fetchTemplates} variant="outline" size="sm" className="h-8">
            Retry Connection
          </Button>
        </div>
      )}


      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse border bg-card/60 p-6 space-y-4">
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted/60 rounded" />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="h-10 bg-muted/40 rounded" />
                <div className="h-10 bg-muted/40 rounded" />
                <div className="h-10 bg-muted/40 rounded" />
              </div>
              <div className="h-8 bg-muted/50 rounded pt-2" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && templates.length === 0 && (
        <Card className="border-dashed border-2 py-16 text-center">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 shadow-xs">
              <Layers className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-foreground">
                No templates in database
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Import your first Spectora HTML-text spreadsheet export. The importer will faithfully parse all sections, items, and comments into real database entities.
              </p>
            </div>

            <div className="pt-2">
              <Button asChild size="default" className="flex items-center gap-2 mx-auto">
                <Link href="/import">
                  <Upload className="h-4 w-4" />
                  <span>Import Spectora Spreadsheet</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Populated Templates Grid */}
      {!loading && !error && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => {
            const isCloned = tpl.originalSource?.startsWith("clone:");
            const hasWarnings = tpl.importStatus === "completed_with_warnings" || (tpl.warningCount && tpl.warningCount > 0);

            return (
              <Card
                key={tpl.id}
                className="flex flex-col justify-between border shadow-xs hover:shadow-md transition-shadow bg-card"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-base font-bold truncate text-foreground" title={tpl.name}>
                        {tpl.name}
                      </CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1 text-muted-foreground">
                        <FileSpreadsheet className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {tpl.sourceFilename || (isCloned ? "Duplicated Copy" : "Spectora Export")}
                        </span>
                      </CardDescription>
                    </div>

                    {/* Origin / Warning Badge */}
                    <div className="shrink-0">
                      {hasWarnings ? (
                        <Badge variant="warning" className="text-[10px] flex items-center gap-1 font-mono">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{tpl.warningCount || 0} Warnings</span>
                        </Badge>
                      ) : isCloned ? (
                        <Badge variant="secondary" className="text-[10px] flex items-center gap-1 font-mono">
                          <Copy className="h-3 w-3" />
                          <span>Clone</span>
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] flex items-center gap-1 font-mono">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Clean</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pb-4">
                  {/* Entity Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-2.5 text-center">
                    <div className="space-y-0.5">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Sections
                      </div>
                      <div className="text-base font-extrabold text-foreground font-mono">
                        {tpl.sectionCount}
                      </div>
                    </div>

                    <div className="space-y-0.5 border-x border-border/50">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Items
                      </div>
                      <div className="text-base font-extrabold text-foreground font-mono">
                        {tpl.itemCount}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Comments
                      </div>
                      <div className="text-base font-extrabold text-foreground font-mono">
                        {tpl.commentCount}
                      </div>
                    </div>
                  </div>

                  {/* Audit Timestamp */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Updated {formatDate(tpl.updatedAt)}</span>
                  </div>
                </CardContent>

                {/* Actions Footer */}
                <CardFooter className="flex items-center justify-between border-t pt-3 pb-3 bg-muted/10">
                  <Button
                    onClick={() => setDeleteCandidate(tpl)}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                    title="Delete Template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleDuplicate(tpl.id, tpl.name)}
                      variant="outline"
                      size="sm"
                      disabled={actionLoadingId === `dup-${tpl.id}`}
                      className="flex items-center gap-1 text-xs h-8 px-2.5"
                      title="Create independent deep copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{actionLoadingId === `dup-${tpl.id}` ? "Cloning..." : "Duplicate"}</span>
                    </Button>

                    <Button
                      onClick={() => router.push(`/templates/${tpl.id}`)}
                      size="sm"
                      className="flex items-center gap-1 text-xs h-8 px-3"
                    >
                      <span>Open</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full border-destructive/40 shadow-xl">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-lg">Delete Template</CardTitle>
              </div>
              <CardDescription className="text-xs pt-1">
                Are you sure you want to delete <strong className="text-foreground">{deleteCandidate.name}</strong>?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will permanently delete this template along with its {deleteCandidate.sectionCount} sections, {deleteCandidate.itemCount} items, and {deleteCandidate.commentCount} comments. If this template has independent duplicates, they will remain completely untouched.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-3">
              <Button
                onClick={() => setDeleteCandidate(null)}
                variant="outline"
                size="sm"
                disabled={actionLoadingId === `del-${deleteCandidate.id}`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                variant="destructive"
                size="sm"
                disabled={actionLoadingId === `del-${deleteCandidate.id}`}
                className="flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{actionLoadingId === `del-${deleteCandidate.id}` ? "Deleting..." : "Delete Permanently"}</span>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
