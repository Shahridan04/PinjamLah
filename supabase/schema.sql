-- =====================================================================
-- SHARING SHED - SUPABASE PRODUCTION DATABASE SCHEMA & INITIAL SEED
-- Township of Tomorrow | Sime Darby Property Hackathon 2026
-- =====================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    resident_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    township TEXT DEFAULT 'Taman Kita, Selangor',
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    total_saved_rm NUMERIC DEFAULT 0,
    total_co2_kg NUMERIC DEFAULT 0,
    completed_borrows INT DEFAULT 0,
    avatar_url TEXT
);

-- 2. ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subtitle TEXT,
    category TEXT NOT NULL,
    condition_score NUMERIC DEFAULT 9.5,
    retail_price_rm NUMERIC DEFAULT 0,
    co2_per_borrow_kg NUMERIC DEFAULT 0,
    shed_name TEXT DEFAULT 'Central Park shed',
    distance_m INT DEFAULT 180,
    locker_bay TEXT NOT NULL,
    status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'In Use')),
    kit_contents TEXT,
    image_url TEXT,
    total_loans INT DEFAULT 0
);

-- 3. LOCKERS TABLE (Hardware status synced via Supabase Realtime)
CREATE TABLE IF NOT EXISTS public.lockers (
    bay_code TEXT PRIMARY KEY,
    shed_name TEXT DEFAULT 'Central Park shed',
    is_unlocked BOOLEAN DEFAULT false,
    battery_charge_pct INT DEFAULT 98,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LOANS TABLE
CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    resident_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES public.items(id) ON DELETE CASCADE,
    locker_bay TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'ACTIVE', 'RETURNED')),
    qr_token TEXT NOT NULL,
    collected_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    working_well BOOLEAN DEFAULT true,
    all_parts_included BOOLEAN DEFAULT true,
    return_photo_url TEXT,
    ai_verification_json JSONB,
    return_condition_score NUMERIC
);

-- 5. SKILL HELPERS TABLE
CREATE TABLE IF NOT EXISTS public.skill_helpers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    skills TEXT[] NOT NULL,
    rating NUMERIC DEFAULT 4.9,
    helps_count INT DEFAULT 0,
    distance_m INT DEFAULT 200,
    availability_badge TEXT DEFAULT 'Available today',
    avatar_url TEXT
);

