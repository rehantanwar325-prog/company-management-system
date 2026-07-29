-- ====================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR TOOTHERISE & GO MENU BUSINESS SUITE
-- Paste and run this SQL script in your Supabase SQL Editor (1-Click)
-- ====================================================================

-- 1. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
  id VARCHAR(100) PRIMARY KEY,
  company VARCHAR(50) NOT NULL DEFAULT 'tootherise',
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(100),
  service_name VARCHAR(255),
  start_date VARCHAR(50),
  plan_type VARCHAR(50) DEFAULT 'one-time',
  amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WORK ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.work_orders (
  id VARCHAR(100) PRIMARY KEY,
  company VARCHAR(50) NOT NULL DEFAULT 'tootherise',
  client_id VARCHAR(100),
  client_name VARCHAR(255),
  description TEXT,
  date_received VARCHAR(50),
  deadline VARCHAR(50),
  assigned_to VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Not Started',
  priority VARCHAR(50) DEFAULT 'Medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLIENT PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.client_payments (
  id VARCHAR(100) PRIMARY KEY,
  company VARCHAR(50) NOT NULL DEFAULT 'tootherise',
  client_id VARCHAR(100),
  client_name VARCHAR(255),
  total_agreed NUMERIC(12,2) DEFAULT 0,
  amount_received NUMERIC(12,2) DEFAULT 0,
  payment_date VARCHAR(50),
  payment_method VARCHAR(100),
  installments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TEAM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.team_members (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT 'Team Specialist',
  contact VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TEAM PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.team_payments (
  id VARCHAR(100) PRIMARY KEY,
  company VARCHAR(50) NOT NULL DEFAULT 'tootherise',
  team_member VARCHAR(255) NOT NULL,
  work_assigned VARCHAR(255),
  amount_paid NUMERIC(12,2) DEFAULT 0,
  date_paid VARCHAR(50),
  payment_method VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
  id VARCHAR(100) PRIMARY KEY,
  company VARCHAR(50) NOT NULL DEFAULT 'tootherise',
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Subscriptions/Tools',
  amount NUMERIC(12,2) DEFAULT 0,
  expense_date VARCHAR(50),
  payment_method VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ACTIVITY LOG TABLE
CREATE TABLE IF NOT EXISTS public.activity_log (
  id VARCHAR(100) PRIMARY KEY,
  text TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) policies allowing full public anon access for this app suite
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public anon access on clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access on work_orders" ON public.work_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access on client_payments" ON public.client_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access on team_members" ON public.team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access on team_payments" ON public.team_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public anon access on activity_log" ON public.activity_log FOR ALL USING (true) WITH CHECK (true);
