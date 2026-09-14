import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Layers, Copy, CheckCircle2, ShieldAlert } from "lucide-react";

export default function HomePage() {
  return (
    <div className="container max-w-5xl space-y-12 py-6">
      {/* Hero Section */}
      <section className="space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-3 py-1 font-mono">
            Enterprise Template Ingestion Engine
          </Badge>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          Spectora Template Importer & Management
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Preserve years of inspector tuning. Ingest Spectora HTML-text exports into a normalized relational model, edit narratives, and duplicate templates independently.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button asChild size="lg" className="flex items-center gap-2">
            <Link href="/import">
              <Upload className="h-4 w-4" />
              <span>Import Template</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex items-center gap-2">
            <Link href="/templates">
              <Layers className="h-4 w-4" />
              <span>View Templates</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* Workflow Pillars */}
      <section className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
              <Upload className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">1. Faithful Ingestion</CardTitle>
            <CardDescription>
              Preserves section/item/comment hierarchy, ordering, and HTML formatting without collapsing into an opaque blob.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Strict ordering indexes, dynamic table parsing, and tag sanitization.
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">2. Honest Diagnostics</CardTitle>
            <CardDescription>
              Unsupported content, skipped rows, and unclassified entries are flagged visibly—never silently discarded.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Dedicated ImportIssue tracking with raw HTML snippet recovery.
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
              <Copy className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">3. Deep Duplication</CardTitle>
            <CardDescription>
              Duplicate templates into fully decoupled copies. Changes to cloned templates leave originals completely untouched.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Atomic relational deep-cloning with unique primary and foreign keys.
          </CardContent>
        </Card>
      </section>

      {/* Architectural Checklist */}
      <section className="rounded-xl border bg-muted/30 p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>Baseline Architectural Principles</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Next.js App Router with strict TypeScript</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Tailwind CSS & shadcn/ui design tokens</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Relational PostgreSQL schema (Supabase ready)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Resilient error, loading, and 404 boundaries</span>
          </div>
        </div>
      </section>
    </div>
  );
}
