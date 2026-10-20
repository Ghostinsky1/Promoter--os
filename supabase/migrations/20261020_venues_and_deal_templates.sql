-- Applied to production Oct 20 2026 (in pieces, via the Supabase MCP). Kept here for the record.
create or replace function public.venue_key(t text) returns text
language sql immutable parallel safe set search_path = '' as
$$ select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]', '', 'g') $$;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  name_key text generated always as (public.venue_key(name)) stored,
  alias_keys text[] not null default '{}',
  street text, city text, state text, zip text, country text default 'US',
  capacity integer,
  contact_name text, contact_email text, contact_phone text, contact_ig text,
  costs jsonb not null default '[]'::jsonb,   -- [{label, amount, category}]
  facility_fee_per_ticket numeric,
  notes text,
  lat double precision, lng double precision,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists venues_one_per_name on public.venues (organization_id, name_key);
create index if not exists venues_alias_keys on public.venues using gin (alias_keys);
alter table public.venues enable row level security;
-- RLS: active org members can select / insert / update / delete their org's venues.

alter table public.offers add column if not exists venue_id uuid references public.venues(id) on delete set null;
create index if not exists offers_venue_id on public.offers (venue_id);
alter table public.templates add column if not exists deal jsonb not null default '{}'::jsonb;

-- resolve_venue(org, name, city, state, zip, street, capacity): find by name/alias or create.
-- offers_link_venue trigger (before insert / update of show_id): sets offers.venue_id.
-- shows_relink_venue trigger (after update of venue_name): moves the show's offers.
-- Existing offers were backfilled once.
