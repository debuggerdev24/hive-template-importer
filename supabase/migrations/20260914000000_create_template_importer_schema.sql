-- Migration: 20260914000000_create_template_importer_schema.sql
-- Description: Creates normalized schema for Hive Inspect template importer
-- Tables: templates, sections, items, comments, import_runs, import_warnings

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  original_source TEXT DEFAULT 'manual', -- 'spectora-html-import' | 'clone:<id>' | 'manual'
  source_filename TEXT,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC);

-- 2. Sections Table
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sections_template_order ON sections(template_id, order_index ASC);

-- 3. Items Table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_section_order ON items(section_id, order_index ASC);

-- 4. Comments Table
-- Preserves all rich Spectora export fields rather than flattening or discarding
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  comment_name TEXT,
  comment_text TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'html', -- 'html' | 'plain_text' | 'markdown'
  comment_type TEXT,                          -- 'Defect' | 'Information' | 'Limitation' | etc.
  category TEXT,                              -- Spectora Category
  recommendation TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  answer_type TEXT,
  default_value TEXT,
  default_value_2 TEXT,
  default_unit_type TEXT,
  default_location TEXT,
  default_estimate_min NUMERIC,
  default_estimate_max NUMERIC,
  locked BOOLEAN DEFAULT FALSE,
  simple_format BOOLEAN DEFAULT FALSE,
  disable_photos BOOLEAN DEFAULT FALSE,
  multiple_choice_options JSONB DEFAULT '[]'::jsonb,
  unit_type_options JSONB DEFAULT '[]'::jsonb,
  default_photos_and_captions JSONB DEFAULT '[]'::jsonb,
  source_last_modified TIMESTAMPTZ,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_item_order ON comments(item_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_comments_category ON comments(category);
CREATE INDEX IF NOT EXISTS idx_comments_type ON comments(comment_type);

-- 5. Import Runs Table
-- Tracks lifecycle of importer executions: pending -> processing -> completed/completed_with_warnings/failed
CREATE TABLE IF NOT EXISTS import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'completed_with_warnings', 'failed')),
  filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  file_format TEXT,
  total_rows_detected INTEGER DEFAULT 0,
  total_sections_imported INTEGER DEFAULT 0,
  total_items_imported INTEGER DEFAULT 0,
  total_comments_imported INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_runs_template ON import_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_import_runs_status ON import_runs(status);

-- 6. Import Warnings Table
-- Logs skipped rows, unsupported columns, or anomalies transparently
CREATE TABLE IF NOT EXISTS import_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL, -- 'UNSUPPORTED_COLUMN' | 'SKIPPED_ROW' | 'UNMATCHED_TAG' | 'ORPHAN_ENTRY' | 'OTHER'
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  raw_snippet TEXT,
  row_number INTEGER,
  column_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_warnings_run ON import_warnings(import_run_id);
CREATE INDEX IF NOT EXISTS idx_import_warnings_type ON import_warnings(warning_type);

-- Trigger for auto-updating updated_at timestamp on record modification
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_templates_updated_at ON templates;
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON templates
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_sections_updated_at ON sections;
CREATE TRIGGER trg_sections_updated_at BEFORE UPDATE ON sections
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_items_updated_at ON items;
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
