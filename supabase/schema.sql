-- PROMTP full database schema (all 44 original migrations combined, in order, with fixes). Already applied to Supabase project Promoter--os (azenzsggqexyonafxlsf). Run ONCE on a fresh project to recreate the database.


-- ===== 20251202122457_create_shows_and_offers_tables.sql =====
/*
  # Concert Promoter Offer System - Database Schema

  ## Overview
  Creates the database structure for managing concert offers with estimate and settlement tracking.

  ## New Tables

  ### `shows`
  Core event information that doesn't change between estimate and settlement.
  - `id` (text, primary key) - Unique show identifier
  - `artist_name` (text) - Name of performing artist
  - `venue_name` (text) - Venue location
  - `event_date` (text) - Date of show (ISO format)
  - `capacity` (integer) - Total venue capacity
  - `created_at` (timestamptz) - Record creation timestamp

  ### `offers`
  Deal terms, financials, and calculations for both estimates and settlements.
  - `id` (text, primary key) - Unique offer identifier
  - `show_id` (text, foreign key) - Links to shows table
  - `mode` (text) - Either 'estimate' or 'settlement'
  - `deal_type` (text) - Either 'flat_guarantee' or 'promoter_profit'
  - `guarantee` (numeric) - Artist guarantee amount
  - `tax_withholding_pct` (numeric) - Tax withholding percentage
  - `deposit_pct` (numeric) - Deposit percentage (due 30 days before)
  - `ticket_tiers` (jsonb) - Array of ticket tier objects with allotment, comps, price, actualSold
  - `sales_tax_pct` (numeric) - Sales tax percentage
  - `expenses` (jsonb) - Nested object with 4 categories (talent, general, marketing, production)
  - `calculations` (jsonb) - All calculated values (gross, net, profit, backend splits, projections)
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on both tables
  - For MVP: Allow all operations (auth will be added post-MVP)

  ## Notes
  - Estimates and settlements are separate records linked by show_id
  - ticket_tiers uses jsonb for flexible tier structure
  - expenses uses jsonb for nested category structure
  - calculations stores all computed values for historical reference
*/

-- Create shows table
CREATE TABLE IF NOT EXISTS shows (
  id text PRIMARY KEY,
  artist_name text NOT NULL,
  venue_name text NOT NULL,
  event_date text NOT NULL,
  capacity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id text PRIMARY KEY,
  show_id text NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('estimate', 'settlement')),
  deal_type text NOT NULL CHECK (deal_type IN ('flat_guarantee', 'promoter_profit')),
  guarantee numeric NOT NULL,
  tax_withholding_pct numeric NOT NULL DEFAULT 0,
  deposit_pct numeric NOT NULL DEFAULT 0,
  ticket_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  sales_tax_pct numeric NOT NULL DEFAULT 0,
  expenses jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups by show_id
CREATE INDEX IF NOT EXISTS idx_offers_show_id ON offers(show_id);

-- Enable RLS
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- MVP policies: Allow all operations (will be restricted when auth is added)
CREATE POLICY "Allow all operations on shows"
  ON shows
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on offers"
  ON offers
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- ===== 20251202130233_add_event_types_deposits_and_company_settings.sql =====
/*
  # Add Event Types, Deposits, and Company Settings

  ## New Features
  1. Event Types (estimate, budgeting, active, closeout)
  2. Deposit tracking with due dates
  3. Venue deposit management
  4. Company branding settings

  ## Changes to offers table
  - Add event_type field
  - Add deposit_due_date and deposit_due_timing fields
  - Add venue deposit tracking fields

  ## New Tables
  - company_settings for branding and company info

  ## Security
  - Enable RLS on company_settings
  - Add policies for authenticated users
*/

-- Add new columns to offers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE offers ADD COLUMN event_type text DEFAULT 'estimate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'deposit_due_date'
  ) THEN
    ALTER TABLE offers ADD COLUMN deposit_due_date text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'deposit_due_timing'
  ) THEN
    ALTER TABLE offers ADD COLUMN deposit_due_timing text DEFAULT '30_days_before';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_deposit'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_deposit real DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_deposit_due_date'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_deposit_due_date text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_deposit_status'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_deposit_status text DEFAULT 'pending';
  END IF;
END $$;

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  company_name text,
  logo_url text,
  contact_name text,
  email text,
  phone text,
  website text,
  business_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can insert own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can delete own company settings" ON company_settings;

-- Policies for company_settings
CREATE POLICY "Users can view own company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own company settings"
  ON company_settings FOR DELETE
  TO authenticated
  USING (true);


-- ===== 20251202135748_fix_company_settings_rls.sql =====
/*
  # Fix Company Settings RLS Policies

  1. Changes
    - Drop existing restrictive policies
    - Add permissive policies that allow all operations
    - This is appropriate for company_settings since it's a single-company system
  
  2. Security Notes
    - Company settings are shared across all users of the company
    - No authentication required for this table in single-company setup
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can insert own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can delete own company settings" ON company_settings;

-- Create permissive policies for all operations
CREATE POLICY "Allow all to read company settings"
  ON company_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow all to insert company settings"
  ON company_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all to update company settings"
  ON company_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete company settings"
  ON company_settings FOR DELETE
  USING (true);


-- ===== 20251202140455_add_offer_expiration_and_artist_photo.sql =====
/*
  # Add Offer Expiration and Artist Photo Fields

  1. Changes
    - Add `offer_expires_at` to offers table (when the offer deal ends)
    - Add `artist_photo_url` to shows table (artist image for cards)
  
  2. Notes
    - These fields enhance the offer cards display
    - Offer expiration helps track deal deadlines
    - Artist photos provide visual identification
*/

-- Add offer expiration date to offers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'offer_expires_at'
  ) THEN
    ALTER TABLE offers ADD COLUMN offer_expires_at timestamptz;
  END IF;
END $$;

-- Add artist photo URL to shows table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shows' AND column_name = 'artist_photo_url'
  ) THEN
    ALTER TABLE shows ADD COLUMN artist_photo_url text;
  END IF;
END $$;


-- ===== 20251202142051_add_offer_status_field.sql =====
/*
  # Add Offer Status Field

  1. Changes
    - Add `status` column to `offers` table with enum type
    - Set default status to 'planning'
    - Add index on status for efficient filtering

  2. Status Values
    - planning: Pre-show financial projections for planning and decision-making
    - offer_sent: Offer has been sent to artist/agent
    - confirmed: Offer accepted and confirmed
    - active: Show is live/happening
    - settled: Show completed and financials settled
    - cancelled: Show cancelled
*/

DO $$ 
BEGIN
  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'offers' AND column_name = 'status'
  ) THEN
    ALTER TABLE offers ADD COLUMN status text DEFAULT 'planning';
    
    -- Add check constraint for valid statuses
    ALTER TABLE offers ADD CONSTRAINT offers_status_check 
      CHECK (status IN ('planning', 'offer_sent', 'confirmed', 'active', 'settled', 'cancelled'));
    
    -- Create index for efficient filtering
    CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
  END IF;
END $$;


