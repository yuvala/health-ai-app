alter table public.document_extractions
  add column if not exists used_ocr boolean not null default false;
