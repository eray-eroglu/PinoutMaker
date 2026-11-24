-- Optional ready-made pinout shipped with a library product.
-- Null (the default) means "image only". See supabase/README.md for the JSON shape.
alter table products add column if not exists pinout jsonb;
