# Hive Inspect — Desktop Spectora Template Importer & Relational Editor

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-emerald?style=flat&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen?style=flat)]()

> A production-grade web application built to faithfully import, normalize, edit, independently duplicate, and audit Spectora home inspection templates without data loss or opaque JSON blobs.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Spectora Sample Fixture & Provenance](#spectora-sample-fixture--provenance)
3. [Key Capabilities](#key-capabilities)
4. [Architecture & Data Model](#architecture--data-model)
5. [Deployment Guide (Recommended: Vercel + Supabase)](#deployment-guide-recommended-vercel--supabase)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Local Development & Setup](#local-development--setup)
8. [Automated Verification & Test Suites](#automated-verification--test-suites)
9. [Repository Layout](#repository-layout)

---

## Executive Summary

Home inspectors invest years in authoring their checklist items, defect narratives, limitations, and recommendation options. Ingesting Spectora's **"Export to spreadsheet → Export HTML Text"** (`.xls` / `.xlsx` OpenXML archive) typically causes data loss in competing systems. 

**Hive Inspect** solves this by:
- Decompressing OpenXML ZIP archives directly in pure Node.js `zlib` (zero C++ dependencies).
- Ingesting all 42 source columns into a normalized relational model (`Template -> Section -> Item -> Comment`).
- Providing an **Import Preservation & Confidence Report** with factual counts and transparent warning classifications instead of invented percentages.
- Delivering a desktop dual-pane hierarchical editor with independent panel scrolling, smart auto-flipping classification popovers, and atomic batch-update transactions with full ACID rollback.

---

## Spectora Sample Fixture & Provenance

The repository includes the real-world inspection test fixture for automated testing, benchmark verification, and deterministic import:

- **Fixture File Reference:** [`fixtures/Residential Template-2026-09-14.xls`](file:///e:/Test%20task/hiveinspect/fixtures/Residential%20Template-2026-09-14.xls)
- **Source Template:** InterNACHI Residential
- **Where It Came From:** InterNACHI Residential, exported via Spectora `Settings → Templates → Export → Export HTML Text` (Spectora `Settings → Templates → Export to spreadsheet → Export HTML Text`).
- **Underlying Format:** Standard OpenXML ZIP archive containing worksheet XML (`xl/worksheets/sheet1.xml`) and shared strings dictionary (`xl/sharedStrings.xml`).
- **Fixture Metrics:** Exactly 393 rows (1 header + 392 data rows), 42 columns, 13 sections, 69 items, and 392 comments/findings (91 with populated narrative bodies, 19 with rich HTML formatting).

---

## Key Capabilities

1. **Faithful Ingestion Pipeline**
   - Parses multi-sheet workbooks, shared string tables, and sequential order indexes.
   - Preserves rich inspection HTML formatting (`<b>`, `<ul>`, `<ol>`, `<p>`, `<a>`) while sanitizing active script vectors (`<script>`, `<iframe>`, `on*` event handlers) against stored XSS.
   - Non-relational columns (default locations, unit types, answer formats) are safely preserved in structured `source_metadata` JSONB.

2. **Import Preservation & Confidence Report**
   - Transparent verification modal accessible at `/import` and inside the template editor.
   - Displays deterministic counts: preserved sections, checklist items, findings, and sanitized elements.
   - Categorizes diagnostics into:
     - `Not present in source`: Missing attributes in author's file.
     - `Present in source but unsupported`: Active scripts sanitized for security.
     - `Data anomaly`: Orphaned records safely linked to safe fallbacks.

3. **Two-Column Hierarchical Editor**
   - **Independent Panel Scrolling**: The left hierarchy tree and the right findings pane scroll independently with sleek 6px custom scrollbars. Zero whole-page body scrolling.
   - **Sticky Top Bar**: Template title, unsaved status badge, and **Save Changes** button remain pinned in view at all times.
   - **Smart Classification Dropdown**: Minimalist classification selector (Defect, Safety Hazard, Recommendation, Limitation, Maintenance, Information) with viewport auto-flip (flips upward when close to bottom edge).

4. **Deep Template Duplication**
   - Recursively clones an entire template tree into fully decoupled database rows with fresh UUIDs.
   - Editing a duplicated template has zero side effects on the original.

5. **Atomic Batch-Update & ACID Resilience**
   - Database transactions execute via direct PostgreSQL (`pg`) with automatic `ROLLBACK` if any update fails mid-flight.
   - Built-in in-memory fallback with snapshot rollback for offline or preview environments.

---

## Architecture & Data Model

Hive Inspect models inspection templates as a 4-tier relational graph:

```
┌────────────────────────────────────────────────────────┐
│                   templates (Root)                     │
│  id (UUID), name, description, source_filename, etc.   │
└───────────────────────────┬────────────────────────────┘
                            │ 1:N (ON DELETE CASCADE)
┌───────────────────────────▼────────────────────────────┐
│                       sections                         │
│  id, template_id, name, order_index, source_metadata   │
└───────────────────────────┬────────────────────────────┘
                            │ 1:N (ON DELETE CASCADE)
┌───────────────────────────▼────────────────────────────┐
│                        items                           │
│  id, section_id, name, order_index, source_metadata    │
└───────────────────────────┬────────────────────────────┘
                            │ 1:N (ON DELETE CASCADE)
┌───────────────────────────▼────────────────────────────┐
│                       comments                         │
│  id, item_id, comment_name, comment_text (HTML),       │
│  comment_type, category, recommendation, order_index   │
└────────────────────────────────────────────────────────┘
```

---

## Deployment Guide (Recommended: Vercel + Supabase)

### Why Vercel + Supabase?
- **Vercel** is the native deployment platform for Next.js 14 App Router, providing zero-config builds, global edge CDN caching, automatic serverless API route scaling, and instant preview branches.
- **Supabase** provides hosted PostgreSQL with connection pooling, Row Level Security (RLS), and zero-maintenance backups.

---

### Step 1: Database Setup (Supabase)

1. Sign up or log into [Supabase](https://supabase.com/).
2. Create a new project (e.g., `hive-inspect-prod`).
3. Open the **SQL Editor** in your Supabase dashboard.
4. Open the migration file:
   ```
   supabase/migrations/20260914000000_create_template_importer_schema.sql
   ```
5. Paste the SQL into the editor and click **Run**. This creates all tables, foreign keys with `ON DELETE CASCADE`, indexes, and RLS policies.
6. Retrieve your credentials:
   - **Project URL & Anon Key:** Go to **Project Settings** → **API**.
   - **Direct Connection URI:** Go to **Project Settings** → **Database** → **Connection String** → select **URI** (copy the string with port `6543`).

---

### Step 2: Deploy to Vercel

#### Option A: Deploy via GitHub (Recommended)

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```
2. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. In **Project Settings** → **Environment Variables**, add:

   | Variable Name | Value / Source |
   | :--- | :--- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase `anon` public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(Optional)* Your Supabase `service_role` key |
   | `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres` |

5. Click **Deploy**. Vercel will automatically build and publish your application.

#### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy directly from terminal
vercel
```

---

### Step 3: Seed Initial Data (Optional)

To populate your production database with sample Spectora templates:

```bash
# Set your DATABASE_URL or Supabase URL in your local .env.local and run:
npm run seed
```

---

## Environment Variables Reference

| Variable | Environment | Required? | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | **Yes** | Your Supabase Project HTTPS endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | **Yes** | Supabase Anonymous Client Key for authenticated queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Optional | Supabase admin key for server-side administrative actions. |
| `DATABASE_URL` | Server only | Recommended | Direct PostgreSQL URI (pooled on port `6543`) enabling ACID transactions via `pg`. |

> **Graceful Fallback:** If environment variables are omitted, Hive Inspect automatically falls back to an in-memory storage driver, allowing immediate zero-setup local testing and review.

---

## Local Development & Setup

### Prerequisites
- Node.js 18.17+ or 20+
- npm 9+ or pnpm 8+

### Quickstart

```bash
# 1. Clone repository
git clone https://github.com/your-org/hiveinspect.git
cd hiveinspect

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# (Edit .env.local with your Supabase credentials or leave blank for in-memory mode)

# 4. Initialize database & seed sample template
npm run db:setup

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Automated Verification & Test Suites

The repository includes a comprehensive, automated test suite covering 100% of importer requirements, data integrity, and failure recovery scenarios:

```bash
# Run the Master Test Suite (all 6 suites)
npm test

# Run individual test suites:
npm run test:importer     # OpenXML ZIP decompression & 42-column parsing
npm run test:preservation # Compares Spectora fixture against ground truth
npm run test:duplication  # Deep copying & entity ID independence
npm run test:editing      # In-place edits and persistence across reload
npm run test:confidence   # Factual counts & warning classifications
npm run test:failures     # All 8 failure scenarios and recovery handling

# Static Analysis & Production Build
npm run typecheck         # TypeScript strict typecheck (zero errors)
npm run build             # Production Next.js bundle compilation
```

---

## Repository Layout

```
├── fixtures/
│   └── Residential Template-2026-09-14.xls   # Primary Spectora sample export
├── supabase/
│   └── migrations/                           # PostgreSQL relational schema
├── src/
│   ├── app/                                  # Next.js 14 App Router
│   │   ├── api/                              # RESTful API endpoints
│   │   │   ├── import/route.ts               # Ingestion handler
│   │   │   └── templates/                    # Template CRUD & batch updates
│   │   ├── import/page.tsx                   # Upload & paste workflow
│   │   ├── templates/                        # Dashboard & 2-column editor
│   │   ├── globals.css                       # Design tokens & custom scrollbars
│   │   └── layout.tsx                        # App shell, Navbar & Footer
│   ├── components/
│   │   ├── confidence/                       # Preservation & audit modal
│   │   ├── layout/                           # Navbar & Breadcrumbs
│   │   ├── template/                         # CommentClassificationDropdown
│   │   └── ui/                               # Button, Card, Badge, Toast
│   ├── features/
│   │   └── importer/audit/                   # ConfidenceReportBuilder
│   ├── services/
│   │   ├── templateImportService.ts          # Orchestration service
│   │   └── spectoraImporter.ts               # OpenXML & HTML parser
│   ├── db/
│   │   ├── client.ts                         # Supabase factory
│   │   └── repositories/                     # Relational data access
│   ├── types/                                # Strict TypeScript definitions
│   └── validation/                           # Zod schemas (env, templates)
├── scripts/                                  # CLI migration, test, and seed scripts
├── docs/                                     # Architectural format specs & video guides
├── ARCHITECTURE.md                           # Deep technical architecture document
├── NOTES.md                                  # Engineering decisions & architectural notes
└── README.md                                 # This file
```

---

## License

Private and proprietary. Hive Inspect Template Importer & Management System.