-- ===== 20251202150614_late_garden.sql =====
/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_customers`: Links Supabase users to Stripe customers
      - Includes `user_id` (references `auth.users`)
      - Stores Stripe `customer_id`
      - Implements soft delete

    - `stripe_subscriptions`: Manages subscription data
      - Tracks subscription status, periods, and payment details
      - Links to `stripe_customers` via `customer_id`
      - Custom enum type for subscription status
      - Implements soft delete

    - `stripe_orders`: Stores order/purchase information
      - Records checkout sessions and payment intents
      - Tracks payment amounts and status
      - Custom enum type for order status
      - Implements soft delete

  2. Views
    - `stripe_user_subscriptions`: Secure view for user subscription data
      - Joins customers and subscriptions
      - Filtered by authenticated user

    - `stripe_user_orders`: Secure view for user order history
      - Joins customers and orders
      - Filtered by authenticated user

  3. Security
    - Enables Row Level Security (RLS) on all tables
    - Implements policies for authenticated users to view their own data
*/

CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null unique,
  customer_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer data"
    ON stripe_customers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE TYPE stripe_subscription_status AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint primary key generated always as identity,
  customer_id text unique not null,
  subscription_id text default null,
  price_id text default null,
  current_period_start bigint default null,
  current_period_end bigint default null,
  cancel_at_period_end boolean default false,
  payment_method_brand text default null,
  payment_method_last4 text default null,
  status stripe_subscription_status not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription data"
    ON stripe_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

CREATE TYPE stripe_order_status AS ENUM (
    'pending',
    'completed',
    'canceled'
);

CREATE TABLE IF NOT EXISTS stripe_orders (
    id bigint primary key generated always as identity,
    checkout_session_id text not null,
    payment_intent_id text not null,
    customer_id text not null,
    amount_subtotal bigint not null,
    amount_total bigint not null,
    currency text not null,
    payment_status text not null,
    status stripe_order_status not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order data"
    ON stripe_orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- View for user subscriptions
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
    c.customer_id,
    s.subscription_id,
    s.status as subscription_status,
    s.price_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.payment_method_brand,
    s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND s.deleted_at IS NULL;

GRANT SELECT ON stripe_user_subscriptions TO authenticated;

-- View for user orders
CREATE VIEW stripe_user_orders WITH (security_invoker) AS
SELECT
    c.customer_id,
    o.id as order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status as order_status,
    o.created_at as order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND o.deleted_at IS NULL;

-- ===== 20251202150916_create_templates_table.sql =====
/*
  # Create Templates Table

  1. New Tables
    - `templates`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text)
      - `description` (text)
      - `type` (text) - 'venue', 'artist', 'event'
      - `deal_type` (text)
      - `deposit_pct` (real)
      - `deposit_due_timing` (text)
      - `tax_withholding_pct` (real)
      - `sales_tax_pct` (real)
      - `ticket_tier_templates` (jsonb)
      - `expense_categories` (jsonb)
      - `legal_terms` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `templates` table
    - Add policies for authenticated users to manage their own templates
*/

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('venue', 'artist', 'event')),
  deal_type text NOT NULL CHECK (deal_type IN ('flat_guarantee', 'promoter_profit')),
  deposit_pct real DEFAULT 20,
  deposit_due_timing text DEFAULT '30_days_before',
  tax_withholding_pct real DEFAULT 2,
  sales_tax_pct real DEFAULT 10,
  ticket_tier_templates jsonb DEFAULT '[]'::jsonb,
  expense_categories jsonb DEFAULT '[]'::jsonb,
  legal_terms text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);

-- ===== 20251202151653_add_user_id_to_shows_and_offers.sql =====
/*
  # Add user_id to shows and offers tables for proper data isolation

  1. Changes
    - Add user_id column to shows table
    - Add user_id column to offers table
    - Update RLS policies to filter by user_id
    - Backfill existing data (if any) with a default user
  
  2. Security
    - All RLS policies now check auth.uid() = user_id
    - Each user can only see and manage their own data
*/

-- Add user_id to shows table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shows' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE shows ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to offers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE offers ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all shows" ON shows;
DROP POLICY IF EXISTS "Users can create shows" ON shows;
DROP POLICY IF EXISTS "Users can update all shows" ON shows;
DROP POLICY IF EXISTS "Users can delete all shows" ON shows;
DROP POLICY IF EXISTS "Users can view all offers" ON offers;
DROP POLICY IF EXISTS "Users can create offers" ON offers;
DROP POLICY IF EXISTS "Users can update all offers" ON offers;
DROP POLICY IF EXISTS "Users can delete all offers" ON offers;

-- Create user-specific RLS policies for shows
CREATE POLICY "Users can view own shows"
  ON shows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shows"
  ON shows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shows"
  ON shows FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shows"
  ON shows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create user-specific RLS policies for offers
CREATE POLICY "Users can view own offers"
  ON offers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own offers"
  ON offers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shows_user_id ON shows(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);

-- ===== 20251202152958_add_admin_role_system.sql =====
/*
  # Add Admin Role System

  1. Changes
    - Add `is_admin` column to auth.users metadata
    - Create `user_roles` table to track admin status
    - Add RLS policies for admin access
    - Set jhuaroco@gmail.com as admin

  2. Security
    - Enable RLS on `user_roles` table
    - Only admins can view all user roles
    - Users can view their own role status
*/

-- Create user_roles table to track admin status
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own role
CREATE POLICY "Users can view own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.is_admin = true
    )
  );

-- Policy: Admins can update roles
CREATE POLICY "Admins can update roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.is_admin = true
    )
  );

-- Policy: System can insert roles (for new user creation)
CREATE POLICY "System can insert roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create function to automatically create user_role entry for new users
CREATE OR REPLACE FUNCTION create_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_roles (user_id, is_admin)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create user_role on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_role();

-- Set jhuaroco@gmail.com as admin
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the user ID for jhuaroco@gmail.com
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'jhuaroco@gmail.com';

  -- If user exists, make them admin
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, is_admin)
    VALUES (admin_user_id, true)
    ON CONFLICT (user_id)
    DO UPDATE SET is_admin = true, updated_at = now();
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_is_admin ON user_roles(is_admin);


-- ===== 20251202153740_add_typical_expenses_to_company_settings.sql =====
/*
  # Add typical expenses to company settings

  1. Changes
    - Add `typical_expenses` JSONB column to `company_settings` table
    - This will store default expense values that can be loaded when creating new offers
  
  2. Structure
    - The typical_expenses field will store a JSONB object with the same structure as offer expenses:
      {
        "talent": { "rider_hospitality": 0 },
        "general": { "security": 0, "emt": 0, "gate_staff": 0 },
        "marketing": { "radio": 0, "marketing": 0, "paid_social": 0 },
        "production": { "production": 0, "crew_stagehands": 0, "camera_operator": 0, "technical_director": 0 }
      }
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'typical_expenses'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN typical_expenses jsonb DEFAULT '{
      "talent": {"rider_hospitality": 0},
      "general": {"security": 0, "emt": 0, "gate_staff": 0},
      "marketing": {"radio": 0, "marketing": 0, "paid_social": 0},
      "production": {"production": 0, "crew_stagehands": 0, "camera_operator": 0, "technical_director": 0}
    }'::jsonb;
  END IF;
END $$;

-- ===== 20251202171705_add_support_acts_and_run_of_show.sql =====
/*
  # Add Support Acts and Run of Show System

  1. Changes to Existing Tables
    - Add `support_acts` column to `offers` table (JSONB)
      - Stores array of support act objects with name, type, guarantee, set_length, genre, notes

  2. New Tables
    - `run_of_show`
      - `id` (text, primary key)
      - `offer_id` (text, foreign key to offers)
      - `event_date` (date)
      - `venue_contact` (jsonb) - stores name, phone, email
      - `schedule` (jsonb) - array of schedule items with time, duration, title, category, description, responsible
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `user_id` (uuid, foreign key to auth.users)

  3. Security
    - Enable RLS on `run_of_show` table
    - Add policies for authenticated users to manage their own run of show data
*/

-- Add support_acts column to offers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'support_acts'
  ) THEN
    ALTER TABLE offers ADD COLUMN support_acts JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create run_of_show table
CREATE TABLE IF NOT EXISTS run_of_show (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  offer_id text NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  event_date date,
  venue_contact jsonb DEFAULT '{}'::jsonb,
  schedule jsonb DEFAULT '[]'::jsonb NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE run_of_show ENABLE ROW LEVEL SECURITY;

-- Policies for run_of_show
CREATE POLICY "Users can view own run of show"
  ON run_of_show FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own run of show"
  ON run_of_show FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own run of show"
  ON run_of_show FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own run of show"
  ON run_of_show FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_run_of_show_offer_id ON run_of_show(offer_id);
CREATE INDEX IF NOT EXISTS idx_run_of_show_user_id ON run_of_show(user_id);


-- ===== 20251203024326_create_tours_system.sql =====
/*
  # Create Tours System

  1. New Tables
    - `tours`
      - `id` (text, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - Tour name
      - `artist_name` (text) - Artist name
      - `start_date` (date) - Tour start date
      - `end_date` (date) - Tour end date
      - `description` (text) - Tour description
      - `status` (text) - Tour status (planning, booking, confirmed, active, completed, cancelled)
      - `projected_revenue` (numeric) - Total projected revenue
      - `total_costs` (numeric) - Total costs
      - `net_profit` (numeric) - Net profit
      - `completed_count` (integer) - Number of completed shows
      - `settled_count` (integer) - Number of settled shows
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `tour_id` column to `offers` table (links offers to tours)
    - Add `show_number` column to `offers` table (show sequence in tour)

  3. Security
    - Enable RLS on `tours` table
    - Add policies for authenticated users to manage their own tours
*/

-- Create tours table
CREATE TABLE IF NOT EXISTS tours (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  artist_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'planning',
  projected_revenue numeric DEFAULT 0,
  total_costs numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  completed_count integer DEFAULT 0,
  settled_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add tour fields to offers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'tour_id'
  ) THEN
    ALTER TABLE offers ADD COLUMN tour_id text REFERENCES tours(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'show_number'
  ) THEN
    ALTER TABLE offers ADD COLUMN show_number integer;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

-- Policies for tours
CREATE POLICY "Users can view own tours"
  ON tours FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tours"
  ON tours FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tours"
  ON tours FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tours"
  ON tours FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tours_user_id ON tours(user_id);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status);
CREATE INDEX IF NOT EXISTS idx_offers_tour_id ON offers(tour_id);


-- ===== 20251203031822_add_venue_address_fields.sql =====
/*
  # Add Venue Address Fields to Offers

  1. New Columns
    - `venue_street` (text) - Street address of venue
    - `venue_city` (text) - City
    - `venue_state` (text) - State/Province
    - `venue_zip` (text) - ZIP/Postal code
    - `venue_full_address` (text) - Computed full address for display
  
  2. Notes
    - These fields will appear on offer PDFs and Run of Show documents
    - venue_full_address will be populated by application code
*/

-- Add venue address fields to offers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_street'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_street text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_city'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_state'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_zip'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_zip text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'venue_full_address'
  ) THEN
    ALTER TABLE offers ADD COLUMN venue_full_address text;
  END IF;
END $$;

-- ===== 20251203034142_fix_rls_performance_and_security_issues.sql =====
/*
  # Fix RLS Performance and Security Issues

  ## Overview
  This migration optimizes Row Level Security (RLS) policies for better performance at scale
  and removes duplicate/conflicting policies.

  ## Changes

  ### 1. RLS Performance Optimization
  Replace all `auth.uid()` calls with `(select auth.uid())` to prevent re-evaluation for each row.
  This applies to all tables:
  - stripe_customers
  - stripe_subscriptions
  - stripe_orders
  - templates
  - shows
  - offers
  - user_roles
  - run_of_show
  - tours

  ### 2. Remove Duplicate Policies
  - Drop "Allow all operations on offers" policy (conflicts with specific CRUD policies)
  - Drop "Allow all operations on shows" policy (conflicts with specific CRUD policies)

  ### 3. Fix Function Security
  - Add immutable search_path to create_user_role() function

  ## Security Impact
  - Improves query performance by caching auth.uid() evaluation
  - Removes overly permissive "ALL" policies in favor of specific CRUD policies
  - Maintains same security posture with better performance
*/

-- ============================================================
-- PART 1: Remove Duplicate/Conflicting Policies
-- ============================================================

-- Drop overly broad policies that conflict with specific CRUD policies
DROP POLICY IF EXISTS "Allow all operations on offers" ON offers;
DROP POLICY IF EXISTS "Allow all operations on shows" ON shows;

-- ============================================================
-- PART 2: Optimize Stripe Tables RLS Policies
-- ============================================================

-- stripe_customers
DROP POLICY IF EXISTS "Users can view their own customer data" ON stripe_customers;
CREATE POLICY "Users can view their own customer data"
  ON stripe_customers
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) AND deleted_at IS NULL);

-- stripe_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
CREATE POLICY "Users can view their own subscription data"
  ON stripe_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id
      FROM stripe_customers
      WHERE user_id = (select auth.uid()) AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- stripe_orders
DROP POLICY IF EXISTS "Users can view their own order data" ON stripe_orders;
CREATE POLICY "Users can view their own order data"
  ON stripe_orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id
      FROM stripe_customers
      WHERE user_id = (select auth.uid()) AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ============================================================
-- PART 3: Optimize Templates Table RLS Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can view own templates" ON templates;
CREATE POLICY "Users can view own templates"
  ON templates FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own templates" ON templates;
CREATE POLICY "Users can create own templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own templates" ON templates;
CREATE POLICY "Users can update own templates"
  ON templates FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON templates;
CREATE POLICY "Users can delete own templates"
  ON templates FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- PART 4: Optimize Shows Table RLS Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can view own shows" ON shows;
CREATE POLICY "Users can view own shows"
  ON shows FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own shows" ON shows;
CREATE POLICY "Users can create own shows"
  ON shows FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own shows" ON shows;
CREATE POLICY "Users can update own shows"
  ON shows FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own shows" ON shows;
CREATE POLICY "Users can delete own shows"
  ON shows FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- PART 5: Optimize Offers Table RLS Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can view own offers" ON offers;
CREATE POLICY "Users can view own offers"
  ON offers FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own offers" ON offers;
CREATE POLICY "Users can create own offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own offers" ON offers;
CREATE POLICY "Users can update own offers"
  ON offers FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own offers" ON offers;
CREATE POLICY "Users can delete own offers"
  ON offers FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- PART 6: Optimize User Roles Table RLS Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Admins can view all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
CREATE POLICY "Admins can update roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "System can insert roles" ON user_roles;
CREATE POLICY "System can insert roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- PART 7: Optimize Run of Show Table RLS Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can view own run of show" ON run_of_show;
CREATE POLICY "Users can view own run of show"
  ON run_of_show FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own run of show" ON run_of_show;
CREATE POLICY "Users can create own run of show"
  ON run_of_show FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own run of show" ON run_of_show;
CREATE POLICY "Users can update own run of show"
  ON run_of_show FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own run of show" ON run_of_show;
CREATE POLICY "Users can delete own run of show"
  ON run_of_show FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- PART 8: Optimize Tours Table RLS Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can view own tours" ON tours;
CREATE POLICY "Users can view own tours"
  ON tours FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own tours" ON tours;
CREATE POLICY "Users can create own tours"
  ON tours FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own tours" ON tours;
CREATE POLICY "Users can update own tours"
  ON tours FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own tours" ON tours;
CREATE POLICY "Users can delete own tours"
  ON tours FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- PART 9: Fix Function Security
-- ============================================================

-- Recreate create_user_role function with immutable search_path
CREATE OR REPLACE FUNCTION create_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_roles (user_id, is_admin)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================
-- PART 10: Add Missing Indexes for Performance
-- ============================================================

-- Add indexes for offers status and show_id lookups
CREATE INDEX IF NOT EXISTS idx_offers_show_id ON offers(show_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);


-- ===== 20251203051719_fix_company_settings_security.sql =====
/*
  # Fix Company Settings Security

  1. Changes
    - Drop the insecure "Allow all" policies on company_settings
    - Add proper user-scoped policies that check user_id
    - Ensure users can only access their own company settings

  2. Security
    - Remove policies using `USING (true)` which allow access to all data
    - Add restrictive policies that verify auth.uid() matches user_id
    - Each user can only read/write their own company settings
*/

-- Drop the insecure policies
DROP POLICY IF EXISTS "Allow all to read company settings" ON company_settings;
DROP POLICY IF EXISTS "Allow all to insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Allow all to update company settings" ON company_settings;
DROP POLICY IF EXISTS "Allow all to delete company settings" ON company_settings;

-- Add secure policies that check user ownership
CREATE POLICY "Users can view own company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create own company settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own company settings"
  ON company_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- ===== 20251203062733_create_settlements_table.sql =====
/*
  # Create Settlements Tracking Table

  1. New Tables
    - `settlements`
      - `id` (text, primary key)
      - `offer_id` (text, foreign key to offers)
      - `user_id` (uuid, foreign key to auth.users)
      - `actual_attendance` (jsonb) - stores actual ticket sales per tier
      - `actual_expenses` (jsonb) - stores actual expenses by category
      - `actual_revenue` (decimal) - total actual revenue
      - `actual_total_expenses` (decimal) - total actual expenses
      - `actual_profit` (decimal) - actual profit/loss
      - `variance_revenue` (decimal) - projected vs actual revenue
      - `variance_expenses` (decimal) - projected vs actual expenses
      - `variance_profit` (decimal) - projected vs actual profit
      - `notes` (text) - settlement notes
      - `settled_at` (timestamp) - when settlement was completed
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `settlements` table
    - Add policies for authenticated users to manage their own settlements
*/

CREATE TABLE IF NOT EXISTS settlements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  offer_id text NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actual_attendance jsonb NOT NULL DEFAULT '[]'::jsonb,
  actual_expenses jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_revenue decimal(15,2) NOT NULL DEFAULT 0,
  actual_total_expenses decimal(15,2) NOT NULL DEFAULT 0,
  actual_profit decimal(15,2) NOT NULL DEFAULT 0,
  variance_revenue decimal(15,2) NOT NULL DEFAULT 0,
  variance_expenses decimal(15,2) NOT NULL DEFAULT 0,
  variance_profit decimal(15,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  settled_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settlements"
  ON settlements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settlements"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settlements"
  ON settlements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settlements"
  ON settlements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_settlements_offer_id ON settlements(offer_id);
CREATE INDEX IF NOT EXISTS idx_settlements_user_id ON settlements(user_id);

-- ===== 20251203092038_add_settlement_tracking_to_offers.sql =====
/*
  # Add Settlement Tracking to Offers Table

  1. Changes
    - Add `is_settled` column to track whether an offer has been settled
    - Add `actual_profit` column to store the actual profit from settlement
  
  2. Purpose
    - Support settlement tracking workflow
    - Enable AI insights to filter settled vs unsettled offers
    - Store actual profit alongside projected profit
*/

-- Add settlement tracking columns to offers table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'offers' AND column_name = 'is_settled'
  ) THEN
    ALTER TABLE offers ADD COLUMN is_settled BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'offers' AND column_name = 'actual_profit'
  ) THEN
    ALTER TABLE offers ADD COLUMN actual_profit DECIMAL DEFAULT 0;
  END IF;
END $$;


-- ===== 20251204050317_add_legal_terms_to_company_settings.sql =====
/*
  # Add Legal Terms to Company Settings

  1. Changes
    - Add `legal_terms` column to `company_settings` table for storing contract terms and rules
    - This will be displayed on all PDFs (offers, run of show, settlements)

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'legal_terms'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN legal_terms text;
  END IF;
END $$;

-- ===== 20251209220330_add_backend_split_percentages.sql =====
/*
  # Add Backend Split Percentages

  1. Changes
    - Add `artist_backend_pct` column to `offers` table (default 85%)
    - Add `promoter_backend_pct` column to `offers` table (default 15%)
  
  2. Purpose
    - Allow customization of backend split percentages in Promoter Profit deals
    - Previously hardcoded to 85/15, now fully customizable per offer
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'artist_backend_pct'
  ) THEN
    ALTER TABLE offers ADD COLUMN artist_backend_pct numeric DEFAULT 85;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'promoter_backend_pct'
  ) THEN
    ALTER TABLE offers ADD COLUMN promoter_backend_pct numeric DEFAULT 15;
  END IF;
END $$;

-- ===== 20251210032341_add_event_name_to_shows.sql =====
/*
  # Add Event Name to Shows

  1. Changes
    - Add `event_name` column to `shows` table
      - Optional text field for custom event names
      - Allows promoters to label events with custom names like "Summer Festival 2024" or "Holiday Show"
    
  2. Notes
    - Field is optional - if empty, UI will fall back to showing artist name
    - Existing shows will have NULL event_name (backward compatible)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shows' AND column_name = 'event_name'
  ) THEN
    ALTER TABLE shows ADD COLUMN event_name text;
  END IF;
END $$;

-- ===== 20251210070106_add_professional_offer_fields.sql =====
/*
  # Add Professional Offer Fields

  1. New Fields Added to offers table
    - facility_fee_per_ticket: Default $2.00 fee per ticket
    - comps_artist: Number of complimentary tickets for artist
    - comps_venue: Number of complimentary tickets for venue
    - comps_promoter: Number of complimentary tickets for promoter
    - doors_time: Time doors open
    - doors_duration: Duration doors are open (minutes)
    - show_time: Time show starts
    - show_duration: Duration of show (minutes)
    - curfew_time: Curfew time
    - age_limit: Age restriction for event
    - merch_rate_soft: Percentage artist keeps on soft merch sales
    - merch_rate_hard: Percentage artist keeps on hard merch sales
    - offer_sent_date: Date offer was sent
    - ascap_rate: ASCAP licensing rate (default 0.23%)
    - bmi_rate: BMI licensing rate (default 0.3%)
    - sesac_rate: SESAC licensing rate (default 0.0214%)
    - insurance_per_attendee: Insurance cost per attendee (default $0.62)
    - cc_fee_rate: Credit card processing fee rate (default 1.2%)
    - artist_deductions: Array of deductions from artist pay (equipment rentals, etc.)

  2. Purpose
    - Enable professional PDF generation matching industry standards
    - Track all costs and fees accurately
    - Calculate break-even points and split points
    - Provide complete offer documentation
*/

-- Add facility fee (default $2.00 per ticket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'facility_fee_per_ticket'
  ) THEN
    ALTER TABLE offers ADD COLUMN facility_fee_per_ticket DECIMAL DEFAULT 2.00;
  END IF;
END $$;

-- Add comp tickets tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'comps_artist'
  ) THEN
    ALTER TABLE offers ADD COLUMN comps_artist INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'comps_venue'
  ) THEN
    ALTER TABLE offers ADD COLUMN comps_venue INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'comps_promoter'
  ) THEN
    ALTER TABLE offers ADD COLUMN comps_promoter INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add show timing fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'doors_time'
  ) THEN
    ALTER TABLE offers ADD COLUMN doors_time TIME;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'doors_duration'
  ) THEN
    ALTER TABLE offers ADD COLUMN doors_duration INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'show_time'
  ) THEN
    ALTER TABLE offers ADD COLUMN show_time TIME;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'show_duration'
  ) THEN
    ALTER TABLE offers ADD COLUMN show_duration INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'curfew_time'
  ) THEN
    ALTER TABLE offers ADD COLUMN curfew_time TIME;
  END IF;
END $$;

-- Add event details
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'age_limit'
  ) THEN
    ALTER TABLE offers ADD COLUMN age_limit TEXT DEFAULT 'All Ages';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'merch_rate_soft'
  ) THEN
    ALTER TABLE offers ADD COLUMN merch_rate_soft INTEGER DEFAULT 100;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'merch_rate_hard'
  ) THEN
    ALTER TABLE offers ADD COLUMN merch_rate_hard INTEGER DEFAULT 100;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'offer_sent_date'
  ) THEN
    ALTER TABLE offers ADD COLUMN offer_sent_date DATE;
  END IF;
END $$;

-- Add variable expense rates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'ascap_rate'
  ) THEN
    ALTER TABLE offers ADD COLUMN ascap_rate DECIMAL DEFAULT 0.0023;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'bmi_rate'
  ) THEN
    ALTER TABLE offers ADD COLUMN bmi_rate DECIMAL DEFAULT 0.003;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'sesac_rate'
  ) THEN
    ALTER TABLE offers ADD COLUMN sesac_rate DECIMAL DEFAULT 0.000214;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'insurance_per_attendee'
  ) THEN
    ALTER TABLE offers ADD COLUMN insurance_per_attendee DECIMAL DEFAULT 0.62;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'cc_fee_rate'
  ) THEN
    ALTER TABLE offers ADD COLUMN cc_fee_rate DECIMAL DEFAULT 0.012;
  END IF;
END $$;

-- Add artist deductions (JSONB array)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'artist_deductions'
  ) THEN
    ALTER TABLE offers ADD COLUMN artist_deductions JSONB DEFAULT '[]';
  END IF;
END $$;

-- ===== 20251210073916_add_professional_offer_fields.sql =====
/*
  # Add Professional Offer Fields

  1. New Columns Added to `offers` table:
    - `facility_fee_per_ticket` (decimal) - Fee per ticket, default $2.00
    - `comps_artist` (integer) - Artist complimentary tickets
    - `comps_venue` (integer) - Venue complimentary tickets
    - `comps_promoter` (integer) - Promoter complimentary tickets
    - `doors_time` (text) - Time doors open
    - `doors_duration` (integer) - Duration doors are open in minutes
    - `show_time` (text) - Show start time
    - `show_duration` (integer) - Show duration in minutes
    - `curfew_time` (text) - Venue curfew time
    - `age_limit` (text) - Age restriction (All Ages, 18+, 21+)
    - `merch_rate_soft` (integer) - Percentage of soft merch artist keeps
    - `merch_rate_hard` (integer) - Percentage of hard merch artist keeps
    - `artist_deductions` (jsonb) - Equipment costs deducted from artist
    - `ascap_rate` (decimal) - ASCAP licensing rate percentage
    - `bmi_rate` (decimal) - BMI licensing rate percentage
    - `sesac_rate` (decimal) - SESAC licensing rate percentage
    - `insurance_per_attendee` (decimal) - Insurance cost per attendee
    - `cc_fee_rate` (decimal) - Credit card processing fee percentage

  2. Purpose:
    - Capture comprehensive professional concert booking details
    - Enable accurate financial modeling with variable expenses
    - Track complimentary ticket distribution
    - Document show schedule and timing requirements
*/

-- Add facility fee
ALTER TABLE offers ADD COLUMN IF NOT EXISTS facility_fee_per_ticket DECIMAL DEFAULT 2.00;

-- Add complimentary tickets
ALTER TABLE offers ADD COLUMN IF NOT EXISTS comps_artist INTEGER DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS comps_venue INTEGER DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS comps_promoter INTEGER DEFAULT 0;

-- Add show schedule fields
ALTER TABLE offers ADD COLUMN IF NOT EXISTS doors_time TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS doors_duration INTEGER DEFAULT 60;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS show_time TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS show_duration INTEGER DEFAULT 240;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS curfew_time TEXT;

-- Add age limit
ALTER TABLE offers ADD COLUMN IF NOT EXISTS age_limit TEXT DEFAULT 'All Ages';

-- Add merchandise rates
ALTER TABLE offers ADD COLUMN IF NOT EXISTS merch_rate_soft INTEGER DEFAULT 100;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS merch_rate_hard INTEGER DEFAULT 100;

-- Add artist deductions
ALTER TABLE offers ADD COLUMN IF NOT EXISTS artist_deductions JSONB DEFAULT '[]';

-- Add variable expense rates
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ascap_rate DECIMAL DEFAULT 0.0023;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS bmi_rate DECIMAL DEFAULT 0.003;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS sesac_rate DECIMAL DEFAULT 0.000214;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS insurance_per_attendee DECIMAL DEFAULT 0.62;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS cc_fee_rate DECIMAL DEFAULT 0.012;


-- ===== 20251210231733_add_deal_structure_columns_v3.sql =====
/*
  # Add Deal Structure Columns to Offers Table

  1. New Columns
    - `deal_type` (text) - Type of deal: flat_fee, guarantee_vs_percentage, percentage_only, door_deal
    - `artist_percentage` (decimal) - Percentage of net revenue for artist (0-100)
    - `promoter_profit` (decimal) - Calculated profit for promoter
    - `artist_payout` (decimal) - Calculated payout for artist
    
  2. Changes
    - Add deal structure tracking columns to offers table
    - Map old deal_type values to new ones
    - Add constraints for data validation
*/

-- Drop existing check constraints if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_deal_type_check') THEN
    ALTER TABLE offers DROP CONSTRAINT offers_deal_type_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_deal_type') THEN
    ALTER TABLE offers DROP CONSTRAINT valid_deal_type;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_artist_percentage') THEN
    ALTER TABLE offers DROP CONSTRAINT valid_artist_percentage;
  END IF;
END $$;

-- Add deal structure columns if they don't exist
ALTER TABLE offers ADD COLUMN IF NOT EXISTS artist_percentage DECIMAL;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS promoter_profit DECIMAL;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS artist_payout DECIMAL;

-- Update existing deal_type values to match new structure
-- Map 'flat_guarantee' to 'flat_fee'
UPDATE offers 
SET deal_type = 'flat_fee' 
WHERE deal_type = 'flat_guarantee' OR deal_type IS NULL OR deal_type = '';

-- Update existing rows to have valid artist_percentage
UPDATE offers 
SET artist_percentage = 100.00 
WHERE artist_percentage IS NULL;

-- Set default values for future inserts
ALTER TABLE offers ALTER COLUMN deal_type SET DEFAULT 'flat_fee';
ALTER TABLE offers ALTER COLUMN artist_percentage SET DEFAULT 100.00;

-- Add check constraint for valid deal types
ALTER TABLE offers 
ADD CONSTRAINT valid_deal_type 
CHECK (deal_type IN ('flat_fee', 'guarantee_vs_percentage', 'percentage_only', 'door_deal'));

-- Add check constraint for artist percentage
ALTER TABLE offers 
ADD CONSTRAINT valid_artist_percentage 
CHECK (artist_percentage >= 0 AND artist_percentage <= 100);


-- ===== 20251211071404_add_artist_deposit_status_to_offers.sql =====
/*
  # Add artist deposit status column to offers table

  1. Changes
    - Add `artist_deposit_status` column to `offers` table
    - Default value is 'pending'
    - Matches the pattern of existing `venue_deposit_status` column

  2. Notes
    - This field tracks the payment status of deposits from the artist
    - Uses same status values as venue_deposit_status (pending, paid, etc.)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'artist_deposit_status'
  ) THEN
    ALTER TABLE offers ADD COLUMN artist_deposit_status text DEFAULT 'pending';
  END IF;
END $$;


-- ===== 20251211102838_create_organizations_and_users.sql =====
/*
  # Create Organizations and User Management System

  1. New Tables
    - `organizations`
      - `id` (uuid, primary key)
      - `name` (text)
      - `slug` (text, unique)
      - `subscription_tier` (text) - 'starter', 'pro', 'agency_scale'
      - `subscription_status` (text) - 'active', 'past_due', 'canceled', 'trialing'
      - `stripe_customer_id` (text, nullable)
      - `stripe_subscription_id` (text, nullable)
      - `max_offers` (integer) - 10 for starter, -1 for unlimited
      - `max_seats` (integer) - 1 for starter, 2 for pro, 5+ for agency
      - `trial_ends_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `organization_members`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key to auth.users)
      - `role` (text) - 'owner', 'admin', 'member'
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Updates
    - Add `organization_id` to existing tables (shows, offers, tours, templates, settlements)
    - Add RLS policies for organization-based access

  3. Security
    - Enable RLS on all tables
    - Add policies for organization-scoped data access
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  subscription_tier text NOT NULL DEFAULT 'starter',
  subscription_status text NOT NULL DEFAULT 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  max_offers integer NOT NULL DEFAULT 10,
  max_seats integer NOT NULL DEFAULT 1,
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create organization_members table (maps users to organizations with roles)
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Add organization_id to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shows' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE shows ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE offers ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tours' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE tours ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'templates' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE templates ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settlements' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE settlements ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shows_organization ON shows(organization_id);
CREATE INDEX IF NOT EXISTS idx_offers_organization ON offers(organization_id);
CREATE INDEX IF NOT EXISTS idx_tours_organization ON tours(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_organization ON templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_settlements_organization ON settlements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Organization owners can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'owner'
      AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'owner'
      AND organization_members.is_active = true
    )
  );

