"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import { ImportExecutionSummary, WarningSummaryItem } from "@/services/templateImportService";
import { ConfidenceReportView } from "@/components/confidence/ConfidenceReportView";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

const MAX_SIZE_MB = 15;
const ALLOWED_EXTENSIONS = [".xls", ".xlsx", ".html", ".htm", ".txt", ".csv"];

export default function ImportWorkflowPage() {
  const router = useRouter();

  // Workflow states: 'input' | 'uploading' | 'summary'
  const [stage, setStage] = useState<"input" | "uploading" | "summary">("input");
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");

  // Selected file and form values
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedHtml, setPastedHtml] = useState<string>("");
  const [templateName, setTemplateName] = useState<string>("");

  // Validation & Error states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Import Result
  const [importSummary, setImportSummary] = useState<ImportExecutionSummary | null>(null);
  const [showWarningsDetail, setShowWarningsDetail] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight import request when navigating away
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // --- Drag and Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setValidationError(null);

    // 1. Check extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(
        `Invalid file type '${ext}'. Spectora exports use .xls (OpenXML spreadsheet) or .html.`
      );
      setSelectedFile(null);
      return;
    }

    // 2. Check size
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      setValidationError(
        `File is too large (${sizeMb.toFixed(1)}MB). Maximum allowed size is ${MAX_SIZE_MB}MB.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);


    // Auto-populate template name from filename if not set
    if (!templateName) {
      const cleanName = file.name
        .replace(/\.(xls|xlsx|html|htm)$/i, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setTemplateName(cleanName);
    }
  };

  // --- Submit Import Execution ---
  const handleExecuteImport = async () => {
    setValidationError(null);
    setStage("uploading");

    // Cancel any previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let res: Response;

      if (activeTab === "file") {
        if (!selectedFile) {
          throw new Error("No file selected.");
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        if (templateName.trim()) {
          formData.append("templateName", templateName.trim());
        }

        res = await fetch("/api/import", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
      } else {
        if (!pastedHtml.trim()) {
          throw new Error("HTML content is empty.");
        }

        res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: pastedHtml,
            templateName: templateName.trim() || undefined,
            filename: "pasted_spectora_table.html",
          }),
          signal: controller.signal,
        });
      }

      if (!res.ok) {
        let errorMsg = `Server error (${res.status}): ${res.statusText || "Import processing failed."}`;
        try {
          const errData = await res.json();
          // If server returned structured ImportExecutionSummary (e.g. 422 with failure diagnostics)
          if (errData && (errData.status === "failed" || errData.confidenceReport || Array.isArray(errData.warnings))) {
            setImportSummary(errData);
            setStage("summary");
            return;
          }
          if (errData?.error) {
            errorMsg = errData.error;
          } else if (Array.isArray(errData?.errors) && errData.errors.length > 0) {
            errorMsg = errData.errors.join("; ");
          }
        } catch {
          // Response body was not valid JSON (e.g. 500 HTML error page or 504 gateway timeout)
        }
        throw new Error(errorMsg);
      }

      const summary: ImportExecutionSummary = await res.json();
      setImportSummary(summary);
      setStage("summary");
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Request was aborted intentionally, do not display error banner
        setStage("input");
        return;
      }
      setValidationError(err?.message || "Import execution encountered an unexpected network failure.");
      setStage("input");
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSelectedFile(null);
    setPastedHtml("");
    setTemplateName("");
    setValidationError(null);
    setImportSummary(null);
    setStage("input");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      <Breadcrumbs
        items={[
          { label: "Templates", href: "/templates" },
          { label: "Import Spectora File" },
        ]}
      />

      <PageHeader
        title="Spectora Template Importer"
        description="Ingest Spectora HTML-text spreadsheet exports into a structured relational template with order preservation and honest diagnostics."
      />

      {/* Step Indicators */}
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
            stage === "input"
              ? "border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200"
              : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px]">
            1
          </span>
          <span>Upload File</span>
        </div>

        <div
          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
            stage === "uploading"
              ? "border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200"
              : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px]">
            2
          </span>
          <span>Validate & Parse</span>
        </div>

        <div
          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
            stage === "summary"
              ? "border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200"
              : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px]">
            3
          </span>
          <span>Review & Open</span>
        </div>
      </div>

      {/* STAGE 1: FILE INPUT / DROPZONE */}
      {stage === "input" && (
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Select Spectora Template</CardTitle>
                <CardDescription>
                  Upload your spreadsheet export from Spectora (Export to spreadsheet → Export HTML Text).
                </CardDescription>
              </div>

              {/* Mode Tabs */}
              <div className="flex rounded-md border bg-muted/60 p-1 text-xs font-medium self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("file");
                    setValidationError(null);
                  }}
                  className={`rounded px-3 py-1.5 transition-all ${
                    activeTab === "file"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Spreadsheet File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("paste");
                    setValidationError(null);
                  }}
                  className={`rounded px-3 py-1.5 transition-all ${
                    activeTab === "paste"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Raw HTML Paste
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Format Notification Box */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 p-4 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
              <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Supported Spectora Format</p>
                <p className="text-blue-800/80 dark:text-blue-300/80">
                  Accepts <code className="font-mono font-bold">.xls</code> and{" "}
                  <code className="font-mono font-bold">.xlsx</code> OpenXML spreadsheets as well as HTML table markup. Preserves Section, Item, and Comment hierarchies, HTML narratives, and checklist configurations.
                </p>
              </div>
            </div>

            {/* Template Name Input */}
            <div className="space-y-1.5">
              <label htmlFor="tpl-name" className="text-xs font-medium text-foreground">
                Template Name (Optional override)
              </label>
              <input
                id="tpl-name"
                type="text"
                placeholder="e.g. InterNACHI Residential Standard"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* File Dropzone */}
            {activeTab === "file" ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 scale-[0.99]"
                    : selectedFile
                    ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : "border-muted-foreground/25 hover:border-blue-500/50 hover:bg-muted/10"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx,.html,.htm,.txt,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full mb-3 shadow-xs transition-colors ${
                    selectedFile
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {selectedFile ? (
                    <FileSpreadsheet className="h-7 w-7" />
                  ) : (
                    <UploadCloud className="h-7 w-7" />
                  )}
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-foreground">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-foreground">
                      Drag and drop your Spectora spreadsheet here, or browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports .xls (OpenXML), .xlsx, and .html exports up to {MAX_SIZE_MB}MB
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Raw HTML Paste Area */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="html-paste" className="text-xs font-medium text-foreground">
                    Raw Spectora HTML Table Markup
                  </label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {pastedHtml.length} characters
                  </span>
                </div>
                <textarea
                  id="html-paste"
                  rows={9}
                  placeholder="<table><tr><th>Section Name</th><th>Item Name</th>...</tr><tr><td>Roofing</td><td>...</td></tr></table>"
                  value={pastedHtml}
                  onChange={(e) => setPastedHtml(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-3 text-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            {/* Validation Error Alert */}
            {validationError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t pt-4">
            <Link href="/templates" className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </Link>

            <Button
              onClick={handleExecuteImport}
              disabled={
                (activeTab === "file" && !selectedFile) ||
                (activeTab === "paste" && !pastedHtml.trim())
              }
              className="flex items-center gap-2"
            >
              <span>Validate & Import</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STAGE 2: PROCESSING / PROGRESS */}
      {stage === "uploading" && (
        <Card className="border shadow-sm p-12 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Processing Spectora Template
            </h3>
            <p className="text-xs text-muted-foreground">
              Decompressing OpenXML tables, mapping 42 Spectora headers, structuring Sections/Items/Comments, and validating hierarchy...
            </p>
          </div>

          <div className="max-w-sm mx-auto space-y-2 text-xs font-mono text-muted-foreground text-left border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Workbook decompressed</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Deterministic column pattern match</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600 animate-pulse font-semibold">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Persisting relational hierarchy to database...</span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
                setStage("input");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel Import
            </Button>
          </div>
        </Card>
      )}


      {/* STAGE 3: IMPORT SUMMARY */}
      {stage === "summary" && importSummary && (
        <div className="space-y-6">
          {/* Main Status Card */}
          <Card
            className={`border shadow-sm ${
              importSummary.success
                ? importSummary.status === "completed_with_warnings"
                  ? "border-amber-500/40"
                  : "border-emerald-500/40"
                : "border-destructive/40"
            }`}
          >
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full shrink-0 ${
                      importSummary.success
                        ? importSummary.status === "completed_with_warnings"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {importSummary.success ? (
                      importSummary.status === "completed_with_warnings" ? (
                        <AlertTriangle className="h-6 w-6" />
                      ) : (
                        <CheckCircle2 className="h-6 w-6" />
                      )
                    ) : (
                      <XCircle className="h-6 w-6" />
                    )}
                  </div>

                  <div>
                    <CardTitle className="text-xl">
                      {importSummary.success
                        ? importSummary.status === "completed_with_warnings"
                          ? "Import Complete with Warnings"
                          : "Import Complete"
                        : "Import Failed"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Template: <strong className="text-foreground">{importSummary.templateName}</strong>
                      {importSummary.durationMs > 0 && ` • Processed in ${importSummary.durationMs}ms`}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      importSummary.success
                        ? importSummary.status === "completed_with_warnings"
                          ? "warning"
                          : "success"
                        : "destructive"
                    }
                    className="text-xs font-mono uppercase"
                  >
                    {importSummary.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Four Semantic Categories Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Preserved */}
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>✓ Preserved</span>
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">
                    {importSummary.commentsImported}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {importSummary.sectionsImported} Sections • {importSummary.itemsImported} Items • 100% order preserved
                  </p>
                </div>

                {/* 2. Unsupported by App */}
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    <span>⚠ Unsupported</span>
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">
                    {importSummary.unsupportedContent.length}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {importSummary.unsupportedContent.length === 0
                      ? "All detected elements supported"
                      : "Flagged & visible in diagnostics"}
                  </p>
                </div>

                {/* 3. Not Present in Source */}
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-xs">
                    <Info className="h-4 w-4" />
                    <span>ℹ Not in Source</span>
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">
                    Benign
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Empty author notes, unused photo captions left blank by author
                  </p>
                </div>

                {/* 4. Import Failures */}
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                    <XCircle className="h-4 w-4" />
                    <span>✕ Fatal Failures</span>
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">
                    {importSummary.errors.length}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {importSummary.errors.length === 0
                      ? "Zero fatal corruption"
                      : "Corrupt file or missing keys"}
                  </p>
                </div>
              </div>

              {/* Fatal Error Messages with Next-Steps Guidance */}
              {importSummary.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 space-y-3 text-xs text-destructive">
                  <div className="flex items-start gap-2.5">
                    <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-sm">
                        Import Halted: Data Integrity Protection
                      </p>
                      <p className="text-[11px] text-destructive/90">
                        To guarantee your database remains clean and free of corrupt partial records, no template entities were created.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-background/60 border border-destructive/20 space-y-1.5">
                    <span className="font-bold text-foreground block">
                      Specific Failure Reason:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-foreground/90 font-mono text-[11px]">
                      {importSummary.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded bg-background/60 border border-destructive/20 space-y-1">
                    <span className="font-bold text-foreground block">
                      Recommended Next Steps:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px]">
                      <li>Check that your file was exported directly from Spectora via <strong>Settings &gt; Templates &gt; Export</strong>.</li>
                      <li>Verify the spreadsheet contains populated inspection sections and items, rather than an empty sheet.</li>
                      <li>If the file is damaged, open it in Excel/Sheets, verify the columns, and re-export a fresh copy.</li>
                    </ul>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <Button
                      onClick={handleReset}
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    >
                      Try Again With Another File
                    </Button>
                  </div>
                </div>
              )}

              {/* Expandable Warnings & Diagnostics Drawer */}
              {importSummary.warnings.length > 0 && (
                <div className="rounded-lg border bg-muted/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowWarningsDetail(!showWarningsDetail)}
                    className="w-full flex items-center justify-between p-3.5 text-xs font-semibold hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>
                        Detailed Diagnostic Logs ({importSummary.warnings.length} items flagged)
                      </span>
                    </div>
                    {showWarningsDetail ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {showWarningsDetail && (
                    <div className="border-t p-3 space-y-2 max-h-64 overflow-y-auto font-mono text-xs">
                      {importSummary.warnings.map((w: WarningSummaryItem, idx: number) => (
                        <div
                          key={idx}
                          className="rounded border p-2 bg-background/80 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-700 dark:text-amber-300">
                              [{w.warningType}] {w.columnName ? `Column: ${w.columnName}` : ""}
                            </span>
                            {w.rowNumber && (
                              <Badge variant="outline" className="text-[10px]">
                                Row {w.rowNumber}
                              </Badge>
                            )}
                          </div>
                          <p className="text-foreground font-sans text-xs">{w.message}</p>
                          {w.rawSnippet && (
                            <pre className="text-[10px] text-muted-foreground bg-muted p-1 rounded overflow-x-auto">
                              {w.rawSnippet}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button onClick={handleReset} variant="outline" size="sm">
                Import Another File
              </Button>

              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/templates">
                    <Layers className="h-4 w-4 mr-1.5" />
                    <span>Templates Dashboard</span>
                  </Link>
                </Button>

                {importSummary.success && importSummary.templateId && (
                  <Button
                    onClick={() => router.push(`/templates/${importSummary.templateId}`)}
                    size="sm"
                    className="flex items-center gap-1.5"
                  >
                    <span>Open Template Editor</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>

          {/* Detailed Import Preservation / Confidence Report */}
          {importSummary.confidenceReport && (
            <ConfidenceReportView report={importSummary.confidenceReport} defaultExpanded={true} />
          )}
        </div>
      )}
    </div>
  );
}
