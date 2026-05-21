-- ============================================================
-- Bar Cop Profit Fix — Supabase Database Setup
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Create the user_data table
CREATE TABLE IF NOT EXISTS user_data (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- 3. Enable Row Level Security
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: users can only see their own row
CREATE POLICY "Users can read own data"
  ON user_data FOR SELECT
  USING (auth.uid() = user_id);

-- 5. RLS Policy: users can insert their own row
CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. RLS Policy: users can update their own row
CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. RLS Policy: users can delete their own row
CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Control Module data tables (Inventory / Labor / Shift)
-- Separate tables per Rule 21 — Control data is NOT stored in user_data.
-- ============================================================

-- Inventory Control data table
CREATE TABLE ic_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ic_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own inventory data"
  ON ic_data FOR ALL USING (auth.uid() = user_id);

-- Labor Control data table
CREATE TABLE lc_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE lc_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own labor data"
  ON lc_data FOR ALL USING (auth.uid() = user_id);

-- Shift Control data table
CREATE TABLE sc_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE sc_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own shift data"
  ON sc_data FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Done. All tables are ready.
-- ============================================================