-- RLS Policies for organization_members
CREATE POLICY "Users can view members of their organization"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Organization owners and admins can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

-- Update RLS policies for shows to use organization_id
DROP POLICY IF EXISTS "Users can view own shows" ON shows;
DROP POLICY IF EXISTS "Users can insert own shows" ON shows;
DROP POLICY IF EXISTS "Users can update own shows" ON shows;
DROP POLICY IF EXISTS "Users can delete own shows" ON shows;

CREATE POLICY "Users can view organization shows"
  ON shows FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert organization shows"
  ON shows FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update organization shows"
  ON shows FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete organization shows"
  ON shows FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Update RLS policies for offers
DROP POLICY IF EXISTS "Users can view own offers" ON offers;
DROP POLICY IF EXISTS "Users can insert own offers" ON offers;
DROP POLICY IF EXISTS "Users can update own offers" ON offers;
DROP POLICY IF EXISTS "Users can delete own offers" ON offers;

CREATE POLICY "Users can view organization offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert organization offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update organization offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete organization offers"
  ON offers FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Update RLS policies for tours
DROP POLICY IF EXISTS "Users can view their own tours" ON tours;
DROP POLICY IF EXISTS "Users can create their own tours" ON tours;
DROP POLICY IF EXISTS "Users can update their own tours" ON tours;
DROP POLICY IF EXISTS "Users can delete their own tours" ON tours;

