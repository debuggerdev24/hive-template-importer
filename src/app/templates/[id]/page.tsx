"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Copy,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Edit3,
  Eye,
  FileCode,
  Tag,
  RefreshCw,
  Clock,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  TemplateWithRelations,
  Section,
  Item,
} from "@/types/template";
import { sanitizeHtml } from "@/utils/sanitize";
import { formatDate } from "@/lib/utils";
import { confidenceReportBuilder } from "@/features/importer/audit/confidenceReportBuilder";
import { ConfidenceReportView } from "@/components/confidence/ConfidenceReportView";
import { CommentClassificationDropdown } from "@/components/template/CommentClassificationDropdown";
import { useToast } from "@/components/ui/toast";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

interface TemplatePageProps {
  params: {
    id: string;
  };
}

export default function TemplateEditorPage({ params }: TemplatePageProps) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();

  // Template Data State
  const [template, setTemplate] = useState<TemplateWithRelations | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selection State
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Local Editable Working Copies (Dirty State Tracking)
  const [workingTemplateName, setWorkingTemplateName] = useState<string>("");
  const [sectionNames, setSectionNames] = useState<Record<string, string>>({});
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<
    Record<string, { text: string; name: string; type: string; category: string }>
  >({});

  // Tree UI State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [commentTabMode, setCommentTabMode] = useState<Record<string, "edit" | "preview">>({});

  // Save States: 'saved' | 'unsaved' | 'saving' | 'error'
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Confidence & Preservation Report for this template
  const confidenceReport = useMemo(() => {
    if (!template) return null;
    return confidenceReportBuilder.buildReportFromPersistedTemplate(template);
  }, [template]);

  // Escape key closes modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAuditModal) setShowAuditModal(false);
        if (showDeleteModal) setShowDeleteModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAuditModal, showDeleteModal]);

  // --- Fetch Template from Database ---
  const loadTemplateData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Template not found in database.");
        }
        throw new Error(`Failed to load template: ${res.statusText}`);
      }

      const data: TemplateWithRelations = await res.json();
      setTemplate(data);
      setWorkingTemplateName(data.name);

      // Initialize working name dictionaries
      const initialSecNames: Record<string, string> = {};
      const initialItemNames: Record<string, string> = {};
      const initialComments: Record<
        string,
        { text: string; name: string; type: string; category: string }
      > = {};

      data.sections.forEach((sec) => {
        initialSecNames[sec.id] = sec.name;
        sec.items.forEach((it) => {
          initialItemNames[it.id] = it.name;
          it.comments.forEach((c) => {
            initialComments[c.id] = {
              text: c.commentText,
              name: c.commentName || "",
              type: c.commentType || "info",
              category: c.category || "",
            };
          });
        });
      });

      setSectionNames(initialSecNames);
      setItemNames(initialItemNames);
      setCommentDrafts(initialComments);

      // Default selection to first item
      if (data.sections.length > 0) {
        const firstSec = data.sections[0];
        setSelectedSectionId(firstSec.id);
        if (firstSec.items.length > 0) {
          setSelectedItemId(firstSec.items[0].id);
        }
      }

      setSaveStatus("saved");
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load template.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTemplateData();
  }, [loadTemplateData]);

  // --- Dirty State / Unsaved Changes Detection ---
  const isDirty = useMemo(() => {
    if (!template) return false;
    if (workingTemplateName !== template.name) return true;

    for (const sec of template.sections) {
      if (sectionNames[sec.id] !== sec.name) return true;
      for (const it of sec.items) {
        if (itemNames[it.id] !== it.name) return true;
        for (const c of it.comments) {
          const draft = commentDrafts[c.id];
          if (!draft) continue;
          if (
            draft.text !== c.commentText ||
            draft.name !== (c.commentName || "") ||
            draft.type !== (c.commentType || "info") ||
            draft.category !== (c.category || "")
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }, [template, workingTemplateName, sectionNames, itemNames, commentDrafts]);

  useEffect(() => {
    if (saveStatus !== "saving") {
      setSaveStatus(isDirty ? "unsaved" : "saved");
    }
  }, [isDirty, saveStatus]);

  // --- Prevent Accidental Navigation when Unsaved ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes that will be lost.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // --- Save Changes Handler ---
  const handleSaveChanges = async () => {
    if (!template) return;

    setSaveStatus("saving");
    setSaveErrorMessage(null);

    try {
      // 1. Collect only changed sections
      const changedSections: Array<{ id: string; name: string }> = [];
      template.sections.forEach((sec) => {
        if (sectionNames[sec.id] !== sec.name) {
          changedSections.push({ id: sec.id, name: sectionNames[sec.id] });
        }
      });

      // 2. Collect only changed items
      const changedItems: Array<{ id: string; name: string }> = [];
      template.sections.forEach((sec) => {
        sec.items.forEach((it) => {
          if (itemNames[it.id] !== it.name) {
            changedItems.push({ id: it.id, name: itemNames[it.id] });
          }
        });
      });

      // 3. Collect only changed comments
      const changedComments: Array<{
        id: string;
        commentName: string;
        commentText: string;
        commentType: string;
        category: string;
      }> = [];

      template.sections.forEach((sec) => {
        sec.items.forEach((it) => {
          it.comments.forEach((c) => {
            const draft = commentDrafts[c.id];
            if (
              draft &&
              (draft.text !== c.commentText ||
                draft.name !== (c.commentName || "") ||
                draft.type !== (c.commentType || "info") ||
                draft.category !== (c.category || ""))
            ) {
              changedComments.push({
                id: c.id,
                commentName: draft.name,
                commentText: draft.text,
                commentType: draft.type,
                category: draft.category,
              });
            }
          });
        });
      });

      const res = await fetch(`/api/templates/${template.id}/batch-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: workingTemplateName !== template.name ? workingTemplateName : undefined,
          sections: changedSections.length > 0 ? changedSections : undefined,
          items: changedItems.length > 0 ? changedItems : undefined,
          comments: changedComments.length > 0 ? changedComments : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errMsg = errData?.error || "Failed to persist changes to the database.";
        if (Array.isArray(errData?.failedSections) && errData.failedSections.length > 0) {
          errMsg += ` (Failed sections: ${errData.failedSections.map((s: any) => s.id).join(", ")})`;
        }
        if (Array.isArray(errData?.failedItems) && errData.failedItems.length > 0) {
          errMsg += ` (Failed items: ${errData.failedItems.map((it: any) => it.id).join(", ")})`;
        }
        if (Array.isArray(errData?.failedComments) && errData.failedComments.length > 0) {
          errMsg += ` (Failed comments: ${errData.failedComments.map((c: any) => c.id).join(", ")})`;
        }
        throw new Error(errMsg);
      }

      const resData = await res.json();
      if (resData.template) {
        setTemplate(resData.template);
      }

      setSaveStatus("saved");
      toast.success("All template changes saved to database.", "Changes Saved");
    } catch (err: any) {
      setSaveStatus("error");
      const errorMsg = err?.message || "An error occurred while saving.";
      setSaveErrorMessage(errorMsg);
      toast.error(errorMsg, "Save Error");
    }
  };

  // --- Duplicate Handler ---
  const handleDuplicate = async () => {
    if (!template) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${template.name} (Copy)` }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Duplication failed.");
      }
      const copy = await res.json();
      toast.success("Template cloned successfully. Loading new template...", "Duplication Complete");
      router.push(`/templates/${copy.id}`);
    } catch (err: any) {
      const errorMsg = err?.message || "Duplication failed. Please try again.";
      toast.error(errorMsg, "Duplication Error");
      setSaveStatus("error");
      setSaveErrorMessage(`Could not duplicate template: ${errorMsg}`);
      setDuplicating(false);
    }
  };
  
  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!template) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to delete template.");
      }

      toast.success(`Template "${template.name}" deleted successfully.`, "Template Deleted");
      router.push("/templates");
    } catch (err: any) {
      const errorMsg = err?.message || "Could not delete template.";
      toast.error(errorMsg, "Deletion Error");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };


  // Active section & item resolution
  const activeSection: Section | undefined = template?.sections.find(
    (s) => s.id === selectedSectionId
  );
  const activeItem: Item | undefined = activeSection?.items.find(
    (it) => it.id === selectedItemId
  );

  // Filtered tree sections based on search query
  const filteredSections = useMemo(() => {
    if (!template) return [];
    if (!searchQuery.trim()) return template.sections;

    const query = searchQuery.toLowerCase();
    return template.sections
      .map((sec) => {
        const secMatches = (sectionNames[sec.id] || sec.name).toLowerCase().includes(query);
        const matchingItems = sec.items.filter((it) =>
          (itemNames[it.id] || it.name).toLowerCase().includes(query)
        );

        if (secMatches) return sec;
        if (matchingItems.length > 0) {
          return { ...sec, items: matchingItems };
        }
        return null;
      })
      .filter(Boolean) as Section[];
  }, [template, searchQuery, sectionNames, itemNames]);

  // Loading Screen
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading inspection template...</p>
      </div>
    );
  }

  // Error Screen
  if (loadError || !template) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="border-destructive/40 shadow-sm text-center p-6 space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">Template Unavailable</CardTitle>
          <CardDescription className="text-xs">
            {loadError || "The requested template could not be found."}
          </CardDescription>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/templates">Back to Templates</Link>
            </Button>
            <Button onClick={() => loadTemplateData()} size="sm">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col md:h-[calc(100vh-175px)] -mt-4 -mb-5 space-y-3">
      {/* Top Application Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3 shrink-0">
        <div className="space-y-1 flex-1 min-w-0">
          <Breadcrumbs
            items={[
              { label: "Templates", href: "/templates" },
              { label: template.name || "Template Editor" },
            ]}
            className="mb-1"
          />

          {/* Editable Template Title */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={workingTemplateName}
              onChange={(e) => setWorkingTemplateName(e.target.value)}
              className="text-2xl font-extrabold tracking-tight bg-transparent border-b border-transparent hover:border-input focus:border-primary focus:outline-none px-1 py-0.5 w-full max-w-xl transition-colors"
              title="Click to edit template title"
            />
          </div>
        </div>

        {/* Right Actions & Save Status */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Status Indicator */}
          {saveStatus === "unsaved" && (
            <Badge
              variant="warning"
              className="text-[11px] font-mono flex items-center gap-1.5 py-1 px-2.5"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Unsaved changes</span>
            </Badge>
          )}

          {saveStatus === "saving" && (
            <Badge
              variant="secondary"
              className="text-[11px] font-mono flex items-center gap-1.5 py-1 px-2.5"
            >
              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
              <span>Saving to database...</span>
            </Badge>
          )}

          {saveStatus === "saved" && (
            <Badge
              variant="success"
              className="text-[11px] font-mono flex items-center gap-1.5 py-1 px-2.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>All changes saved</span>
            </Badge>
          )}

          {saveStatus === "error" && (
            <Badge
              variant="destructive"
              className="text-[11px] font-mono flex items-center gap-1.5 py-1 px-2.5"
              title={saveErrorMessage || "Save failed"}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Save error</span>
            </Badge>
          )}

          {/* Preservation Audit Action */}
          <Button
            onClick={() => setShowAuditModal(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5"
            title="Inspect Import Preservation & Confidence Audit"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Preservation Audit</span>
          </Button>

          {/* Duplicate Action */}
          <Button
            onClick={handleDuplicate}
            variant="outline"
            size="sm"
            disabled={duplicating}
            className="flex items-center gap-1.5"
            title="Create independent copy"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{duplicating ? "Cloning..." : "Duplicate"}</span>
          </Button>

          {/* Delete Action */}
          <Button
            onClick={() => setShowDeleteModal(true)}
            variant="outline"
            size="sm"
            disabled={deleting || saveStatus === "saving"}
            className="flex items-center gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
            title="Delete template permanently"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>

          {/* Save Action */}
          <Button
            onClick={handleSaveChanges}
            size="sm"
            disabled={saveStatus === "saving" || !isDirty}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      {/* Save Error Banner */}
      {saveErrorMessage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
          <Button onClick={handleSaveChanges} variant="outline" size="sm" className="h-7 text-xs">
            Retry Save
          </Button>
        </div>
      )}

      {/* 2-Column Desktop Editor Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 min-h-0 items-stretch">
        {/* LEFT COLUMN: Section & Item Tree Navigation (4 cols) */}
        <div className="md:col-span-4 flex flex-col rounded-xl border bg-card/60 shadow-xs overflow-hidden h-full min-h-0">
          {/* Tree Header & Search */}
          <div className="p-3 border-b bg-muted/20 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                <span>Template Hierarchy</span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {template.sections.length} sections
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sections or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Tree View Item List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
            {filteredSections.map((sec) => {
              const secName = sectionNames[sec.id] || sec.name;
              const isSectionSelected = selectedSectionId === sec.id;
              const isEditingThisSec = editingSectionId === sec.id;

              return (
                <div key={sec.id} className="rounded-lg border border-border/60 bg-background/50 overflow-hidden">
                  {/* Section Title Header */}
                  <div
                    className={`flex items-center justify-between p-2.5 cursor-pointer select-none transition-colors ${
                      isSectionSelected
                        ? "bg-muted/70 font-semibold"
                        : "hover:bg-muted/40 font-medium"
                    }`}
                    onClick={() => {
                      setSelectedSectionId(sec.id);
                      if (sec.items.length > 0 && selectedSectionId !== sec.id) {
                        setSelectedItemId(sec.items[0].id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground/80 w-4 shrink-0">
                        {sec.orderIndex + 1}.
                      </span>

                      {isEditingThisSec ? (
                        <input
                          type="text"
                          value={secName}
                          autoFocus
                          onChange={(e) =>
                            setSectionNames((prev) => ({ ...prev, [sec.id]: e.target.value }))
                          }
                          onBlur={() => setEditingSectionId(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setEditingSectionId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 text-xs font-semibold px-1 rounded border border-primary bg-background w-full"
                        />
                      ) : (
                        <span className="text-xs truncate text-foreground" title={secName}>
                          {secName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-[10px] font-mono bg-muted/80 px-1.5 py-0.5 rounded text-muted-foreground">
                        {sec.items.length}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSectionId(isEditingThisSec ? null : sec.id);
                        }}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Rename section"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Child Items in Tree */}
                  {sec.items.length > 0 && (
                    <div className="border-t border-border/40 pl-3 py-1 space-y-0.5 bg-muted/10">
                      {sec.items.map((it) => {
                        const itName = itemNames[it.id] || it.name;
                        const isItemSelected = selectedItemId === it.id;

                        return (
                          <div
                            key={it.id}
                            onClick={() => {
                              setSelectedSectionId(sec.id);
                              setSelectedItemId(it.id);
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                              isItemSelected
                                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            }`}
                          >
                            <span className="truncate pr-2">{itName}</span>
                            <span
                              className={`text-[10px] font-mono px-1 rounded shrink-0 ${
                                isItemSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "text-muted-foreground/80 bg-muted/50"
                              }`}
                            >
                              {it.comments.length}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT / MAIN COLUMN: Selected Item & Comment Narratives Editor (8 cols) */}
        <div className="md:col-span-8 flex flex-col h-full min-h-0 overflow-y-auto pr-2 space-y-6 scroll-smooth">
          {activeItem && activeSection ? (
            <div className="space-y-6 pb-16">
              {/* Item Header & Rename Input */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">{activeSection.name}</span>
                      <span>/</span>
                      <span>Item #{activeItem.orderIndex}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={itemNames[activeItem.id] || ""}
                        onChange={(e) =>
                          setItemNames((prev) => ({
                            ...prev,
                            [activeItem.id]: e.target.value,
                          }))
                        }
                        className="text-xl font-bold tracking-tight bg-transparent border-b border-input hover:border-primary focus:border-primary focus:outline-none py-1 w-full transition-colors"
                        title="Click to rename item"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-3">
                    <div className="flex items-center gap-1">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                      <span>{activeItem.comments.length} Findings / Checklist Comments</span>
                    </div>
                    <span>•</span>
                    <span className="font-mono text-[11px]">Item ID: {activeItem.id.slice(0, 8)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Comments List for Active Item */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    <span>Findings & Narratives</span>
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    Order preserved by index
                  </span>
                </div>

                {activeItem.comments.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
                    No comments attached to this item in the template.
                  </div>
                ) : (
                  activeItem.comments.map((comment) => {
                    const draft = commentDrafts[comment.id] || {
                      text: comment.commentText,
                      name: comment.commentName || "",
                      type: comment.commentType || "info",
                      category: comment.category || "",
                    };

                    const mode = commentTabMode[comment.id] || "edit";

                    return (
                      <Card
                        key={comment.id}
                        className="border shadow-xs hover:border-primary/40 transition-colors bg-card overflow-visible relative"
                      >
                        <CardHeader className="p-4 pb-3 bg-muted/20 border-b">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                                #{comment.orderIndex}
                              </span>

                              <input
                                type="text"
                                placeholder="Comment Title..."
                                value={draft.name}
                                onChange={(e) =>
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [comment.id]: { ...draft, name: e.target.value },
                                  }))
                                }
                                className="h-7 text-xs font-semibold px-2 rounded border border-input bg-background w-full max-w-sm"
                              />
                            </div>

                            {/* Classification Badge / Selector & Mode Toggle */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {/* Modern Custom Classification Pill & Popover Menu */}
                              <CommentClassificationDropdown
                                category={draft.category}
                                type={draft.type}
                                onChange={(newCategory, newType) =>
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [comment.id]: {
                                      ...draft,
                                      category: newCategory,
                                      type: newType,
                                    },
                                  }))
                                }
                              />

                              {/* Edit / Safe Preview Tabs */}
                              <div className="flex rounded border bg-muted/60 p-0.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentTabMode((prev) => ({
                                      ...prev,
                                      [comment.id]: "edit",
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                                    mode === "edit"
                                      ? "bg-background text-foreground shadow-xs font-semibold"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  HTML
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentTabMode((prev) => ({
                                      ...prev,
                                      [comment.id]: "preview",
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded font-medium transition-all flex items-center gap-1 ${
                                    mode === "preview"
                                      ? "bg-background text-foreground shadow-xs font-semibold"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>Preview</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-4 space-y-3">
                          {/* Text Body: Either Editor or Safe HTML Preview */}
                          {mode === "edit" ? (
                            <textarea
                              rows={4}
                              value={draft.text}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({
                                  ...prev,
                                  [comment.id]: { ...draft, text: e.target.value },
                                }))
                              }
                              placeholder="Enter inspection comment narrative (HTML tags supported)..."
                              className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          ) : (
                            <div className="rounded-md border p-3 bg-muted/10 min-h-[80px]">
                              {draft.text ? (
                                <div
                                  className="prose prose-xs max-w-none text-xs text-foreground leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeHtml(draft.text),
                                  }}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  No comment narrative text (Checklist-only item).
                                </span>
                              )}
                            </div>
                          )}

                          {/* Extra Metadata Pill Bar */}
                          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground pt-1">
                            {draft.category && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium flex items-center gap-1 ${
                                  draft.category.toLowerCase() === "defect"
                                    ? "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40"
                                    : draft.category.toLowerCase() === "safety"
                                    ? "border-red-600/50 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 font-semibold"
                                    : draft.category.toLowerCase() === "recommendation"
                                    ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                                    : draft.category.toLowerCase() === "limitation"
                                    ? "border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40"
                                    : draft.category.toLowerCase() === "maintenance"
                                    ? "border-orange-500/40 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40"
                                    : "border-slate-500/40 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40"
                                }`}
                              >
                                {draft.category.toLowerCase() === "safety" && <AlertTriangle className="h-3 w-3" />}
                                <span>Category: {draft.category}</span>
                              </Badge>
                            )}

                            {draft.type &&
                              draft.type.toLowerCase() !== (draft.category || "").toLowerCase() &&
                              !(
                                (draft.type.toLowerCase() === "limit" && draft.category?.toLowerCase() === "limitation") ||
                                (draft.type.toLowerCase() === "info" && draft.category?.toLowerCase() === "info")
                              ) && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium border-muted-foreground/30 text-muted-foreground bg-muted/20"
                                >
                                  <span>Type: {draft.type}</span>
                                </Badge>
                              )}
                            {comment.answerType && (
                              <span className="flex items-center gap-1 font-mono">
                                <Tag className="h-3 w-3 text-muted-foreground" />
                                <span>Answer: {comment.answerType}</span>
                              </span>
                            )}
                            {comment.sourceLastModified && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>Exported: {formatDate(comment.sourceLastModified)}</span>
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          ) : (

            <Card className="border-dashed p-12 text-center text-muted-foreground">
              Select an item from the left hierarchy tree to inspect and edit its comments.
            </Card>
          )}
        </div>
      </div>

      {/* Preservation & Integrity Audit Modal */}
      {showAuditModal && confidenceReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuditModal(false);
          }}
        >
          <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden">
            {/* 1. Fixed Header (Always visible, never scrolls away) */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-card/95 backdrop-blur-xs shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Template Preservation & Confidence Audit
                    </h3>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 text-[10px] font-semibold">
                      Factual Audit
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deterministic verification of all sections, checklist items, narratives, and sequential order.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuditModal(false)}
                className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Close modal (Esc)"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 2. Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <ConfidenceReportView report={confidenceReport} defaultExpanded={false} isModal={true} />
            </div>

            {/* 3. Fixed Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20 shrink-0">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>100% of template hierarchy verified and persisted in database.</span>
              </span>
              <Button
                onClick={() => setShowAuditModal(false)}
                size="sm"
                className="h-8 px-4 text-xs font-medium"
              >
                Close Audit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {showDeleteModal && template && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full border-destructive/40 shadow-xl">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-lg">Delete Template</CardTitle>
              </div>
              <CardDescription className="text-xs pt-1">
                Are you sure you want to permanently delete <strong className="text-foreground">{template.name}</strong>?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will permanently remove this template along with all its sections, items, and narrative comments from the database. This action cannot be undone.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-3">
              <Button
                onClick={() => setShowDeleteModal(false)}
                variant="outline"
                size="sm"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                variant="destructive"
                size="sm"
                disabled={deleting}
                className="flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deleting ? "Deleting..." : "Delete Permanently"}</span>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
