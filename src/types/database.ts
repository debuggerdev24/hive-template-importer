export interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  original_source: string;
  source_filename: string | null;
  source_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbSection {
  id: string;
  template_id: string;
  name: string;
  order_index: number;
  source_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbItem {
  id: string;
  section_id: string;
  name: string;
  order_index: number;
  source_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbComment {
  id: string;
  item_id: string;
  comment_name: string | null;
  comment_text: string;
  content_format: string;
  comment_type: string | null;
  category: string | null;
  recommendation: string | null;
  order_index: number;
  answer_type: string | null;
  default_value: string | null;
  default_value_2: string | null;
  default_unit_type: string | null;
  default_location: string | null;
  default_estimate_min: number | null;
  default_estimate_max: number | null;
  locked: boolean;
  simple_format: boolean;
  disable_photos: boolean;
  multiple_choice_options: unknown[];
  unit_type_options: string[];
  default_photos_and_captions: unknown[];
  source_last_modified: string | null;
  source_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbImportRun {
  id: string;
  template_id: string | null;
  status: string;
  filename: string;
  file_size_bytes: number | null;
  file_format: string | null;
  total_rows_detected: number;
  total_sections_imported: number;
  total_items_imported: number;
  total_comments_imported: number;
  warning_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface DbImportWarning {
  id: string;
  import_run_id: string;
  warning_type: string;
  severity: string;
  message: string;
  raw_snippet: string | null;
  row_number: number | null;
  column_name: string | null;
  created_at: string;
}