CREATE POLICY "Users can view organization tours"
  ON tours FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert organization tours"
  ON tours FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update organization tours"
  ON tours FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete organization tours"
  ON tours FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Update RLS policies for templates
DROP POLICY IF EXISTS "Users can view own templates" ON templates;
DROP POLICY IF EXISTS "Users can create own templates" ON templates;
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;

CREATE POLICY "Users can view organization templates"
  ON templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert organization templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update organization templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete organization templates"
  ON templates FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Update RLS policies for settlements
DROP POLICY IF EXISTS "Users can view settlements for their offers" ON settlements;
DROP POLICY IF EXISTS "Users can create settlements for their offers" ON settlements;
DROP POLICY IF EXISTS "Users can update settlements for their offers" ON settlements;
DROP POLICY IF EXISTS "Users can delete settlements for their offers" ON settlements;

CREATE POLICY "Users can view organization settlements"
  ON settlements FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert organization settlements"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update organization settlements"
  ON settlements FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete organization settlements"
  ON settlements FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Update RLS policies for company_settings
DROP POLICY IF EXISTS "Users can view company settings for their organizations" ON company_settings;
DROP POLICY IF EXISTS "Users can update company settings for their organizations" ON company_settings;
DROP POLICY IF EXISTS "Users can insert company settings for their organizations" ON company_settings;

CREATE POLICY "Users can view organization settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert organization settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update organization settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Function to get user's active organization
CREATE OR REPLACE FUNCTION get_user_organization()
RETURNS uuid AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user has feature access
CREATE OR REPLACE FUNCTION has_feature_access(feature_name text)
RETURNS boolean AS $$
DECLARE
  user_tier text;
BEGIN
  SELECT subscription_tier INTO user_tier
  FROM organizations o
  JOIN organization_members om ON om.organization_id = o.id
  WHERE om.user_id = auth.uid()
  AND om.is_active = true
  LIMIT 1;

  CASE feature_name
    WHEN 'tours' THEN
      RETURN user_tier IN ('pro', 'agency_scale');
    WHEN 'ai_insights' THEN
      RETURN user_tier IN ('pro', 'agency_scale');
    WHEN 'deal_analyzer' THEN
      RETURN user_tier IN ('pro', 'agency_scale');
    WHEN 'advanced_ai' THEN
      RETURN user_tier = 'agency_scale';
    WHEN 'team_collaboration' THEN
      RETURN user_tier = 'agency_scale';
    WHEN 'custom_branding' THEN
      RETURN user_tier = 'agency_scale';
    ELSE
      RETURN true;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== 20251211104830_link_existing_data_to_organizations_fixed.sql =====