-- 6. ASSISTANCE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.assistance_requests (
    id TEXT PRIMARY KEY,
    resident_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    helper_id TEXT REFERENCES public.skill_helpers(id) ON DELETE CASCADE,
    item_id TEXT,
    message TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Permissive policies for hackathon client-side demonstration
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

-- Allow anon full access for all tables (idempotent)
DROP POLICY IF EXISTS "Allow public read-write on profiles" ON public.profiles;
CREATE POLICY "Allow public read-write on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write on items" ON public.items;
CREATE POLICY "Allow public read-write on items" ON public.items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write on lockers" ON public.lockers;
CREATE POLICY "Allow public read-write on lockers" ON public.lockers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write on loans" ON public.loans;
CREATE POLICY "Allow public read-write on loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write on skill_helpers" ON public.skill_helpers;
CREATE POLICY "Allow public read-write on skill_helpers" ON public.skill_helpers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write on assistance_requests" ON public.assistance_requests;
CREATE POLICY "Allow public read-write on assistance_requests" ON public.assistance_requests FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================
-- SUPABASE REALTIME REPLICATION SETUP (Idempotent)
-- Enables instant IoT locker doors and loan status sync
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'lockers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lockers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'loans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;
  END IF;
END $$;

-- =====================================================================
-- STORAGE BUCKET: return-photos (Idempotent)
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('return-photos', 'return-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public uploads to return-photos" ON storage.objects;
CREATE POLICY "Allow public uploads to return-photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'return-photos');

DROP POLICY IF EXISTS "Allow public reads from return-photos" ON storage.objects;
CREATE POLICY "Allow public reads from return-photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'return-photos');

-- =====================================================================
-- SEED DATA
-- =====================================================================

-- 1. Profile: Rahman
INSERT INTO public.profiles (
    id, resident_code, full_name, township, verified_at, total_saved_rm, total_co2_kg, completed_borrows
) VALUES (
    'aina-rahman-001',
    'TK-029',
    'Rahman',
    'Taman Kita, Selangor',
    '2026-05-19 10:00:00+00',
    1240,
    186,
    12
) ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    total_saved_rm = EXCLUDED.total_saved_rm,
    total_co2_kg = EXCLUDED.total_co2_kg,
    completed_borrows = EXCLUDED.completed_borrows;

-- 2. Lockers (Central Park Smart Shed bays)
INSERT INTO public.lockers (bay_code, shed_name, is_unlocked, battery_charge_pct, last_updated) VALUES
('A01', 'Central Park shed', false, 94, NOW()),
('A02', 'Central Park shed', false, 98, NOW()),
('A03', 'Central Park shed', false, 91, NOW()),
('A04', 'Central Park shed', false, 100, NOW()),
('B01', 'Central Park shed', false, 89, NOW()),
('B02', 'Central Park shed', false, 96, NOW())
ON CONFLICT (bay_code) DO NOTHING;

-- 3. Items
INSERT INTO public.items (
    id, name, subtitle, category, condition_score, retail_price_rm, co2_per_borrow_kg, shed_name, distance_m, locker_bay, status, kit_contents, image_url, total_loans
) VALUES
(
    'DR-014',
    '18V Cordless Drill Driver',
    'Brushless motor with 2x 2.0Ah batteries, fast charger & 30-piece bit set',
    'Power Tools',
    9.6,
    280,
    14,
    'Central Park shed',
    180,
    'A03',
    'Available',
    'Includes 18V drill, 2x Li-ion batteries, fast charger, 30-piece drill and screwdriver bit set, carry case, safety goggles, and quick-start card.',
    'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80',
    24
),
(
    'LD-002',
    '3.8m Telescopic Aluminium Ladder',
    'Compact collapsible multi-purpose ladder with anti-slip feet',
    'Home repair',
    9.8,
    340,
    22,
    'Central Park shed',
    180,
    'A01',
    'Available',
    'Includes 3.8m telescopic ladder with safety locking pins, stabilizing crossbar, and carry strap.',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
    18
),
(
    'PW-008',
    'High Pressure Cleaner 140 Bar',
    'Electric pressure washer for patio, car wash, and outdoor stone cleaning',
    'Cleaning',
    9.2,
    450,
    35,
    'Central Park shed',
    180,
    'A02',
    'Available',
    'Includes 140-bar pressure washer unit, 8m high-pressure hose, turbo nozzle, foam cannon attachment, and water intake filter.',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
    31
),
(
    'TN-005',
    '4-Person Waterproof Camping Tent',
    'Double-layer pop-up dome tent with rainfly & ground tarp',
    'Camping',
    9.7,
    320,
    28,
    'Central Park shed',
    220,
    'B01',
    'Available',
    'Includes 4-person tent body, waterproof rainfly, lightweight aluminum poles, 12 ground stakes, guy lines, and compact duffel bag.',
    'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80',
    15
),
(
    'ST-011',
    'Compact Foldable Travel Stroller',
    'Cabin-approved ultra lightweight stroller with 5-point harness',
    'Baby Gear',
    9.5,
    490,
    30,
    'Garden Walk shed',
    410,
    'B02',
    'Available',
    'Includes one-hand folding stroller, rain cover, sun canopy, underseat shopping basket, and travel protective bag.',
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80',
    11
)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    total_loans = EXCLUDED.total_loans;

-- Mini vacuum demo item. Preserve existing availability when re-running seed.
-- Retail price and CO2 values are illustrative demo estimates.
INSERT INTO public.items (
    id, name, subtitle, category, condition_score, retail_price_rm,
    co2_per_borrow_kg, shed_name, distance_m, locker_bay, status,
    kit_contents, image_url, total_loans
) VALUES (
    'VC-001', 'Mini Vacuum',
    'Cordless handheld vacuum for quick clean-ups, sofas and car interiors',
    'Cleaning', 10, 150, 5, 'Central Park shed', 180, 'A04', 'Available',
    'Includes cordless mini vacuum, crevice nozzle, brush attachment, washable filter, USB charging cable, and carry pouch. Empty the dust cup and clean the filter before returning.',
    '/images/items/vacuum-1.jpeg', 0
) ON CONFLICT (id) DO NOTHING;

-- Refresh the demo photo without resetting an existing reservation or loan.
UPDATE public.items SET image_url = '/images/items/vacuum-1.jpeg' WHERE id = 'VC-001';

-- 4. Skill Helpers (Neighbour network)
INSERT INTO public.skill_helpers (
    id, full_name, skills, rating, helps_count, distance_m, availability_badge, avatar_url
) VALUES
(
    'helper-001',
    'Hafiz Abdullah',
    ARRAY['Carpentry', 'Home repair', 'Furniture assembly'],
    4.9,
    34,
    150,
    'Available this weekend',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
),
(
    'helper-002',
    'Mei Ling Tan',
    ARRAY['Gardening', 'Plant care', 'Landscaping'],
    5.0,
    48,
    240,
    'Available today',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80'
),
(
    'helper-003',
    'Arjun Kumar',
    ARRAY['Power Tools', 'Furniture assembly', 'Drilling'],
    4.8,
    19,
    310,
    'Evenings after 6pm',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Past Loans (for Resident Aina Rahman's borrow history & analytics)
INSERT INTO public.loans (
    id, resident_id, item_id, locker_bay, start_date, end_date, status, qr_token, collected_at, returned_at, working_well, all_parts_included, return_condition_score
) VALUES
(
    'loan-hist-001',
    'aina-rahman-001',
    'PW-008',
    'A02',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '12 days',
    'RETURNED',
    'QR-PW008-HIST',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '12 days',
    true,
    true,
    9.6
),
(
    'loan-hist-002',
    'aina-rahman-001',
    'LD-002',
    'A01',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '26 days',
    'RETURNED',
    'QR-LD002-HIST',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '26 days',
    true,
    true,
    9.8
),
(
    'loan-hist-003',
    'aina-rahman-001',
    'TN-005',
    'B01',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '42 days',
    'RETURNED',
    'QR-TN005-HIST',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '42 days',
    true,
    true,
    9.7
)
ON CONFLICT (id) DO NOTHING;
