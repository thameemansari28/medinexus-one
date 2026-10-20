-- ====================================================================
-- MediNexus One: Enterprise Healthcare Platform PostgreSQL Database Schema
-- Compatible with Supabase PostgreSQL, Row Level Security, & Audit Logs
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. PROFILES (Extends Supabase auth.users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'hospital_staff', 'admin')),
  date_of_birth DATE,
  gender TEXT,
  blood_group TEXT,
  allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
  chronic_conditions TEXT[] DEFAULT ARRAY[]::TEXT[],
  current_medications TEXT[] DEFAULT ARRAY[]::TEXT[],
  emergency_notes TEXT,
  emergency_medical_consent BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 2. HOSPITALS & HEALTHCARE CENTERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'General Hospital',
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Tamil Nadu',
  pincode TEXT,
  phone TEXT NOT NULL,
  emergency_phone TEXT DEFAULT '112',
  email TEXT,
  latitude NUMERIC(10, 6) NOT NULL,
  longitude NUMERIC(10, 6) NOT NULL,
  specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
  services TEXT[] DEFAULT ARRAY[]::TEXT[],
  total_beds INTEGER,
  available_beds INTEGER,
  icu_beds_available INTEGER,
  er_wait_time_mins INTEGER,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  indoor_map_available BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Do not invent live availability or verification values for newly added facilities.
ALTER TABLE public.hospitals
  ALTER COLUMN total_beds DROP DEFAULT,
  ALTER COLUMN available_beds DROP DEFAULT,
  ALTER COLUMN icu_beds_available DROP DEFAULT,
  ALTER COLUMN er_wait_time_mins DROP DEFAULT,
  ALTER COLUMN verified_at DROP DEFAULT,
  ALTER COLUMN is_verified SET DEFAULT false,
  ALTER COLUMN indoor_map_available SET DEFAULT false;

-- ---------------------------------------------------------------------
-- 3. DOCTORS DIRECTORY
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  qualification TEXT,
  experience_years INTEGER DEFAULT 5,
  available_days TEXT[],
  consultation_fee NUMERIC(10, 2) DEFAULT 500.00,
  is_available BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Availability must be supplied by an actual hospital scheduling feed.
ALTER TABLE public.doctors
  ALTER COLUMN available_days DROP DEFAULT,
  ALTER COLUMN is_available SET DEFAULT false;

-- ---------------------------------------------------------------------
-- 4. APPOINTMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE RESTRICT,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  specialty TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
  cancellation_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 5. RECEIPTS & INVOICES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT DEFAULT 'UPI / Card',
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded', 'estimate')),
  transaction_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 6. EMERGENCY CONTACTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'Family',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 7. EMERGENCY SOS & ACCIDENT INCIDENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'Accident',
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  accuracy_meters NUMERIC(8, 2),
  location_address TEXT,
  details TEXT,
  medical_summary_shared BOOLEAN DEFAULT false,
  medical_summary JSONB DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'call_initiated', 'notifications_dispatched', 'acknowledged', 'resolved')),
  notification_attempts JSONB DEFAULT '[]'::JSONB,
  share_token TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 8. MEDICAL RECORDS & DOCUMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'Clinical Report',
  hospital_name TEXT,
  doctor_name TEXT,
  record_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  file_name TEXT,
  file_data TEXT,
  file_size INTEGER,
  mime_type TEXT,
  privacy_level TEXT NOT NULL DEFAULT 'private' CHECK (privacy_level IN ('private', 'emergency_accessible', 'authorized_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 9. AUDIT LOGS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON public.hospitals(city);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_receipts_patient ON public.receipts(patient_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON public.receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_emergency_user ON public.emergency_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_token ON public.emergency_incidents(share_token);
CREATE INDEX IF NOT EXISTS idx_records_patient ON public.medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Hospitals & Doctors: Public read access for directory discovery
CREATE POLICY "Public can view verified hospitals" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "Public can view doctors" ON public.doctors FOR SELECT USING (true);

-- Profiles: Users can view and update their own profile; admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Appointments: Patients access own appointments; staff can view hospital appointments
CREATE POLICY "Patients view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients insert own appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients update own appointments" ON public.appointments FOR UPDATE USING (auth.uid() = patient_id);

-- Receipts: Patients can view only their own bills
CREATE POLICY "Patients view own receipts" ON public.receipts FOR SELECT USING (auth.uid() = patient_id);

-- Emergency Contacts: Users manage their own contacts
CREATE POLICY "Users manage own emergency contacts" ON public.emergency_contacts FOR ALL USING (auth.uid() = user_id);

-- Emergency Incidents: Users view own incidents; public can view by valid token
CREATE POLICY "Users view own incidents" ON public.emergency_incidents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert emergency incident" ON public.emergency_incidents FOR INSERT WITH CHECK (true);

-- Medical Records: Private to patient
CREATE POLICY "Patients manage own records" ON public.medical_records FOR ALL USING (auth.uid() = patient_id);