/*
  # Link Existing Data to Organizations (Fixed)

  1. Purpose
    - Create organizations for existing users
    - Link all existing offers, shows, tours, and other data to organizations
    - Set up organization memberships for existing users

  2. Steps
    - Create a default organization for each existing user
    - Create organization_member records
    - Update all user data to reference their organization
    - Set organization_id on all existing records

  3. Safety
    - Uses proper type casting for user_id fields
    - Only affects records that don't have organization_id set
*/

-- Create organizations and memberships for existing auth users who don't have them yet
DO $$
DECLARE
  user_record RECORD;
  org_id uuid;
  org_name text;
  org_slug text;
  counter int;
BEGIN
  -- Loop through all authenticated users
  FOR user_record IN 
    SELECT DISTINCT au.id, au.email, au.raw_user_meta_data->>'full_name' as full_name
    FROM auth.users au
    LEFT JOIN organization_members om ON om.user_id = au.id
    WHERE om.id IS NULL
  LOOP
    -- Generate organization name from email or full name
    org_name := COALESCE(
      user_record.full_name,
      split_part(user_record.email, '@', 1)
    );
    
    IF org_name IS NULL OR org_name = '' THEN
      org_name := 'My Organization';
    END IF;
    
    -- Generate unique slug
    org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
    org_slug := trim(both '-' from org_slug);
    
    IF org_slug = '' THEN
      org_slug := 'org';
    END IF;
    
    -- Ensure slug is unique
    counter := 0;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
      counter := counter + 1;
      org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || counter::text;
    END LOOP;
    
    -- Create organization with agency_scale tier (all features)
    INSERT INTO organizations (
      name,
      slug,
      subscription_tier,
      subscription_status,
      max_offers,
      max_seats,
      trial_ends_at
    ) VALUES (
      org_name || '''s Organization',
      org_slug,
      'agency_scale',
      'active',
      -1,
      10,
      now() + interval '365 days'
    )
    RETURNING id INTO org_id;
    
    -- Create organization membership as owner
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role,
      is_active
    ) VALUES (
      org_id,
      user_record.id,
      'owner',
      true
    );
    
    -- Update all existing user data to link to this organization
    UPDATE shows SET organization_id = org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE offers SET organization_id = org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE tours SET organization_id = org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE templates SET organization_id = org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE settlements SET organization_id = org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE company_settings SET organization_id = org_id WHERE user_id::uuid = user_record.id AND organization_id IS NULL;
    
    RAISE NOTICE 'Created organization % for user %', org_name, user_record.email;
  END LOOP;
END $$;

-- Function to upgrade any user to agency_scale tier with all features
CREATE OR REPLACE FUNCTION grant_admin_access(user_email text)
RETURNS void AS $$
DECLARE
  target_org_id uuid;
BEGIN
  -- Find the user's organization
  SELECT om.organization_id INTO target_org_id
  FROM auth.users au
  JOIN organization_members om ON om.user_id = au.id
  WHERE au.email = user_email
  LIMIT 1;
  
  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'User % not found or has no organization', user_email;
  END IF;
  
  -- Upgrade organization to agency_scale with all features
  UPDATE organizations
  SET 
    subscription_tier = 'agency_scale',
    subscription_status = 'active',
    max_offers = -1,
    max_seats = 10,
    trial_ends_at = now() + interval '365 days'
  WHERE id = target_org_id;
  
  -- Ensure user is an owner
  UPDATE organization_members
  SET role = 'owner', is_active = true
  WHERE organization_id = target_org_id 
  AND user_id = (SELECT id FROM auth.users WHERE email = user_email);
  
  RAISE NOTICE 'Granted admin access (agency_scale tier) to user %', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list all users and their organizations
CREATE OR REPLACE FUNCTION list_users_and_organizations()
RETURNS TABLE (
  user_email text,
  user_id uuid,
  organization_name text,
  organization_tier text,
  user_role text,
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.email::text,
    au.id,
    o.name::text,
    o.subscription_tier::text,
    om.role::text,
    om.is_active
  FROM auth.users au
  LEFT JOIN organization_members om ON om.user_id = au.id
  LEFT JOIN organizations o ON o.id = om.organization_id
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 20251211110110_fix_organization_members_rls_infinite_recursion.sql =====
/*
  # Fix Infinite Recursion in organization_members RLS Policies

  ## Problem
  The current RLS policies for `organization_members` cause infinite recursion
  because they query the same table they're protecting.

  ## Solution
  Simplify the policies to:
  1. Users can always view their own membership records
  2. Users can view other members in their organization using a different approach
  3. Remove the recursive policy that causes the infinite loop

  ## Changes
  - Drop existing problematic policies
  - Create new, non-recursive policies
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view members of their organization" ON organization_members;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON organization_members;

-- Policy 1: Users can always view their own membership records
CREATE POLICY "Users can view own membership"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Users can view other members if they share an organization
-- We use a subquery that checks if the current user EXISTS in ANY org that matches
CREATE POLICY "Users can view org members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.is_active = true
    )
  );

-- Policy 3: Users can insert members only if they're owner/admin
-- Check by directly comparing the organization_id with a subquery
CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

-- Policy 4: Users can update members only if they're owner/admin
CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

-- Policy 5: Users can delete members only if they're owner/admin
CREATE POLICY "Admins can delete members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );


-- ===== 20251211110347_fix_organization_members_rls_with_security_definer.sql =====
/*
  # Fix Organization Members RLS with Security Definer Function

  ## Problem
  The policies for organization_members cause infinite recursion because they
  query the same table they're protecting.

  ## Solution
  Create a SECURITY DEFINER function that bypasses RLS to check if a user
  is a member of an organization, then use that function in the policies.

  ## Changes
  1. Create helper function to check organization membership
  2. Drop all existing policies on organization_members
  3. Create new policies using the helper function
*/

-- Create a security definer function to check if user is member of an org
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid, check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a security definer function to check if user is admin/owner of an org
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid, check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a security definer function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations(check_user_id uuid)
RETURNS TABLE(organization_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = check_user_id
  AND om.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
DROP POLICY IF EXISTS "Admins can add members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;

-- Create new policies using security definer functions
CREATE POLICY "Users can view own membership"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view members in their orgs"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can delete members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (is_organization_admin(organization_id, auth.uid()));


-- ===== 20251216221253_add_artist_accommodations.sql =====
/*
  # Add Artist Accommodations to Offers

  1. New Columns
    - `include_hotel` (boolean) - Toggle for hotel accommodation
    - `hotel_budget` (decimal) - Budget per night for hotel
    - `hotel_nights` (integer) - Number of nights needed
    - `hotel_notes` (text) - Hotel requirements and notes
    - `include_transport` (boolean) - Toggle for ground transport
    - `transport_budget` (decimal) - Total transport budget
    - `transport_notes` (text) - Transport details and notes
    - `include_rider` (boolean) - Toggle for rider/hospitality
    - `rider_cap` (decimal) - Maximum budget for rider
    - `rider_notes` (text) - Rider requirements and notes

  2. Notes
    - All fields are optional with sensible defaults
    - These costs will be automatically included in expense calculations
    - Helps promoters track and budget for artist accommodations
*/

DO $$
BEGIN
  -- Hotel accommodation fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'include_hotel'
  ) THEN
    ALTER TABLE offers ADD COLUMN include_hotel BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'hotel_budget'
  ) THEN
    ALTER TABLE offers ADD COLUMN hotel_budget DECIMAL(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'hotel_nights'
  ) THEN
    ALTER TABLE offers ADD COLUMN hotel_nights INT DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'hotel_notes'
  ) THEN
    ALTER TABLE offers ADD COLUMN hotel_notes TEXT;
  END IF;

  -- Ground transport fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'include_transport'
  ) THEN
    ALTER TABLE offers ADD COLUMN include_transport BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'transport_budget'
  ) THEN
    ALTER TABLE offers ADD COLUMN transport_budget DECIMAL(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'transport_notes'
  ) THEN
    ALTER TABLE offers ADD COLUMN transport_notes TEXT;
  END IF;

  -- Rider/hospitality fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'include_rider'
  ) THEN
    ALTER TABLE offers ADD COLUMN include_rider BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'rider_cap'
  ) THEN
    ALTER TABLE offers ADD COLUMN rider_cap DECIMAL(10,2) DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'rider_notes'
  ) THEN
    ALTER TABLE offers ADD COLUMN rider_notes TEXT;
  END IF;
END $$;

-- ===== 20251217010434_add_payment_methods_to_offers.sql =====
/*
  # Add Payment Methods to Offers

  1. Changes
    - Add `payment_method` column to track payment type (deposit_balance, full_upfront, day_of_settlement)
    - Add `settlement_days` column for day_of_settlement payment method
    - Add `full_payment_due_date` column for full_upfront payment method
  
  2. Payment Methods
    - deposit_balance: Traditional deposit + balance payment (default)
    - full_upfront: Full payment before event
    - day_of_settlement: Payment after event settlement
  
  3. Notes
    - Existing offers default to 'deposit_balance' to maintain current behavior
    - settlement_days defaults to 7 days after event
*/

-- Add payment method columns to offers table
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'deposit_balance' CHECK (payment_method IN ('deposit_balance', 'full_upfront', 'day_of_settlement'));

ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS settlement_days INT DEFAULT 7;

ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS full_payment_due_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN offers.payment_method IS 'Payment method: deposit_balance, full_upfront, or day_of_settlement';
COMMENT ON COLUMN offers.settlement_days IS 'Days after event to pay artist (for day_of_settlement method)';
COMMENT ON COLUMN offers.full_payment_due_date IS 'Due date for full payment (for full_upfront method)';

-- ===== 20251217021434_add_balance_due_timing_fields.sql =====
/*
  # Add Balance Due Timing Fields

  1. Changes
    - Add `balance_due_timing` column to offers table
      - Options: '30_days_before', '60_days_before', '5_days_before', 'upon_signing', 'custom', 'at_settlement'
    - Add `custom_balance_due_date` column for custom date selection
  
  2. Purpose
    - Allow users to specify when the balance payment is due
    - Provides flexibility for different payment structures
    - Similar to existing deposit_due_timing functionality
*/

DO $$
BEGIN
  -- Add balance_due_timing column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'balance_due_timing'
  ) THEN
    ALTER TABLE offers ADD COLUMN balance_due_timing text DEFAULT 'at_settlement';
  END IF;

  -- Add custom_balance_due_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'custom_balance_due_date'
  ) THEN
    ALTER TABLE offers ADD COLUMN custom_balance_due_date date;
  END IF;
END $$;

-- ===== (added) create expense_items table — referenced by the next migration but never created in Bolt's migration files =====
CREATE TABLE IF NOT EXISTS expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id text REFERENCES offers(id) ON DELETE CASCADE,
  category text,
  name text,
  amount numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_expense_items_offer_id ON expense_items(offer_id);

-- ===== 20251220085453_fix_security_issues_and_optimize_rls_v2.sql =====
/*
  # Fix Security Issues and Optimize RLS Policies

  ## Changes Made

  ### 1. Missing Indexes
  - Add index on `company_settings.organization_id` foreign key

  ### 2. RLS Policy Optimization
  - Optimize all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
  - This prevents re-evaluation of auth functions for each row, improving query performance at scale

  ### 3. Remove Duplicate Policies
  - Remove old/duplicate RLS policies that overlap with organization-based policies
  - Keep only the organization-based policies for consistency

  ### 4. Function Search Path Fixes
  - Update all functions to use immutable search paths

  ### 5. Remove Unused Indexes
  - Drop indexes that are not being used by queries

  ## Security Notes
  - All changes maintain existing security posture while improving performance
  - No data access patterns are changed, only optimization applied
*/

-- =============================================================================
-- 1. ADD MISSING INDEXES
-- =============================================================================

-- Add index for company_settings foreign key
CREATE INDEX IF NOT EXISTS idx_company_settings_organization_id 
  ON company_settings(organization_id);

-- =============================================================================
-- 2. REMOVE UNUSED INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_user_roles_is_admin;
DROP INDEX IF EXISTS idx_shows_organization;
DROP INDEX IF EXISTS idx_tours_organization;
DROP INDEX IF EXISTS idx_settlements_organization;
DROP INDEX IF EXISTS idx_offers_status;
DROP INDEX IF EXISTS idx_tours_status;
DROP INDEX IF EXISTS idx_templates_type;

-- =============================================================================
-- 3. REMOVE OLD/DUPLICATE RLS POLICIES
-- =============================================================================

-- Remove old user-based policies (keeping organization-based ones)
DROP POLICY IF EXISTS "Users can view own settlements" ON settlements;
DROP POLICY IF EXISTS "Users can insert own settlements" ON settlements;
DROP POLICY IF EXISTS "Users can update own settlements" ON settlements;
DROP POLICY IF EXISTS "Users can delete own settlements" ON settlements;

DROP POLICY IF EXISTS "Users can view own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can create own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can delete own company settings" ON company_settings;

DROP POLICY IF EXISTS "Users can create own shows" ON shows;
DROP POLICY IF EXISTS "Users can create own offers" ON offers;
DROP POLICY IF EXISTS "Users can create own tours" ON tours;
DROP POLICY IF EXISTS "Users can delete own tours" ON tours;
DROP POLICY IF EXISTS "Users can view own tours" ON tours;
DROP POLICY IF EXISTS "Users can update own tours" ON tours;

-- =============================================================================
-- 4. OPTIMIZE RLS POLICIES - ORGANIZATIONS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organization owners can update their organization" ON organizations;
CREATE POLICY "Organization owners can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role = 'owner'
    )
  );

-- =============================================================================
-- 5. OPTIMIZE RLS POLICIES - ORGANIZATION MEMBERS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
CREATE POLICY "Users can view own membership"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view members in their orgs" ON organization_members;
CREATE POLICY "Users can view members in their orgs"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can add members" ON organization_members;
CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = (select auth.uid())
      AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = (select auth.uid())
      AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = (select auth.uid())
      AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;
CREATE POLICY "Admins can delete members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = (select auth.uid())
      AND om.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- 6. OPTIMIZE RLS POLICIES - SHOWS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view organization shows" ON shows;
CREATE POLICY "Users can view organization shows"
  ON shows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = shows.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert organization shows" ON shows;
CREATE POLICY "Users can insert organization shows"
  ON shows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = shows.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update organization shows" ON shows;
CREATE POLICY "Users can update organization shows"
  ON shows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = shows.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = shows.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete organization shows" ON shows;
CREATE POLICY "Users can delete organization shows"
  ON shows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = shows.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- 7. OPTIMIZE RLS POLICIES - OFFERS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view organization offers" ON offers;
CREATE POLICY "Users can view organization offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offers.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert organization offers" ON offers;
CREATE POLICY "Users can insert organization offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offers.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update organization offers" ON offers;
CREATE POLICY "Users can update organization offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offers.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offers.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete organization offers" ON offers;
CREATE POLICY "Users can delete organization offers"
  ON offers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offers.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- 8. OPTIMIZE RLS POLICIES - TOURS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view organization tours" ON tours;
CREATE POLICY "Users can view organization tours"
  ON tours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tours.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert organization tours" ON tours;
CREATE POLICY "Users can insert organization tours"
  ON tours FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tours.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update organization tours" ON tours;
CREATE POLICY "Users can update organization tours"
  ON tours FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tours.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tours.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete organization tours" ON tours;
CREATE POLICY "Users can delete organization tours"
  ON tours FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tours.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- 9. OPTIMIZE RLS POLICIES - TEMPLATES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view organization templates" ON templates;
CREATE POLICY "Users can view organization templates"
  ON templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert organization templates" ON templates;
CREATE POLICY "Users can insert organization templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update organization templates" ON templates;
CREATE POLICY "Users can update organization templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete organization templates" ON templates;
CREATE POLICY "Users can delete organization templates"
  ON templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- 10. OPTIMIZE RLS POLICIES - SETTLEMENTS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view organization settlements" ON settlements;
CREATE POLICY "Users can view organization settlements"
  ON settlements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = settlements.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert organization settlements" ON settlements;
CREATE POLICY "Users can insert organization settlements"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = settlements.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update organization settlements" ON settlements;
CREATE POLICY "Users can update organization settlements"
  ON settlements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = settlements.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = settlements.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete organization settlements" ON settlements;
CREATE POLICY "Users can delete organization settlements"
  ON settlements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = settlements.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- 11. OPTIMIZE RLS POLICIES - COMPANY SETTINGS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view organization settings" ON company_settings;
CREATE POLICY "Users can view organization settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert organization settings" ON company_settings;
CREATE POLICY "Users can insert organization settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update organization settings" ON company_settings;
CREATE POLICY "Users can update organization settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- 12. OPTIMIZE RLS POLICIES - EXPENSE ITEMS
-- =============================================================================

DROP POLICY IF EXISTS "Users can view expense items for their offers" ON expense_items;
CREATE POLICY "Users can view expense items for their offers"
  ON expense_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers
      JOIN organization_members ON organization_members.organization_id = offers.organization_id
      WHERE offers.id = expense_items.offer_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert expense items for their offers" ON expense_items;
CREATE POLICY "Users can insert expense items for their offers"
  ON expense_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offers
      JOIN organization_members ON organization_members.organization_id = offers.organization_id
      WHERE offers.id = expense_items.offer_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update expense items for their offers" ON expense_items;
CREATE POLICY "Users can update expense items for their offers"
  ON expense_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers
      JOIN organization_members ON organization_members.organization_id = offers.organization_id
      WHERE offers.id = expense_items.offer_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offers
      JOIN organization_members ON organization_members.organization_id = offers.organization_id
      WHERE offers.id = expense_items.offer_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete expense items for their offers" ON expense_items;
CREATE POLICY "Users can delete expense items for their offers"
  ON expense_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offers
      JOIN organization_members ON organization_members.organization_id = offers.organization_id
      WHERE offers.id = expense_items.offer_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- 13. OPTIMIZE RLS POLICIES - USER ROLES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_admin = true
    )
  );

-- =============================================================================
-- 14. FIX FUNCTION SEARCH PATHS
-- =============================================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_user_organization(uuid);
DROP FUNCTION IF EXISTS has_feature_access(text);
DROP FUNCTION IF EXISTS grant_admin_access(text);
DROP FUNCTION IF EXISTS list_users_and_organizations();
DROP FUNCTION IF EXISTS is_organization_member(uuid);
DROP FUNCTION IF EXISTS is_organization_admin(uuid);
DROP FUNCTION IF EXISTS get_user_organizations();

-- Recreate with proper search path
CREATE OR REPLACE FUNCTION get_user_organization(user_id_param uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM organization_members
  WHERE user_id = user_id_param
  LIMIT 1;
  
  RETURN org_id;
END;
$$;

CREATE OR REPLACE FUNCTION has_feature_access(feature_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_org_id uuid;
  org_tier text;
BEGIN
  user_org_id := get_user_organization(auth.uid());
  
  IF user_org_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT subscription_tier INTO org_tier
  FROM organizations
  WHERE id = user_org_id;
  
  RETURN CASE
    WHEN feature_name = 'ai_insights' THEN org_tier IN ('pro', 'enterprise')
    WHEN feature_name = 'deal_analyzer' THEN org_tier IN ('pro', 'enterprise')
    WHEN feature_name = 'unlimited_offers' THEN org_tier IN ('pro', 'enterprise')
    WHEN feature_name = 'analytics' THEN org_tier IN ('pro', 'enterprise')
    ELSE false
  END;
END;
$$;

CREATE OR REPLACE FUNCTION grant_admin_access(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  INSERT INTO user_roles (user_id, is_admin)
  VALUES (target_user_id, true)
  ON CONFLICT (user_id) 
  DO UPDATE SET is_admin = true;
END;
$$;

CREATE OR REPLACE FUNCTION list_users_and_organizations()
RETURNS TABLE (
  user_id uuid,
  user_email text,
  organization_id uuid,
  organization_name text,
  member_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email as user_email,
    om.organization_id,
    o.name as organization_name,
    om.role as member_role
  FROM auth.users au
  LEFT JOIN organization_members om ON om.user_id = au.id
  LEFT JOIN organizations o ON o.id = om.organization_id
  ORDER BY au.email;
END;
$$;

CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  subscription_tier text,
  subscription_status text,
  member_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.subscription_tier,
    o.subscription_status,
    om.role as member_role
  FROM organizations o
  JOIN organization_members om ON om.organization_id = o.id
  WHERE om.user_id = auth.uid();
END;
$$;

-- ===== 20251220090638_add_stripe_fields_to_organizations.sql =====
/*
  # Add Stripe fields to organizations table

  ## Changes
  - Add stripe_customer_id column to organizations table
  - Add stripe_subscription_id column to organizations table
  - These fields will be populated by the webhook when a subscription is created

  ## Notes
  - Allows linking organizations directly to Stripe subscriptions
  - Enables easier subscription management and status tracking
*/

-- Add Stripe fields to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN stripe_subscription_id text;
  END IF;
END $$;

-- ===== 20260112221719_fix_organization_creation_rls.sql =====
/*
  # Fix Organization Creation RLS

  ## Problem
  Users cannot create organizations because the INSERT policy on organization_members
  requires them to already be an admin of the organization they're trying to join.
  This creates a chicken-and-egg problem for new organizations.

  ## Solution
  Add a policy that allows users to add themselves as the first member when creating
  a new organization, or when they're already an admin.

  ## Changes
  1. Drop the restrictive "Admins can add members" policy
  2. Create new policies:
     - Allow users to add themselves when no members exist yet (new org)
     - Allow admins to add any member to their org
*/

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Admins can add members" ON organization_members;

-- Allow users to add themselves as first member (when creating org)
CREATE POLICY "Users can join as first member"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
    )
  );

-- Allow admins to add any member
CREATE POLICY "Admins can add any member"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
  );

-- ===== 20260112222020_fix_organization_members_recursion_complete.sql =====
/*
  # Complete Fix for Organization Members RLS Recursion

  ## Problem
  Multiple policies query organization_members within their checks, causing infinite
  recursion when any operation is performed. The INSERT, SELECT, UPDATE, and DELETE
  policies all reference the same table they're protecting.

  ## Solution
  Simplify all policies to avoid self-referential queries:
  1. Allow users to insert themselves into any organization (app will handle validation)
  2. Use simple checks that don't query organization_members
  3. Trust the application layer for complex membership validation

  ## Changes
  1. Drop ALL existing policies on organization_members
  2. Create minimal, non-recursive policies
  3. Enable RLS (ensure it stays enabled)
*/

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view members in their orgs" ON organization_members;
DROP POLICY IF EXISTS "Users can join as first member" ON organization_members;
DROP POLICY IF EXISTS "Admins can add any member" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;

-- Ensure RLS is enabled
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view memberships where they are the user
CREATE POLICY "Users can view own membership records"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SELECT: Users can view other members in same org (using security definer function)
CREATE POLICY "Users can view org member list"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id, auth.uid()));

-- INSERT: Users can add themselves to any org
-- (Application will validate they should only add themselves when creating new org)
CREATE POLICY "Users can add themselves as members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Only admins can update members (using security definer function)
CREATE POLICY "Admins can update member records"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

-- DELETE: Only admins can delete members (using security definer function)
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (is_organization_admin(organization_id, auth.uid()));

-- ===== 20260112222046_fix_security_definer_functions_bypass_rls.sql =====
/*
  # Fix Security Definer Functions to Bypass RLS

  ## Problem
  The SECURITY DEFINER functions (is_organization_member, is_organization_admin)
  still trigger RLS policies when they query organization_members, causing
  infinite recursion.

  ## Solution
  Recreate these functions with proper RLS bypass settings by:
  1. Setting search_path for security
  2. Using SET row_security = off to bypass RLS within the function
  3. This allows the functions to query organization_members without triggering policies

  ## Changes
  - Recreate is_organization_member with RLS bypass
  - Recreate is_organization_admin with RLS bypass
  - Both versions (with and without check_user_id parameter)
*/

-- Drop and recreate is_organization_member (single parameter)
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND is_active = true
  );
END;
$$;

-- Drop and recreate is_organization_member (two parameters)
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid, check_user_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND is_active = true
  );
END;
$$;

-- Drop and recreate is_organization_admin (single parameter)
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
END;
$$;

-- Drop and recreate is_organization_admin (two parameters)
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid, check_user_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
END;
$$;

-- Drop and recreate get_user_organizations
CREATE OR REPLACE FUNCTION get_user_organizations(check_user_id uuid)
RETURNS TABLE(organization_id uuid) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = check_user_id
  AND om.is_active = true;
END;
$$;

-- ===== 20260211000000_add_organization_insert_policy.sql =====
/*
  # Add INSERT Policy for Organizations Table

  ## Problem
  The organizations table has RLS enabled but no INSERT policy, preventing users
  from creating new organizations during signup.

  ## Solution
  Add an INSERT policy that allows authenticated users to create organizations.

  ## Security
  - Only authenticated users can create organizations
  - Application layer validates organization creation with proper membership
  - Users can only create organizations through the signup flow
*/

-- Add INSERT policy for organizations
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ===== 20260212061234_add_organization_insert_policy.sql =====
/*
  # Add INSERT Policy for Organizations Table

  ## Problem
  The organizations table has RLS enabled but no INSERT policy, preventing users
  from creating new organizations during signup.

  ## Solution
  Add an INSERT policy that allows authenticated users to create organizations.

  ## Security
  - Only authenticated users can create organizations
  - Application layer validates organization creation with proper membership
  - Users can only create organizations through the signup flow
*/

-- Add INSERT policy for organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===== 20260213094034_fix_templates_rls_policies.sql =====
/*
  # Fix Templates RLS Policies

  1. Changes
    - Replace complex EXISTS subqueries with direct function calls
    - Use is_organization_member() SECURITY DEFINER function for better performance
    - Ensures INSERT policy works correctly
    
  2. Security
    - Maintains same security model (users can only access templates in their organization)
    - Uses SECURITY DEFINER function to avoid RLS recursion issues
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view organization templates" ON templates;
DROP POLICY IF EXISTS "Users can insert organization templates" ON templates;
DROP POLICY IF EXISTS "Users can update organization templates" ON templates;
DROP POLICY IF EXISTS "Users can delete organization templates" ON templates;

-- Recreate with direct function calls
CREATE POLICY "Users can view organization templates"
  ON templates FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR 
    is_organization_member(organization_id, auth.uid())
  );

CREATE POLICY "Users can insert organization templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NULL OR 
    is_organization_member(organization_id, auth.uid())
  );

CREATE POLICY "Users can update organization templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NULL OR 
    is_organization_member(organization_id, auth.uid())
  )
  WITH CHECK (
    organization_id IS NULL OR 
    is_organization_member(organization_id, auth.uid())
  );

CREATE POLICY "Users can delete organization templates"
  ON templates FOR DELETE
  TO authenticated
  USING (
    organization_id IS NULL OR 
    is_organization_member(organization_id, auth.uid())
  );


-- ===== 20260213094411_fix_templates_deal_type_constraint.sql =====
/*
  # Fix Templates Deal Type Constraint

  1. Changes
    - Update the deal_type check constraint on templates table to match the offers table
    - Allows: 'flat_fee', 'guarantee_vs_percentage', 'percentage_only', 'door_deal'
    
  2. Reason
    - Templates are created from offers
    - The deal_type values must match between both tables
*/

-- Drop the old constraint
ALTER TABLE templates 
DROP CONSTRAINT IF EXISTS templates_deal_type_check;

-- Add the new constraint with correct values
ALTER TABLE templates
ADD CONSTRAINT templates_deal_type_check 
CHECK (deal_type IN ('flat_fee', 'guarantee_vs_percentage', 'percentage_only', 'door_deal'));


-- ===== 20260225062659_create_offer_deposits_tasks_notes.sql =====
/*
  # Create Offer Deposits, Tasks, and Notes Tables

  1. New Tables
    - `offer_deposits`
      - `id` (uuid, primary key) - Unique deposit identifier
      - `offer_id` (text, foreign key) - Links to offers table
      - `organization_id` (uuid, foreign key) - Links to organizations table
      - `related_type` (text) - Category: artist, expense, venue, other
      - `related_id` (text) - Optional reference to a specific expense line
      - `label` (text) - Description of the deposit
      - `amount` (numeric) - Dollar amount
      - `due_date` (date) - When the deposit is due
      - `paid` (boolean) - Whether it has been paid
      - `paid_date` (date) - When it was paid
      - `method` (text) - Payment method (check, wire, etc.)
      - `note` (text) - Additional notes
    - `offer_tasks`
      - `id` (uuid, primary key) - Unique task identifier
      - `offer_id` (text, foreign key) - Links to offers table
      - `organization_id` (uuid, foreign key) - Links to organizations table
      - `title` (text) - Task description
      - `due_date` (date) - Optional due date
      - `completed` (boolean) - Completion status
      - `priority` (text) - low, med, or high
      - `owner` (text) - Person responsible
      - `note` (text) - Additional notes
    - `offer_notes`
      - `id` (uuid, primary key) - Unique notes identifier
      - `offer_id` (text, unique, foreign key) - Links to offers table (one per offer)
      - `organization_id` (uuid, foreign key) - Links to organizations table
      - `event_notes` (text) - Long-form event notes
      - `pinned_notes` (jsonb) - Array of pinned quick notes

  2. Security
    - Enable RLS on all three tables
    - Policies for authenticated organization members to manage their own data

  3. Notes
    - Deposits track payment timing, NOT new costs (do not affect totalExpenses)
    - offer_notes uses a unique constraint on offer_id (one notes record per offer)
*/

-- Offer Deposits
CREATE TABLE IF NOT EXISTS offer_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id text NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  related_type text NOT NULL DEFAULT 'other',
  related_id text,
  label text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  paid boolean NOT NULL DEFAULT false,
  paid_date date,
  method text,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE offer_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view deposits"
  ON offer_deposits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can insert deposits"
  ON offer_deposits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can update deposits"
  ON offer_deposits FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can delete deposits"
  ON offer_deposits FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_offer_deposits_offer_id ON offer_deposits(offer_id);

-- Offer Tasks
CREATE TABLE IF NOT EXISTS offer_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id text NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'med',
  owner text,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE offer_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view tasks"
  ON offer_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can insert tasks"
  ON offer_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can update tasks"
  ON offer_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can delete tasks"
  ON offer_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_offer_tasks_offer_id ON offer_tasks(offer_id);

-- Offer Notes (one per offer)
CREATE TABLE IF NOT EXISTS offer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id text NOT NULL UNIQUE REFERENCES offers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_notes text DEFAULT '',
  pinned_notes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE offer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view notes"
  ON offer_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can insert notes"
  ON offer_notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can update notes"
  ON offer_notes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can delete notes"
  ON offer_notes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_offer_notes_offer_id ON offer_notes(offer_id);


-- ===== 20260306021012_add_flights_to_offers.sql =====
/*
  # Add flights accommodation fields to offers

  1. Modified Tables
    - `offers`
      - `include_flights` (boolean) - Whether flights are included in the deal
      - `flight_budget` (real) - Budget allocated for flights
      - `flight_notes` (text) - Notes about flight requirements

  2. Important Notes
    - Follows the same pattern as existing accommodation fields (hotel, transport, rider)
    - Defaults to false/0/empty to not affect existing offers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'include_flights'
  ) THEN
    ALTER TABLE offers ADD COLUMN include_flights boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'flight_budget'
  ) THEN
    ALTER TABLE offers ADD COLUMN flight_budget real DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'flight_notes'
  ) THEN
    ALTER TABLE offers ADD COLUMN flight_notes text DEFAULT '';
  END IF;
END $$;

-- ===== 20260306083558_create_event_artists_system.sql =====
/*
  # Create Multi-Artist Offer System

  1. New Tables
    - `event_artists` - Stores per-artist offer details for each event/offer
      - `id` (uuid, primary key)
      - `offer_id` (text, references offers)
      - `organization_id` (uuid, references organizations)
      - Basic info: artist_name, role, status
      - Contact: agency, contact_name, contact_email, contact_phone
      - Payment: guarantee, deposit_type, deposit_percentage, deposit_amount, balance_due, payment_notes
      - Travel: flight_covered, flight_budget, hotel_covered, hotel_rooms, hotel_nights, hotel_budget,
                ground_transport_covered, ground_transport_budget, airport_pickup, travel_notes
      - Hospitality: rider_included, hospitality_buyout, dinner_buyout, drink_tickets, backstage_needs, hospitality_notes
      - Performance: set_length, performance_time, soundcheck_time
      - Other deal terms: guest_list_spots, merch_cut, meet_and_greet, special_terms, internal_notes
      - Computed: total_artist_cost
      - Ordering: sort_order
      - Timestamps: created_at, updated_at

    - `event_artist_tasks` - Per-artist task tracking
      - `id` (uuid, primary key)
      - `event_artist_id` (uuid, references event_artists)
      - `organization_id` (uuid, references organizations)
      - `title` (text)
      - `due_date` (date)
      - `completed` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated users scoped to their organization
    - Uses security definer helper function for org membership checks

  3. Important Notes
    - event_artists are linked to offers via offer_id
    - Each artist has independent deal terms regardless of role
    - Roles (headliner, direct_support, support, local_opener) are display-only
    - Status tracks deal progress: draft -> sent -> negotiating -> accepted -> contracted -> deposit_paid -> fully_paid
    - total_artist_cost is a computed cache column for quick aggregation
*/

-- Create event_artists table
CREATE TABLE IF NOT EXISTS event_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id text NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),

  artist_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'support',
  status text NOT NULL DEFAULT 'draft',

  agency text DEFAULT '',
  contact_name text DEFAULT '',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',

  guarantee numeric NOT NULL DEFAULT 0,
  deposit_type text DEFAULT 'percentage',
  deposit_percentage numeric DEFAULT 0,
  deposit_amount numeric DEFAULT 0,
  balance_due numeric DEFAULT 0,
  payment_notes text DEFAULT '',

  flight_covered boolean DEFAULT false,
  flight_budget numeric DEFAULT 0,
  hotel_covered boolean DEFAULT false,
  hotel_rooms integer DEFAULT 1,
  hotel_nights integer DEFAULT 1,
  hotel_budget numeric DEFAULT 0,
  ground_transport_covered boolean DEFAULT false,
  ground_transport_budget numeric DEFAULT 0,
  airport_pickup boolean DEFAULT false,
  travel_notes text DEFAULT '',

  rider_included boolean DEFAULT false,
  hospitality_buyout numeric DEFAULT 0,
  dinner_buyout numeric DEFAULT 0,
  drink_tickets integer DEFAULT 0,
  backstage_needs text DEFAULT '',
  hospitality_notes text DEFAULT '',

  set_length integer DEFAULT 0,
  performance_time text DEFAULT '',
  soundcheck_time text DEFAULT '',

  guest_list_spots integer DEFAULT 0,
  merch_cut numeric DEFAULT 0,
  meet_and_greet boolean DEFAULT false,
  special_terms text DEFAULT '',
  internal_notes text DEFAULT '',

  total_artist_cost numeric DEFAULT 0,
  sort_order integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create event_artist_tasks table
CREATE TABLE IF NOT EXISTS event_artist_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_artist_id uuid NOT NULL REFERENCES event_artists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title text NOT NULL DEFAULT '',
  due_date date,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_artists_offer_id ON event_artists(offer_id);
CREATE INDEX IF NOT EXISTS idx_event_artists_org_id ON event_artists(organization_id);
CREATE INDEX IF NOT EXISTS idx_event_artist_tasks_artist_id ON event_artist_tasks(event_artist_id);
CREATE INDEX IF NOT EXISTS idx_event_artist_tasks_org_id ON event_artist_tasks(organization_id);

-- Enable RLS
ALTER TABLE event_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_artist_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_artists
CREATE POLICY "Org members can view event artists"
  ON event_artists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can insert event artists"
  ON event_artists FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can update event artists"
  ON event_artists FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can delete event artists"
  ON event_artists FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

-- RLS Policies for event_artist_tasks
CREATE POLICY "Org members can view artist tasks"
  ON event_artist_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can insert artist tasks"
  ON event_artist_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can update artist tasks"
  ON event_artist_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

CREATE POLICY "Org members can delete artist tasks"
  ON event_artist_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );


-- ===== 20260311031504_fix_security_performance_issues.sql =====
/*
  # Fix Security and Performance Issues

  1. Add Missing Foreign Key Indexes
    - `offer_deposits.organization_id` - index for FK lookup performance
    - `offer_notes.organization_id` - index for FK lookup performance
    - `offer_tasks.organization_id` - index for FK lookup performance
    - `settlements.organization_id` - index for FK lookup performance
    - `shows.organization_id` - index for FK lookup performance
    - `tours.organization_id` - index for FK lookup performance

  2. Drop Unused Indexes
    - `idx_company_settings_organization_id` - never used
    - `idx_event_artists_org_id` - never used
    - `idx_event_artist_tasks_org_id` - never used

  3. Fix RLS Policies - Auth Function Initialization
    - Replace `auth.uid()` with `(select auth.uid())` in all affected policies
    - This prevents re-evaluation of auth functions for each row
    - Affects: templates (4), organization_members (5), offer_deposits (4),
      offer_tasks (4), offer_notes (4), event_artists (4), event_artist_tasks (4)

  4. Consolidate Multiple Permissive SELECT Policies
    - `organization_members`: merge "Users can view org member list" and
      "Users can view own membership records" into single policy
    - `user_roles`: merge "Admins can view all roles" and
      "Users can view own role" into single policy

  5. Fix Function Search Path
    - Recreate `get_user_organization()` (no args) with immutable search_path

  6. Fix Organizations INSERT Policy
    - Replace always-true WITH CHECK with explicit auth check
*/

-- ============================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_offer_deposits_organization_id
  ON public.offer_deposits (organization_id);

CREATE INDEX IF NOT EXISTS idx_offer_notes_organization_id
  ON public.offer_notes (organization_id);

CREATE INDEX IF NOT EXISTS idx_offer_tasks_organization_id
  ON public.offer_tasks (organization_id);

CREATE INDEX IF NOT EXISTS idx_settlements_organization_id
  ON public.settlements (organization_id);

CREATE INDEX IF NOT EXISTS idx_shows_organization_id
  ON public.shows (organization_id);

CREATE INDEX IF NOT EXISTS idx_tours_organization_id
  ON public.tours (organization_id);

-- ============================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_company_settings_organization_id;
DROP INDEX IF EXISTS idx_event_artists_org_id;
DROP INDEX IF EXISTS idx_event_artist_tasks_org_id;

-- ============================================================
-- 3. FIX RLS POLICIES - templates
-- ============================================================

DROP POLICY IF EXISTS "Users can view organization templates" ON public.templates;
CREATE POLICY "Users can view organization templates"
  ON public.templates FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR is_organization_member(organization_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert organization templates" ON public.templates;
CREATE POLICY "Users can insert organization templates"
  ON public.templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR is_organization_member(organization_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update organization templates" ON public.templates;
CREATE POLICY "Users can update organization templates"
  ON public.templates FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR is_organization_member(organization_id, (select auth.uid()))
  )
  WITH CHECK (
    organization_id IS NULL
    OR is_organization_member(organization_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete organization templates" ON public.templates;
CREATE POLICY "Users can delete organization templates"
  ON public.templates FOR DELETE TO authenticated
  USING (
    organization_id IS NULL
    OR is_organization_member(organization_id, (select auth.uid()))
  );

-- ============================================================
-- 3. FIX RLS POLICIES - organization_members
-- ============================================================

DROP POLICY IF EXISTS "Users can view org member list" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view own membership records" ON public.organization_members;
CREATE POLICY "Users can view organization members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_organization_member(organization_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can add themselves as members" ON public.organization_members;
CREATE POLICY "Users can add themselves as members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update member records" ON public.organization_members;
CREATE POLICY "Admins can update member records"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (is_organization_admin(organization_id, (select auth.uid())))
  WITH CHECK (is_organization_admin(organization_id, (select auth.uid())));

DROP POLICY IF EXISTS "Admins can remove members" ON public.organization_members;
CREATE POLICY "Admins can remove members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (is_organization_admin(organization_id, (select auth.uid())));

-- ============================================================
-- 3. FIX RLS POLICIES - offer_deposits
-- ============================================================

DROP POLICY IF EXISTS "Org members can view deposits" ON public.offer_deposits;
CREATE POLICY "Org members can view deposits"
  ON public.offer_deposits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can insert deposits" ON public.offer_deposits;
CREATE POLICY "Org members can insert deposits"
  ON public.offer_deposits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can update deposits" ON public.offer_deposits;
CREATE POLICY "Org members can update deposits"
  ON public.offer_deposits FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can delete deposits" ON public.offer_deposits;
CREATE POLICY "Org members can delete deposits"
  ON public.offer_deposits FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_deposits.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

-- ============================================================
-- 3. FIX RLS POLICIES - offer_tasks
-- ============================================================

DROP POLICY IF EXISTS "Org members can view tasks" ON public.offer_tasks;
CREATE POLICY "Org members can view tasks"
  ON public.offer_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can insert tasks" ON public.offer_tasks;
CREATE POLICY "Org members can insert tasks"
  ON public.offer_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can update tasks" ON public.offer_tasks;
CREATE POLICY "Org members can update tasks"
  ON public.offer_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can delete tasks" ON public.offer_tasks;
CREATE POLICY "Org members can delete tasks"
  ON public.offer_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

-- ============================================================
-- 3. FIX RLS POLICIES - offer_notes
-- ============================================================

DROP POLICY IF EXISTS "Org members can view notes" ON public.offer_notes;
CREATE POLICY "Org members can view notes"
  ON public.offer_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can insert notes" ON public.offer_notes;
CREATE POLICY "Org members can insert notes"
  ON public.offer_notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can update notes" ON public.offer_notes;
CREATE POLICY "Org members can update notes"
  ON public.offer_notes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can delete notes" ON public.offer_notes;
CREATE POLICY "Org members can delete notes"
  ON public.offer_notes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = offer_notes.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

-- ============================================================
-- 3. FIX RLS POLICIES - event_artists
-- ============================================================

DROP POLICY IF EXISTS "Org members can view event artists" ON public.event_artists;
CREATE POLICY "Org members can view event artists"
  ON public.event_artists FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can insert event artists" ON public.event_artists;
CREATE POLICY "Org members can insert event artists"
  ON public.event_artists FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can update event artists" ON public.event_artists;
CREATE POLICY "Org members can update event artists"
  ON public.event_artists FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can delete event artists" ON public.event_artists;
CREATE POLICY "Org members can delete event artists"
  ON public.event_artists FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artists.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

-- ============================================================
-- 3. FIX RLS POLICIES - event_artist_tasks
-- ============================================================

DROP POLICY IF EXISTS "Org members can view artist tasks" ON public.event_artist_tasks;
CREATE POLICY "Org members can view artist tasks"
  ON public.event_artist_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can insert artist tasks" ON public.event_artist_tasks;
CREATE POLICY "Org members can insert artist tasks"
  ON public.event_artist_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can update artist tasks" ON public.event_artist_tasks;
CREATE POLICY "Org members can update artist tasks"
  ON public.event_artist_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Org members can delete artist tasks" ON public.event_artist_tasks;
CREATE POLICY "Org members can delete artist tasks"
  ON public.event_artist_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = event_artist_tasks.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.is_active = true
    )
  );

-- ============================================================
-- 4. CONSOLIDATE user_roles MULTIPLE PERMISSIVE SELECT POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND ur.is_admin = true
    )
  );

-- ============================================================
-- 5. FIX get_user_organization() FUNCTION SEARCH PATH
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_organization()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
SELECT organization_id
FROM organization_members
WHERE user_id = auth.uid()
AND is_active = true
LIMIT 1;
$$;

-- ============================================================
-- 6. FIX organizations INSERT POLICY (always true)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
