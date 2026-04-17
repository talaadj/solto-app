-- ============================================================
-- SOLTO: Миграция SQLite -> Supabase PostgreSQL
-- Запустите этот SQL в Supabase Dashboard -> SQL Editor
-- Dashboard URL: https://supabase.com/dashboard/project/mtyyoikklghhbvzsbtuc/sql
-- ============================================================

-- 1. ТАБЛИЦЫ
-- ============================================================

-- Проекты
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Профили пользователей
CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'foreman' CHECK (role IN ('director', 'foreman', 'procurement', 'accountant', 'storekeeper', 'viewer')),
  project_ids JSONB DEFAULT '[]'::jsonb,
  is_owner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Заявки
CREATE TABLE IF NOT EXISTS requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'procurement', 'payment_pending', 'purchased', 'delivered')),
  foreman_id UUID REFERENCES auth.users(id),
  quantity REAL DEFAULT 1,
  unit TEXT DEFAULT 'шт',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Предложения от поставщиков
CREATE TABLE IF NOT EXISTS procurement_offers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT REFERENCES requests(id) ON DELETE CASCADE,
  supplier_name TEXT DEFAULT 'Неизвестный поставщик',
  supplier_phone TEXT DEFAULT '',
  supplier_email TEXT DEFAULT '',
  supplier_address TEXT DEFAULT '',
  rating REAL DEFAULT 0,
  price REAL DEFAULT 0,
  details TEXT DEFAULT '',
  source_url TEXT,
  reliability_score INTEGER,
  risk_assessment TEXT,
  status TEXT DEFAULT 'pending',
  approved_quantity REAL,
  approved_amount REAL,
  payment_method TEXT,
  payment_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Склад (инвентарь)
CREATE TABLE IF NOT EXISTS inventory (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_name TEXT UNIQUE NOT NULL,
  quantity REAL DEFAULT 0,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Транзакции (финансы)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type TEXT CHECK (type IN ('income', 'expense')),
  amount REAL NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Уведомления
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Расписание (Ганнт)
CREATE TABLE IF NOT EXISTS schedule_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  parent_id BIGINT REFERENCES schedule_tasks(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'planned',
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ИНДЕКСЫ для производительности
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_requests_project_id ON requests(project_id);
CREATE INDEX IF NOT EXISTS idx_requests_foreman_id ON requests(foreman_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_procurement_offers_request_id ON procurement_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_project_id ON schedule_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Включаем RLS на всех таблицах
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_tasks ENABLE ROW LEVEL SECURITY;

-- Вспомогательная функция: получить роль текущего пользователя
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Вспомогательная функция: проверить, является ли пользователь директором
CREATE OR REPLACE FUNCTION is_director()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'director');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROJECTS: все авторизованные могут читать, только директор может создавать
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated WITH CHECK (is_director());
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated USING (is_director());

-- USER_PROFILES: пользователь видит свой профиль, директор видит все
CREATE POLICY "profiles_select_own" ON user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_director());
CREATE POLICY "profiles_insert" ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_director());
CREATE POLICY "profiles_delete" ON user_profiles FOR DELETE TO authenticated
  USING (is_director() AND user_id != auth.uid());

-- REQUESTS: все видят заявки своего проекта, создать может прораб
CREATE POLICY "requests_select" ON requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "requests_insert" ON requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "requests_update" ON requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "requests_delete" ON requests FOR DELETE TO authenticated USING (is_director());

-- PROCUREMENT_OFFERS: все авторизованные
CREATE POLICY "offers_select" ON procurement_offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "offers_insert" ON procurement_offers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "offers_update" ON procurement_offers FOR UPDATE TO authenticated USING (true);

-- INVENTORY: все видят, изменять может складской и директор
CREATE POLICY "inventory_select" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_insert" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inventory_update" ON inventory FOR UPDATE TO authenticated USING (true);

-- TRANSACTIONS: все видят, создавать может бухгалтер и директор
CREATE POLICY "transactions_select" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS: пользователь видит только свои
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- SCHEDULE_TASKS: все видят, изменять может директор
CREATE POLICY "schedule_select" ON schedule_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule_insert" ON schedule_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "schedule_update" ON schedule_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "schedule_delete" ON schedule_tasks FOR DELETE TO authenticated USING (true);

-- 4. SERVICE ROLE BYPASS (для серверных операций)
-- Supabase service_role ключ обходит RLS автоматически
