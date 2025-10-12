-- Add JSONB storage for UniverJS workbook/sheet data
alter table if exists sheets add column if not exists sheet_data jsonb not null default '{}'::jsonb;

-- Optional: index for existence checks
create index if not exists idx_sheets_sheet_data_gin on sheets using gin (sheet_data);
