-- ============================================================
-- CLOCK IT — Migration 002: Receipt Storage
-- Run this in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

-- Add receipt image storage path to expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

-- ── Storage bucket ────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880,  -- 5 MB max per image
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ──────────────────────────────────────

-- Workers upload into their own folder: {user_id}/{expense_id}.jpg
CREATE POLICY "receipts: worker can upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- Workers can read their own receipts
CREATE POLICY "receipts: worker can read own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- Workers can delete their own receipts
CREATE POLICY "receipts: worker can delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- Managers can read all receipts
CREATE POLICY "receipts: manager can read all"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND public.get_my_role() = 'manager'
  );
